import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { addMonths, format } from 'date-fns';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

interface CreateInstallmentsData {
  account_id: string;
  category_id: string;
  subcategory_id?: string | null;
  member_id?: string | null;
  total_amount: number;
  installment_count: number;
  due_date: string; // Required: first installment due date
  description?: string | null;
}

interface UpdateInstallmentScope {
  id: string;
  scope: 'single' | 'this_and_future';
  updates: {
    category_id?: string;
    subcategory_id?: string | null;
    member_id?: string | null;
    description?: string | null;
    amount?: number;
  };
}

interface DeleteInstallmentScope {
  id: string;
  installment_group_id: string;
  installment_number: number;
  scope: 'single' | 'this_and_future';
}

export function useInstallments() {
  const { householdId } = useAuth();
  const queryClient = useQueryClient();

  // Create installment transactions
  const createInstallments = useMutation({
    mutationFn: async (data: CreateInstallmentsData) => {
      if (!householdId) throw new Error('No household');

      const installmentGroupId = crypto.randomUUID();
      
      // Calculate installment amounts with proper rounding
      // Last installment adjusts for any rounding difference
      const baseAmount = Math.floor((data.total_amount / data.installment_count) * 100) / 100;
      const totalFromBase = baseAmount * (data.installment_count - 1);
      const lastAmount = Math.round((data.total_amount - totalFromBase) * 100) / 100;
      
      // Create all installment transactions - ALL as planned
      const transactions = [];
      for (let i = 0; i < data.installment_count; i++) {
        const dueDate = addMonths(new Date(data.due_date), i);
        const dueDateStr = format(dueDate, 'yyyy-MM-dd');
        const isLastInstallment = i === data.installment_count - 1;
        const amount = isLastInstallment ? lastAmount : baseAmount;
        
        transactions.push({
          household_id: householdId,
          account_id: data.account_id,
          category_id: data.category_id,
          subcategory_id: data.subcategory_id || null,
          member_id: data.member_id || null,
          kind: 'EXPENSE' as const,
          amount: amount,
          date: dueDateStr, // Use due_date as transaction date
          description: data.description || null,
          status: 'planned', // ALL installments start as planned
          confirmed_at: null, // No auto-confirmation
          expense_type: 'variable' as const,
          due_date: dueDateStr, // Required for planned status
          installment_group_id: installmentGroupId,
          installment_number: i + 1,
          installment_total: data.installment_count,
        });
      }

      const { data: result, error } = await supabase
        .from('transactions')
        .insert(transactions)
        .select();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`Compra parcelada em ${data.length}x criada com sucesso!`);
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Update installment(s)
  const updateInstallment = useMutation({
    mutationFn: async ({ id, scope, updates }: UpdateInstallmentScope) => {
      // Sanitize amount if present in updates
      const sanitizedUpdates = { ...updates };
      if ('amount' in updates && updates.amount !== undefined) {
        let sanitizedAmount: number;
        if (typeof updates.amount === 'string') {
          // Remove spaces and normalize
          let cleaned = updates.amount.trim().replace(/\s/g, '');
          
          // Detect format: if comma appears after the last dot, it's pt-BR (comma is decimal)
          const lastComma = cleaned.lastIndexOf(',');
          const lastDot = cleaned.lastIndexOf('.');
          
          if (lastComma > lastDot) {
            // pt-BR format: dots are thousand separators, comma is decimal
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
          } else if (lastDot > lastComma) {
            // en-US format: commas are thousand separators, dot is decimal
            cleaned = cleaned.replace(/,/g, '');
          } else {
            // Only one or none separators - treat comma as decimal
            cleaned = cleaned.replace(',', '.');
          }
          
          const parsed = parseFloat(cleaned);
          if (isNaN(parsed)) {
            throw new Error('Valor inválido. Por favor, insira um número válido.');
          }
          sanitizedAmount = Math.round(parsed * 100) / 100;
        } else if (typeof updates.amount === 'number') {
          sanitizedAmount = isNaN(updates.amount) ? 0 : updates.amount;
        } else {
          throw new Error('Valor inválido. Por favor, insira um número válido.');
        }
        
        // Validate amount is positive
        if (sanitizedAmount <= 0) {
          throw new Error('O valor deve ser maior que zero.');
        }
        
        sanitizedUpdates.amount = sanitizedAmount;
      }
      
      // Debug log before sending to Supabase
      console.log('[Installment Update] Payload:', { id, scope, updates: sanitizedUpdates });
      
      if (scope === 'single') {
        // Update only this installment
        const { data, error } = await supabase
          .from('transactions')
          .update(sanitizedUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('[Installment Update Error]', { error, payload: sanitizedUpdates });
          throw error;
        }
        return data;
      } else {
        // Update this and all future installments
        // First, get the current transaction
        const { data: current, error: fetchError } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        if (!current.installment_group_id) throw new Error('Not an installment');

        // Update all installments with same group_id and installment_number >= current
        const { data, error } = await supabase
          .from('transactions')
          .update(sanitizedUpdates)
          .eq('installment_group_id', current.installment_group_id)
          .gte('installment_number', current.installment_number)
          .select();

        if (error) {
          console.error('[Installment Update Error]', { error, payload: sanitizedUpdates });
          throw error;
        }
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      const message = variables.scope === 'single' 
        ? 'Parcela atualizada!' 
        : 'Parcelas atualizadas!';
      toast.success(message);
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Delete installment(s)
  const deleteInstallment = useMutation({
    mutationFn: async ({ id, installment_group_id, installment_number, scope }: DeleteInstallmentScope) => {
      if (scope === 'single') {
        // Delete only this installment
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return { count: 1 };
      } else {
        // Delete this and all future installments
        const { data, error } = await supabase
          .from('transactions')
          .delete()
          .eq('installment_group_id', installment_group_id)
          .gte('installment_number', installment_number)
          .select('id');

        if (error) throw error;
        return { count: data?.length || 0 };
      }
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      const message = variables.scope === 'single' 
        ? 'Parcela excluída!' 
        : `${result.count} parcela(s) excluída(s)!`;
      toast.success(message);
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  return {
    createInstallments,
    updateInstallment,
    deleteInstallment,
  };
}

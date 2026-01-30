import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, TransactionKind, TransactionStatus, ExpenseType } from '@/types/finance';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, addDays, parseISO, isWithinInterval, startOfDay, differenceInDays } from 'date-fns';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { calculateMonthlyMetrics } from '@/lib/financeMetrics';
import { NotificationMetadata } from '@/types/notifications';

interface TransactionFilters {
  month?: Date;
  accountId?: string;
  categoryId?: string;
  subcategoryId?: string;
  memberId?: string;
  kind?: TransactionKind;
  status?: TransactionStatus | 'all';
  includeCancelled?: boolean;
  // Special filter: fetch all overdue transactions regardless of month
  overdueOnly?: boolean;
  // Special filter: fetch transactions due today
  todayOnly?: boolean;
  // Special filter: fetch transactions due in the next 7 days (excluding today)
  weekOnly?: boolean;
  // Special filter: fetch a single transaction by ID
  singleTransactionId?: string;
}

export function useTransactions(filters: TransactionFilters = {}) {
  const { householdId, member } = useAuth();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: [
      'transactions',
      householdId,
      filters.singleTransactionId ? `single:${filters.singleTransactionId}` : 
        filters.overdueOnly ? 'overdue' : 
        filters.todayOnly ? 'today' :
        filters.weekOnly ? 'week' :
        (filters.month ? format(filters.month, 'yyyy-MM') : null),
      filters.accountId ?? null,
      filters.categoryId ?? null,
      filters.subcategoryId ?? null,
      filters.memberId ?? null,
      filters.kind ?? null,
      filters.status ?? null,
      filters.includeCancelled === true
    ],
    queryFn: async () => {
      if (!householdId) return [];
      
      let query = supabase
        .from('transactions')
        .select(`
          *,
          account:accounts!account_id(*),
          to_account:accounts!to_account_id(*),
          category:categories(*),
          subcategory:subcategories(*),
          member:members!member_id(*),
          confirmed_by_member:members!confirmed_by(*),
          cancelled_by_member:members!cancelled_by(*)
        `)
        .eq('household_id', householdId)
        .order('due_date', { ascending: false })
        .order('created_at', { ascending: false });

      // Default: exclude cancelled unless explicitly requested
      if (filters.includeCancelled === true) {
        // Show all statuses including cancelled
        query = query.in('status', ['planned', 'confirmed', 'cancelled']);
      } else {
        // Default: only planned and confirmed, always exclude cancelled_at
        query = query.in('status', ['planned', 'confirmed']).is('cancelled_at', null);
      }

      // Special filter: single transaction by ID (ignores other filters)
      if (filters.singleTransactionId) {
        query = query.eq('id', filters.singleTransactionId);
      }
      // Special filter: overdue only (ignores month filter)
      else if (filters.overdueOnly) {
        const today = format(new Date(), 'yyyy-MM-dd');
        query = query
          .eq('status', 'planned')
          .eq('kind', 'EXPENSE')
          .lt('due_date', today);
      }
      // Special filter: due today only
      else if (filters.todayOnly) {
        const today = format(new Date(), 'yyyy-MM-dd');
        query = query
          .eq('status', 'planned')
          .eq('kind', 'EXPENSE')
          .eq('due_date', today);
      }
      // Special filter: due in next 7 days (excluding today and overdue)
      else if (filters.weekOnly) {
        const today = new Date();
        const tomorrow = format(addDays(today, 1), 'yyyy-MM-dd');
        const weekEnd = format(addDays(today, 7), 'yyyy-MM-dd');
        query = query
          .eq('status', 'planned')
          .eq('kind', 'EXPENSE')
          .gte('due_date', tomorrow)
          .lte('due_date', weekEnd);
      } else if (filters.month) {
        // effective_date = COALESCE(due_date, date)
        // Filter logic:
        // - If due_date exists, filter by due_date range
        // - If due_date is null, filter by date range
        const monthStart = format(startOfMonth(filters.month), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(filters.month), 'yyyy-MM-dd');
        query = query.or(
          `and(due_date.gte.${monthStart},due_date.lte.${monthEnd}),and(due_date.is.null,date.gte.${monthStart},date.lte.${monthEnd})`
        );
      }

      if (filters.accountId) {
        query = query.or(`account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`);
      }

      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      if (filters.subcategoryId) {
        query = query.eq('subcategory_id', filters.subcategoryId);
      }

      if (filters.memberId) {
        query = query.eq('member_id', filters.memberId);
      }

      if (filters.kind) {
        query = query.eq('kind', filters.kind);
      }

      // Additional status filter (if user selects specific status)
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      // Cast needed because members table no longer has user_id column (moved to member_identities)
      return data as unknown as Transaction[];
    },
    enabled: !!householdId,
    staleTime: 1000 * 60 * 2, // 2 minutes - transactions change frequently
    gcTime: 1000 * 60 * 10, // 10 minutes - keep in memory for quick access
  });

  const createTransaction = useMutation({
    mutationFn: async (transaction: {
      account_id: string;
      to_account_id?: string | null;
      category_id?: string | null;
      subcategory_id?: string | null;
      member_id?: string | null;
      kind: TransactionKind;
      amount: number;
      date: string;
      description?: string | null;
      status?: TransactionStatus;
      expense_type?: ExpenseType | null;
      due_date?: string | null;
      payment_method?: string | null;
      credit_card_id?: string | null;
      invoice_month?: string | null;
      household_id?: string;
    }) => {
      console.log("1. Entrei no onSubmit");
      
      // Usar household_id do transaction se disponível, senão usar do contexto
      const finalHouseholdId = (transaction as any).household_id || householdId;
      console.log("2. Household ID capturado:", finalHouseholdId);
      
      if (!finalHouseholdId) throw new Error('No household');

      // Guardrail: confirmed transactions cannot be future-dated (prevents current balance corruption)
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      if ((transaction.status ?? 'confirmed') === 'confirmed' && transaction.date > todayStr) {
        throw new Error('Transação confirmada não pode ter data futura.');
      }
      
      // Validate balance for TRANSFER
      if (transaction.kind === 'TRANSFER') {
        const { data: allTransactions, error: fetchError } = await supabase
          .from('transactions')
          .select('id, kind, amount, account_id, to_account_id, status, date, due_date, cancelled_at')
          .eq('household_id', householdId)
          .eq('status', 'confirmed')
          .is('cancelled_at', null);
        
        if (fetchError) throw fetchError;
        
        let sourceBalance = 0;
        allTransactions?.forEach(t => {
          const effectiveDate = (t.due_date ?? t.date) as string;
          if (effectiveDate && effectiveDate > todayStr) return;

          const amount = Number(t.amount);
          if (t.kind === 'INCOME' && t.account_id === transaction.account_id) {
            sourceBalance += amount;
          } else if (t.kind === 'EXPENSE' && t.account_id === transaction.account_id) {
            sourceBalance -= amount;
          } else if (t.kind === 'TRANSFER') {
            if (t.account_id === transaction.account_id) {
              sourceBalance -= amount;
            }
            if (t.to_account_id === transaction.account_id) {
              sourceBalance += amount;
            }
          }
        });
        
        if (sourceBalance < transaction.amount) {
          throw new Error('Saldo insuficiente para esta transferência.');
        }
      }
      
      // Determine status based on kind
      let status: TransactionStatus = 'confirmed';
      if (transaction.kind === 'INCOME' && transaction.status === 'planned') {
        status = 'planned';
      } else if (transaction.kind === 'EXPENSE' && transaction.status === 'planned') {
        status = 'planned';
      }
      
      const confirmed_at = status === 'confirmed' ? new Date().toISOString() : null;
      
      // Sprint 1 (Caixa): sempre ter due_date
      const due_date =
        transaction.kind === 'EXPENSE'
          ? (transaction.due_date || transaction.date)
          : transaction.date;
      
      // Sanitize amount: ensure it's a valid number (handles string inputs with comma/dot separators)
      let sanitizedAmount: number;
      const amountValue = transaction.amount;
      if (typeof amountValue === 'string') {
        // Remove spaces and normalize
        let cleaned = String(amountValue).trim().replace(/\s/g, '');
        
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
      } else if (typeof transaction.amount === 'number') {
        sanitizedAmount = isNaN(transaction.amount) ? 0 : transaction.amount;
      } else {
        throw new Error('Valor inválido. Por favor, insira um número válido.');
      }
      
      // Validate amount is positive
      if (sanitizedAmount <= 0) {
        throw new Error('O valor deve ser maior que zero.');
      }
      
      // Clean payload: remove undefined values and let DB trigger handle expense_type
      const cleanPayload: Record<string, unknown> = {
        household_id: finalHouseholdId,
        kind: transaction.kind,
        account_id: transaction.account_id,
        amount: sanitizedAmount,
        date: transaction.date,
        status,
        confirmed_at,
        due_date,
      };
      
      // Only add optional fields if they have valid values (not undefined)
      if (transaction.to_account_id !== undefined && transaction.to_account_id !== null) {
        cleanPayload.to_account_id = transaction.to_account_id;
      }
      if (transaction.category_id !== undefined && transaction.category_id !== null) {
        cleanPayload.category_id = transaction.category_id;
      }
      if (transaction.subcategory_id !== undefined && transaction.subcategory_id !== null) {
        cleanPayload.subcategory_id = transaction.subcategory_id;
      }
      if (transaction.member_id !== undefined && transaction.member_id !== null) {
        cleanPayload.member_id = transaction.member_id;
      }
      if (transaction.description !== undefined && transaction.description !== null && transaction.description !== '') {
        cleanPayload.description = transaction.description;
      }
      if (transaction.payment_method !== undefined && transaction.payment_method !== null) {
        cleanPayload.payment_method = transaction.payment_method;
      }
      if (transaction.credit_card_id !== undefined && transaction.credit_card_id !== null) {
        cleanPayload.credit_card_id = transaction.credit_card_id;
      }
      if (transaction.invoice_month !== undefined && transaction.invoice_month !== null) {
        cleanPayload.invoice_month = transaction.invoice_month;
      }
      // expense_type is now handled by DB trigger - only send if explicitly provided
      if (transaction.expense_type !== undefined && transaction.expense_type !== null) {
        cleanPayload.expense_type = transaction.expense_type;
      }
      
      // Debug log before sending to Supabase
      console.log('[Transaction Create] Payload:', cleanPayload);
      
      // ARQUITETURA RPC: Substituição do INSERT direto por RPC segura
      console.log("⚡ Iniciando salvamento via RPC Seguro...");
      
      // RPC será criada no banco - usando type assertion temporário
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('create_transaction_secure', {
        p_account_id: transaction.account_id,
        p_category_id: transaction.category_id || null,
        p_amount: sanitizedAmount,
        p_date: transaction.date,
        p_description: transaction.description || null,
        p_kind: transaction.kind,
        p_payment_method: transaction.kind === 'INCOME' ? null : transaction.payment_method || null,
        p_to_account_id: transaction.to_account_id || null,
        p_subcategory_id: transaction.subcategory_id || null,
        p_member_id: transaction.member_id || null,
        p_status: status || 'confirmed',
        p_expense_type: transaction.expense_type || null,
        p_due_date: due_date || null,
        p_credit_card_id: transaction.credit_card_id || null,
        p_invoice_month: transaction.invoice_month || null,
      });

      if (rpcError) {
        console.error("❌ Erro na RPC:", rpcError);
        throw rpcError;
      }
      console.log("✅ Transação salva com sucesso via RPC:", rpcData);
      
      // Retornar dados da RPC (que já contém o registro completo)
      return rpcData as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Transação registrada!');
    },
    onError: (error, variables) => {
      toast.error(getFriendlyErrorMessage(error, variables));
    }
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Transaction> & { id: string }) => {
      // Sanitize amount if present in updates
      const sanitizedUpdates = { ...updates };
      if ('amount' in updates && updates.amount !== undefined) {
        let sanitizedAmount: number;
        const amountValue = updates.amount as string | number;
        if (typeof amountValue === 'string') {
          // Remove spaces and normalize
          let cleaned = amountValue.trim().replace(/\s/g, '');
          
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
      console.log('[Transaction Update] Payload:', { id, ...sanitizedUpdates });
      
      const { data, error } = await supabase
        .from('transactions')
        .update(sanitizedUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('[Transaction Update Error]', { error, payload: sanitizedUpdates });
        throw error;
      }
      
      // If due_date was updated, recalculate payment delayed notifications
      // This handles the case where an overdue transaction's due date is moved to the future
      if (updates.due_date !== undefined) {
        await updatePaymentDelayedNotification(id);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Transação atualizada!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Helper to update/archive PAYMENT_DELAYED notification after transaction is confirmed/cancelled
  // Since notifications are grouped with reference_id='overdue_payments', we need to recalculate
  const updatePaymentDelayedNotification = async (confirmedTransactionId: string) => {
    if (!householdId) return;
    
    try {
      const today = startOfDay(new Date());
      
      // Fetch remaining overdue transactions (excluding the one just confirmed)
      const { data: remainingOverdue } = await supabase
        .from('transactions')
        .select(`
          id,
          description,
          due_date,
          category:categories(name),
          subcategory:subcategories(name)
        `)
        .eq('household_id', householdId)
        .eq('status', 'planned')
        .eq('kind', 'EXPENSE')
        .is('cancelled_at', null)
        .neq('id', confirmedTransactionId)
        .lt('due_date', format(today, 'yyyy-MM-dd'));
      
      const overdueTransactions = remainingOverdue || [];
      
      if (overdueTransactions.length === 0) {
        // No more overdue transactions - archive the notification
        await supabase
          .from('notifications')
          .update({ dismissed_at: new Date().toISOString() })
          .eq('household_id', householdId)
          .eq('event_type', 'PAYMENT_DELAYED')
          .eq('reference_id', 'overdue_payments')
          .is('dismissed_at', null);
      } else {
        // Still have overdue transactions - update the notification
        const overdueDetails = overdueTransactions.map(t => {
          const dueDate = parseISO(t.due_date!);
          const daysOverdue = differenceInDays(today, dueDate);
          return {
            id: t.id,
            description: t.description || '',
            daysOverdue,
            subcategoryName: (t.subcategory as any)?.name,
            categoryName: (t.category as any)?.name,
          };
        });
        
        const count = overdueDetails.length;
        const maxDaysOverdue = Math.max(...overdueDetails.map(t => t.daysOverdue));
        const transactionIds = overdueDetails.map(t => t.id);
        
        // Build updated message
        let message: string;
        let title: string;
        
        if (count === 1) {
          const tx = overdueDetails[0];
          const daysText = tx.daysOverdue === 1 ? '1 dia' : `${tx.daysOverdue} dias`;
          if (tx.subcategoryName && tx.categoryName) {
            message = `${tx.subcategoryName} – ${tx.categoryName} venceu há ${daysText}.`;
          } else if (tx.categoryName) {
            message = `${tx.categoryName} venceu há ${daysText}.`;
          } else {
            message = `${tx.description} venceu há ${daysText}.`;
          }
          title = maxDaysOverdue > 7 ? 'Conta muito atrasada' : 'Conta vencida';
        } else {
          const daysText = maxDaysOverdue === 1 ? '1 dia' : `${maxDaysOverdue} dias`;
          message = `${count} contas vencidas. A mais antiga venceu há ${daysText}.`;
          title = maxDaysOverdue > 7 ? 'Contas muito atrasadas' : 'Contas vencidas';
        }
        
        const type = maxDaysOverdue > 7 ? 'action' : 'warning';
        
        const metadata: NotificationMetadata = {
          count,
          maxDaysOverdue,
          transactionIds,
        };
        
        const cta_target = count === 1 
          ? `/transactions?highlight=${transactionIds[0]}` 
          : '/transactions?filter=overdue';
        
        // Update the existing notification
        await supabase
          .from('notifications')
          .update({ 
            message,
            title,
            type,
            metadata: JSON.parse(JSON.stringify(metadata)),
            cta_target,
            read_at: null, // Reset read status
          })
          .eq('household_id', householdId)
          .eq('event_type', 'PAYMENT_DELAYED')
          .eq('reference_id', 'overdue_payments')
          .is('dismissed_at', null);
      }
    } catch {
      // Silently ignore - notification update is not critical
    }
  };

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .update({ 
          status: 'cancelled', 
          cancelled_at: new Date().toISOString(),
          cancelled_by: member?.id || null
        })
        .eq('id', id);
      
      if (error) throw error;
      
      // Update PAYMENT_DELAYED notification (recalculate remaining overdue)
      await updatePaymentDelayedNotification(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Transação cancelada!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Confirm a planned income transaction
  const confirmTransaction = useMutation({
    mutationFn: async (id: string) => {
      // First get the transaction to know kind and amount for the toast
      const { data: txData, error: fetchError } = await supabase
        .from('transactions')
        .select('kind, amount')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const { data, error } = await supabase
        .from('transactions')
        .update({ 
          status: 'confirmed', 
          confirmed_at: new Date().toISOString(),
          confirmed_by: member?.id || null
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update PAYMENT_DELAYED notification (recalculate remaining overdue)
      await updatePaymentDelayedNotification(id);
      
      return { ...data, originalKind: txData.kind, originalAmount: txData.amount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      const amount = Number(data.originalAmount);
      const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(amount);
      
      if (data.originalKind === 'EXPENSE') {
        toast.success(`Conta paga! A pagar reduzido em ${formattedAmount}`);
      } else {
        toast.success(`Receita confirmada! +${formattedAmount}`);
      }
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Confirm all planned incomes for the current month
  const confirmAllPlannedIncomes = useMutation({
    mutationFn: async (month: Date) => {
      if (!householdId) throw new Error('No household');
      
      const start = format(startOfMonth(month), 'yyyy-MM-dd');
      const endExclusive = format(addDays(endOfMonth(month), 1), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('transactions')
        .update({ 
          status: 'confirmed', 
          confirmed_at: new Date().toISOString(),
          confirmed_by: member?.id || null
        })
        .eq('household_id', householdId)
        .eq('kind', 'INCOME')
        .eq('status', 'planned')
        .gte('due_date', start)
        .lt('due_date', endExclusive)
        .select();
      
      if (error) throw error;
      
      // Update notification for last confirmed transaction (recalculates all)
      if (data && data.length > 0) {
        await updatePaymentDelayedNotification(data[data.length - 1].id);
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      const count = data?.length || 0;
      toast.success(`${count} receita(s) confirmada(s)!`);
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Confirm all planned expenses (fixed) for the current month
  const confirmAllPlannedExpenses = useMutation({
    mutationFn: async (month: Date) => {
      if (!householdId) throw new Error('No household');
      
      const start = format(startOfMonth(month), 'yyyy-MM-dd');
      const endExclusive = format(addDays(endOfMonth(month), 1), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('transactions')
        .update({ 
          status: 'confirmed', 
          confirmed_at: new Date().toISOString(),
          confirmed_by: member?.id || null
        })
        .eq('household_id', householdId)
        .eq('kind', 'EXPENSE')
        .eq('status', 'planned')
        .gte('due_date', start)
        .lt('due_date', endExclusive)
        .select();
      
      if (error) throw error;
      
      // Update notification for last confirmed transaction (recalculates all)
      if (data && data.length > 0) {
        await updatePaymentDelayedNotification(data[data.length - 1].id);
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      const count = data?.length || 0;
      const totalAmount = data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(totalAmount);
      toast.success(`${count} conta(s) paga(s)! A pagar reduzido em ${formattedAmount}`);
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Get upcoming due expenses (planned fixed expenses with due_date)
  const getUpcomingDueExpenses = (daysAhead: number = 7) => {
    const today = startOfDay(new Date());
    const endDate = addDays(today, daysAhead);
    
    return transactions.filter(t => {
      if (t.kind !== 'EXPENSE' || t.status !== 'planned' || t.expense_type !== 'fixed' || !t.due_date) {
        return false;
      }
      const dueDate = parseISO(t.due_date);
      return isWithinInterval(dueDate, { start: today, end: endDate });
    }).sort((a, b) => {
      const dateA = parseISO(a.due_date!);
      const dateB = parseISO(b.due_date!);
      return dateA.getTime() - dateB.getTime();
    });
  };

  // Calculate monthly stats using shared metrics
  const monthlyStats = (() => {
    const month = filters.month || new Date();
    const metrics = calculateMonthlyMetrics(transactions, month);
    
    return {
      // Realized values - only confirmed
      incomeRealized: metrics.incomeRealized,
      expensesRealized: metrics.expenseRealized,
      balanceRealized: metrics.saldoMes,
      
      // Planned income (future)
      incomePlanned: metrics.incomePlanned,
      plannedIncomeCount: metrics.plannedIncomeCount,
      
      // Planned expenses (a pagar)
      expensesPlanned: metrics.aPagarMes,
      plannedExpenseCount: metrics.plannedExpenseCount,
      
      // Total including forecast
      incomeTotal: metrics.incomeRealized + metrics.incomePlanned,
      expensesTotal: metrics.expenseRealized + metrics.aPagarMes,
      balanceForecast: metrics.saldoPrevistoMes,
      
      // Legacy compatibility
      income: metrics.incomeRealized,
      expenses: metrics.expenseRealized,
      balance: metrics.saldoMes,
      
      // Combined planned count
      plannedCount: metrics.plannedIncomeCount + metrics.plannedExpenseCount,
    };
  })();

  return {
    transactions,
    isLoading,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    confirmTransaction,
    confirmAllPlannedIncomes,
    confirmAllPlannedExpenses,
    getUpcomingDueExpenses,
    monthlyStats
  };
}

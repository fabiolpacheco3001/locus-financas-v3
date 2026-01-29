import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CreditCard, calculateInvoiceMonth } from '@/types/creditCards';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface CreditCardWithUsage extends CreditCard {
  current_invoice_amount: number;
  available_limit: number;
  current_invoice_month?: string; // The open invoice month (YYYY-MM)
  total_liability: number; // Sum of ALL unpaid invoices (closed + open)
}

interface CreateCreditCardData {
  name: string;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  color?: string;
  brand?: string | null;
}

interface UpdateCreditCardData {
  id: string;
  name?: string;
  limit_amount?: number;
  closing_day?: number;
  due_day?: number;
  color?: string;
  brand?: string | null;
  is_active?: boolean;
}

export function useCreditCards(selectedMonth?: Date) {
  const { householdId } = useAuth();
  const queryClient = useQueryClient();
  
  // Reference month for invoice calculation
  const referenceMonth = selectedMonth || new Date();

  // Fetch credit cards with current invoice usage
  const { data: creditCards = [], isLoading } = useQuery({
    queryKey: ['credit_cards', householdId, format(referenceMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (!householdId) return [];

      // Fetch credit cards
      const { data: cards, error: cardsError } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('name');

      if (cardsError) throw cardsError;

      if (!cards || cards.length === 0) return [];

      // For each card, calculate its OPEN invoice month based on today's date and closing day
      // The open invoice is where NEW purchases would go
      const today = new Date();
      const openInvoiceMonths = (cards as CreditCard[]).map(card => 
        calculateInvoiceMonth(today, card.closing_day)
      );

      // Get unique invoice months to query
      const uniqueInvoiceMonths = [...new Set(openInvoiceMonths)];

      // Fetch ALL transactions for credit cards (no month filter - for total liability)
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('credit_card_id, amount, status, invoice_month')
        .eq('household_id', householdId)
        .not('credit_card_id', 'is', null)
        .not('invoice_month', 'is', null)
        .in('status', ['planned', 'confirmed'])
        .is('cancelled_at', null);

      if (txError) throw txError;

      // Calculate usage per card
      return (cards as CreditCard[]).map((card, index) => {
        const cardOpenInvoice = openInvoiceMonths[index];
        
        // Current invoice = only transactions for the open invoice month
        const currentInvoiceUsage = transactions
          ?.filter(tx => tx.credit_card_id === card.id && tx.invoice_month === cardOpenInvoice)
          .reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

        // Total liability = ALL transactions for closed + open invoices (exclude future)
        // Future invoices are those AFTER the open invoice month
        const totalLiability = transactions
          ?.filter(tx => {
            if (tx.credit_card_id !== card.id) return false;
            const txMonth = tx.invoice_month as string;
            // Include only closed (past) + open invoices, exclude future
            return txMonth <= cardOpenInvoice;
          })
          .reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

        return {
          ...card,
          current_invoice_amount: currentInvoiceUsage,
          available_limit: Number(card.limit_amount) - totalLiability, // Available = limit - total debt
          current_invoice_month: cardOpenInvoice,
          total_liability: totalLiability,
        };
      }) as CreditCardWithUsage[];
    },
    enabled: !!householdId,
  });

  // Create credit card
  const createCreditCard = useMutation({
    mutationFn: async (data: CreateCreditCardData) => {
      if (!householdId) throw new Error('No household');

      const { data: result, error } = await supabase
        .from('credit_cards')
        .insert({
          ...data,
          household_id: householdId,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_cards'] });
      toast.success('Cartão cadastrado com sucesso!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    },
  });

  // Update credit card
  const updateCreditCard = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateCreditCardData) => {
      const { data, error } = await supabase
        .from('credit_cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_cards'] });
      toast.success('Cartão atualizado!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    },
  });

  // Delete credit card (soft delete by setting is_active = false)
  const deleteCreditCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('credit_cards')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_cards'] });
      toast.success('Cartão removido!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    },
  });

  // Get invoice summary for a specific card and month
  const getCardInvoice = async (cardId: string, month: string) => {
    if (!householdId) return null;

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        category:categories(*),
        subcategory:subcategories(*)
      `)
      .eq('household_id', householdId)
      .eq('credit_card_id', cardId)
      .eq('invoice_month', month)
      .in('status', ['planned', 'confirmed'])
      .is('cancelled_at', null)
      .order('date', { ascending: true });

    if (error) throw error;
    return data;
  };

  return {
    creditCards,
    isLoading,
    createCreditCard,
    updateCreditCard,
    deleteCreditCard,
    getCardInvoice,
    calculateInvoiceMonth,
  };
}

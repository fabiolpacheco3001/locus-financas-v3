import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentMethod } from '@/types/creditCards';

export interface LastCategoryDefaults {
  accountId: string;
  paymentMethod: PaymentMethod;
  creditCardId?: string;
}

/**
 * Fetches the last transaction for a given category to provide smart defaults.
 * This enables "quick input" by auto-filling account and payment method based on history.
 */
export function useLastCategoryTransaction(categoryId: string | undefined) {
  const { householdId } = useAuth();

  const query = useQuery({
    queryKey: ['last-category-transaction', householdId, categoryId],
    queryFn: async (): Promise<LastCategoryDefaults | null> => {
      if (!householdId || !categoryId) return null;

      const { data, error } = await supabase
        .from('transactions')
        .select('account_id, payment_method, credit_card_id')
        .eq('household_id', householdId)
        .eq('category_id', categoryId)
        .eq('kind', 'EXPENSE')
        .is('cancelled_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      return {
        accountId: data.account_id,
        paymentMethod: (data.payment_method as PaymentMethod) || 'debit',
        creditCardId: data.credit_card_id || undefined,
      };
    },
    enabled: !!householdId && !!categoryId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    defaults: query.data ?? null,
    isLoading: query.isLoading,
  };
}

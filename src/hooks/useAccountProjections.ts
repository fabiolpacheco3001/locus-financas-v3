import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { format, endOfMonth } from 'date-fns';
import { Account, Transaction } from '@/types/finance';
import { 
  computeUnifiedAccountMetrics, 
  AccountForMetrics,
  UnifiedAccountMetrics,
  UnifiedTotals,
  PendingTransactionDetail 
} from '@/domain/finance/computeUnifiedMetrics';

// Re-export types for backward compatibility
export type { PendingTransactionDetail };

export interface AccountProjection extends UnifiedAccountMetrics {
  // Alias for backward compatibility with ProjectionDrawer
  account: Account & { calculated_balance?: number };
}

export function useAccountProjections(selectedMonth: Date) {
  const { householdId } = useAuth();
  const endOfSelectedMonth = endOfMonth(selectedMonth);

  const { data, isLoading } = useQuery({
    queryKey: ['account-projections', householdId, format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (!householdId) return { accounts: [], transactions: [] };

      // Fetch active accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('type')
        .order('name');

      if (accountsError) throw accountsError;

      // Fetch all non-cancelled transactions with category/subcategory info
      // Using range to bypass Supabase's 1000 row default limit
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          *,
          category:categories(name),
          subcategory:subcategories(name)
        `)
        .eq('household_id', householdId)
        .in('status', ['planned', 'confirmed'])
        .is('cancelled_at', null)
        .range(0, 9999);

      if (transactionsError) throw transactionsError;

      return {
        accounts: accountsData as Account[],
        transactions: transactionsData as unknown as (Transaction & { 
          category: { name: string } | null;
          subcategory: { name: string } | null;
        })[],
      };
    },
    enabled: !!householdId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes to reduce DB calls
  });

  const { projections, totals } = useMemo(() => {
    if (!data?.accounts || !data?.transactions) {
      return { 
        projections: [] as AccountProjection[], 
        totals: {
          realizedBalance: 0,
          projectedBalance: 0,
          pendingIncome: 0,
          pendingExpenses: 0,
          reserveRealizedBalance: 0,
          reserveProjectedBalance: 0,
          reservePendingIncome: 0,
          reservePendingExpenses: 0,
          availableRealizedBalance: 0,
          availableProjectedBalance: 0,
          availablePendingIncome: 0,
          availablePendingExpenses: 0,
        } as UnifiedTotals
      };
    }

    const { accounts, transactions } = data;
    
    // Convert accounts to AccountForMetrics format
    const accountsForMetrics: AccountForMetrics[] = accounts.map(a => ({
      id: a.id,
      is_reserve: a.is_reserve,
      is_active: a.is_active,
      name: a.name,
      type: a.type,
      current_balance: a.current_balance,
      initial_balance: a.initial_balance,
    }));
    
    // Use unified calculation
    const result = computeUnifiedAccountMetrics(transactions, accountsForMetrics, selectedMonth);
    
    // Map back to AccountProjection format for backward compatibility
    const mappedProjections: AccountProjection[] = result.projections.map(p => {
      const originalAccount = accounts.find(a => a.id === p.account.id)!;
      return {
        ...p,
        account: {
          ...originalAccount,
          calculated_balance: p.realizedBalance,
        },
      };
    });
    
    return { projections: mappedProjections, totals: result.totals };
  }, [data, selectedMonth]);

  // Accounts with negative projected balance
  const negativeProjectedAccounts = projections.filter((p) => p.isNegativeProjected);

  return {
    projections,
    negativeProjectedAccounts,
    totals,
    isLoading,
    endOfSelectedMonth,
  };
}

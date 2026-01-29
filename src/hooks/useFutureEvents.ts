import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addMonths, startOfDay, format, startOfMonth } from 'date-fns';

export interface FutureEventMonth {
  month: string; // YYYY-MM format
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
}

export function useFutureEvents() {
  const { householdId } = useAuth();
  
  const today = startOfDay(new Date());
  const sixMonthsFromNow = addMonths(today, 6);

  const { data, isLoading, error } = useQuery({
    queryKey: ['future-events', householdId],
    queryFn: async () => {
      if (!householdId) return [];

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('due_date, kind, amount')
        .eq('household_id', householdId)
        .in('status', ['planned', 'confirmed'])
        .is('cancelled_at', null)
        .gt('due_date', format(today, 'yyyy-MM-dd'))
        .lt('due_date', format(sixMonthsFromNow, 'yyyy-MM-dd'));

      if (error) throw error;

      // Group by month and calculate totals
      const monthlyTotals = new Map<string, { income: number; expense: number }>();

      transactions?.forEach((t) => {
        if (!t.due_date) return;
        
        const monthKey = format(startOfMonth(new Date(t.due_date)), 'yyyy-MM');
        const current = monthlyTotals.get(monthKey) || { income: 0, expense: 0 };
        const amount = Number(t.amount);

        if (t.kind === 'INCOME') {
          current.income += amount;
        } else if (t.kind === 'EXPENSE') {
          current.expense += amount;
        }

        monthlyTotals.set(monthKey, current);
      });

      // Convert to array and sort by month
      const result: FutureEventMonth[] = Array.from(monthlyTotals.entries())
        .map(([month, totals]) => ({
          month,
          totalIncome: totals.income,
          totalExpense: totals.expense,
          netAmount: totals.income - totals.expense,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return result;
    },
    enabled: !!householdId,
  });

  // Calculate grand totals
  const totals = data?.reduce(
    (acc, month) => ({
      totalIncome: acc.totalIncome + month.totalIncome,
      totalExpense: acc.totalExpense + month.totalExpense,
      netAmount: acc.netAmount + month.netAmount,
    }),
    { totalIncome: 0, totalExpense: 0, netAmount: 0 }
  ) || { totalIncome: 0, totalExpense: 0, netAmount: 0 };

  return {
    futureEvents: data || [],
    totals,
    isLoading,
    error,
  };
}

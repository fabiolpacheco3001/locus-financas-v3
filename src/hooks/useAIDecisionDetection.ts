import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subMonths, parseISO, startOfMonth, differenceInDays } from 'date-fns';
import { Transaction } from '@/types/finance';

// Regra 01: Conta vencida recorrente
export interface RecurringLatePaymentPattern {
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  lateOccurrences: number;
  totalOccurrences: number;
  averageDaysLate: number;
  referenceKey: string; // category_id + subcategory_id for dedup
}

// Regra 02: Despesa recorrente não registrada
export interface MissingRecurringExpensePattern {
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  averageAmount: number;
  lastMonths: string[]; // YYYY-MM of occurrences
  referenceKey: string;
}

interface UseAIDecisionDetectionProps {
  transactions: Transaction[];
  selectedMonth: Date;
  enabled?: boolean;
}

interface CategorySubcategoryGroup {
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  transactions: Transaction[];
}

export function useAIDecisionDetection({
  transactions,
  selectedMonth,
  enabled = true,
}: UseAIDecisionDetectionProps) {
  const { householdId } = useAuth();
  
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonthStr = format(selectedMonth, 'yyyy-MM');

  // Fetch historical transactions (last 6 months) for pattern detection
  const { data: historicalTransactions } = useQuery({
    queryKey: ['ai-decision-history', householdId, currentMonthStr],
    queryFn: async () => {
      if (!householdId) return [];

      const sixMonthsAgo = subMonths(today, 6);
      const startDate = format(startOfMonth(sixMonthsAgo), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          description,
          amount,
          date,
          due_date,
          status,
          kind,
          expense_type,
          confirmed_at,
          category_id,
          subcategory_id,
          category:categories(id, name),
          subcategory:subcategories(id, name)
        `)
        .eq('household_id', householdId)
        .eq('kind', 'EXPENSE')
        .in('status', ['planned', 'confirmed'])
        .is('cancelled_at', null)
        .gte('date', startDate)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching historical transactions:', error);
        return [];
      }

      return data || [];
    },
    enabled: enabled && !!householdId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Group transactions by category + subcategory
  const groupByCategory = useCallback((txs: any[]): CategorySubcategoryGroup[] => {
    const groups = new Map<string, CategorySubcategoryGroup>();

    for (const tx of txs) {
      const key = `${tx.category_id || 'null'}_${tx.subcategory_id || 'null'}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          categoryId: tx.category_id,
          categoryName: tx.category?.name || 'Sem categoria',
          subcategoryId: tx.subcategory_id,
          subcategoryName: tx.subcategory?.name || null,
          transactions: [],
        });
      }
      
      groups.get(key)!.transactions.push(tx);
    }

    return Array.from(groups.values());
  }, []);

  // ========================================
  // REGRA 01 — CONTA VENCIDA RECORRENTE
  // ========================================
  const recurringLatePayments = useMemo((): RecurringLatePaymentPattern[] => {
    if (!historicalTransactions || historicalTransactions.length === 0) return [];

    const patterns: RecurringLatePaymentPattern[] = [];
    
    // Only consider fixed expenses
    const fixedExpenses = historicalTransactions.filter(
      (tx: any) => tx.expense_type === 'fixed'
    );

    const groups = groupByCategory(fixedExpenses);

    // Check last 3 months
    const month1 = format(subMonths(today, 1), 'yyyy-MM');
    const month2 = format(subMonths(today, 2), 'yyyy-MM');
    const month3 = format(subMonths(today, 3), 'yyyy-MM');
    const recentMonths = [month1, month2, month3];

    for (const group of groups) {
      if (!group.categoryId) continue;

      // Get transactions in the last 3 months
      const recentTxs = group.transactions.filter((tx: any) => {
        const txMonth = tx.date.substring(0, 7);
        return recentMonths.includes(txMonth);
      });

      // Group by month to check occurrences
      const monthlyOccurrences = new Map<string, any[]>();
      for (const tx of recentTxs) {
        const month = tx.date.substring(0, 7);
        if (!monthlyOccurrences.has(month)) {
          monthlyOccurrences.set(month, []);
        }
        monthlyOccurrences.get(month)!.push(tx);
      }

      // Must have occurred in at least 2 of the last 3 months
      if (monthlyOccurrences.size < 2) continue;

      // Check if ALL occurrences were late (confirmed after due date)
      let allLate = true;
      let totalDaysLate = 0;
      let lateCount = 0;

      for (const [, txs] of monthlyOccurrences) {
        for (const tx of txs) {
          // Only check confirmed transactions
          if (tx.status !== 'confirmed') continue;
          
          const dueDate = tx.due_date || tx.date;
          const confirmedAt = tx.confirmed_at;
          
          if (!confirmedAt) continue;

          const dueDateParsed = parseISO(dueDate);
          const confirmedDateParsed = parseISO(confirmedAt);
          
          const daysLate = differenceInDays(confirmedDateParsed, dueDateParsed);
          
          if (daysLate >= 1) {
            lateCount++;
            totalDaysLate += daysLate;
          } else {
            allLate = false;
          }
        }
      }

      // Must have at least 2 late occurrences and ALL must be late
      if (lateCount < 2 || !allLate) continue;

      patterns.push({
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        subcategoryId: group.subcategoryId,
        subcategoryName: group.subcategoryName,
        lateOccurrences: lateCount,
        totalOccurrences: monthlyOccurrences.size,
        averageDaysLate: Math.round(totalDaysLate / lateCount),
        referenceKey: `recurring_late_${group.categoryId}_${group.subcategoryId || 'null'}`,
      });
    }

    return patterns;
  }, [historicalTransactions, groupByCategory, today]);

  // ========================================
  // REGRA 02 — DESPESA RECORRENTE NÃO REGISTRADA
  // ========================================
  const missingRecurringExpenses = useMemo((): MissingRecurringExpensePattern[] => {
    if (!historicalTransactions || historicalTransactions.length === 0) return [];
    
    // Only check after day 10 of the month
    if (currentDay < 10) return [];

    const patterns: MissingRecurringExpensePattern[] = [];
    
    const groups = groupByCategory(historicalTransactions);

    // Check last 3 months (not including current)
    const month1 = format(subMonths(today, 1), 'yyyy-MM');
    const month2 = format(subMonths(today, 2), 'yyyy-MM');
    const month3 = format(subMonths(today, 3), 'yyyy-MM');
    const lastThreeMonths = [month1, month2, month3];

    for (const group of groups) {
      if (!group.categoryId) continue;

      // Get transactions in the last 3 months (not current)
      const historicalTxs = group.transactions.filter((tx: any) => {
        const txMonth = tx.date.substring(0, 7);
        return lastThreeMonths.includes(txMonth);
      });

      // Must have occurred in all 3 months
      const monthsWithExpense = new Set(
        historicalTxs.map((tx: any) => tx.date.substring(0, 7))
      );
      
      if (monthsWithExpense.size < 3) continue;

      // Check if exists in current month
      const currentMonthTxs = group.transactions.filter((tx: any) => {
        const txMonth = tx.date.substring(0, 7);
        return txMonth === currentMonthStr;
      });

      // If already registered this month, skip
      if (currentMonthTxs.length > 0) continue;

      // Calculate average amount and check variation <= 20%
      const amounts = historicalTxs.map((tx: any) => Number(tx.amount));
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const minAmount = Math.min(...amounts);
      const maxAmount = Math.max(...amounts);
      
      // Check if variation is <= 20%
      const variation = (maxAmount - minAmount) / avgAmount;
      if (variation > 0.20) continue;

      patterns.push({
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        subcategoryId: group.subcategoryId,
        subcategoryName: group.subcategoryName,
        averageAmount: avgAmount,
        lastMonths: Array.from(monthsWithExpense).sort().reverse(),
        referenceKey: `missing_recurring_${group.categoryId}_${group.subcategoryId || 'null'}`,
      });
    }

    return patterns;
  }, [historicalTransactions, groupByCategory, currentDay, currentMonthStr, today]);

  // Check if current month transactions resolve a missing expense pattern
  const checkMissingExpenseResolved = useCallback((categoryId: string, subcategoryId: string | null): boolean => {
    return transactions.some(tx => 
      tx.category_id === categoryId && 
      tx.subcategory_id === subcategoryId &&
      tx.kind === 'EXPENSE' &&
      tx.status !== 'cancelled'
    );
  }, [transactions]);

  // Check if recurring late pattern is resolved (paid on time this month)
  const checkLatePaymentResolved = useCallback((categoryId: string, subcategoryId: string | null): boolean => {
    const currentMonthTxs = transactions.filter(tx => 
      tx.category_id === categoryId && 
      tx.subcategory_id === subcategoryId &&
      tx.kind === 'EXPENSE' &&
      tx.expense_type === 'fixed' &&
      tx.status === 'confirmed'
    );

    for (const tx of currentMonthTxs) {
      const dueDate = tx.due_date || tx.date;
      const confirmedAt = tx.confirmed_at;
      
      if (!confirmedAt) continue;
      
      const dueDateParsed = parseISO(dueDate);
      const confirmedDateParsed = parseISO(confirmedAt);
      
      // Paid on time or early
      if (differenceInDays(confirmedDateParsed, dueDateParsed) < 1) {
        return true;
      }
    }

    return false;
  }, [transactions]);

  return {
    recurringLatePayments,
    missingRecurringExpenses,
    checkMissingExpenseResolved,
    checkLatePaymentResolved,
    isLoading: !historicalTransactions,
  };
}

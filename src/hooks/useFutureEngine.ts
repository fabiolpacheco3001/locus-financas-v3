/**
 * useFutureEngine - Hook for end-of-month balance projection
 * 
 * Fetches historical data, computes projections, and returns memoized results.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  computeFutureEngine, 
  calculateDaysElapsed,
  calculateDaysRemaining,
  type FutureEngineResult 
} from '@/domain/finance/computeFutureEngine';
import { 
  startOfMonth, 
  subMonths, 
  endOfMonth, 
  getDaysInMonth, 
  format,
  isSameMonth
} from 'date-fns';

// ============================================
// TYPES
// ============================================

export interface UseFutureEngineOptions {
  /** Currently selected month */
  selectedMonth: Date;
  
  /** Current available balance (from useAccountProjections) */
  currentBalance: number;
  
  /** Pending fixed expenses for the month */
  pendingFixedExpenses: number;
  
  /** Confirmed variable expenses this month */
  confirmedVariableThisMonth: number;
}

export interface UseFutureEngineResult extends FutureEngineResult {
  /** Is data still loading */
  isLoading: boolean;
  
  /** Historical average of variable expenses (3 months) */
  historicalVariableAvg: number;
  
  /** Number of historical months with data */
  historicalMonthsCount: number;
}

// ============================================
// HOOK
// ============================================

export function useFutureEngine(options: UseFutureEngineOptions): UseFutureEngineResult {
  const { selectedMonth, currentBalance, pendingFixedExpenses, confirmedVariableThisMonth } = options;
  const { householdId } = useAuth();

  // Calculate date range for historical query (last 3 months, excluding current)
  const historicalRange = useMemo(() => {
    const endDate = endOfMonth(subMonths(selectedMonth, 1));
    const startDate = startOfMonth(subMonths(selectedMonth, 3));
    return {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
    };
  }, [selectedMonth]);

  // Fetch historical variable expenses (last 3 months)
  const { data: historicalData, isLoading } = useQuery({
    queryKey: ['future-engine-history', householdId, historicalRange.start, historicalRange.end],
    queryFn: async () => {
      if (!householdId) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select('id, amount, date, status, expense_type')
        .eq('household_id', householdId)
        .eq('kind', 'EXPENSE')
        .eq('status', 'confirmed')
        .eq('expense_type', 'variable')
        .gte('date', historicalRange.start)
        .lte('date', historicalRange.end)
        .is('cancelled_at', null);

      if (error) {
        console.error('Error fetching historical data:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!householdId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Calculate historical average
  const { historicalVariableAvg, historicalMonthsCount } = useMemo(() => {
    if (!historicalData || historicalData.length === 0) {
      return { historicalVariableAvg: 0, historicalMonthsCount: 0 };
    }

    // Group by month and calculate totals
    const monthlyTotals: Record<string, number> = {};
    
    historicalData.forEach((tx) => {
      const monthKey = tx.date.substring(0, 7); // YYYY-MM
      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = 0;
      }
      monthlyTotals[monthKey] += Number(tx.amount);
    });

    const months = Object.keys(monthlyTotals);
    const totalVariable = Object.values(monthlyTotals).reduce((sum, val) => sum + val, 0);
    const avgVariable = months.length > 0 ? totalVariable / months.length : 0;

    return {
      historicalVariableAvg: avgVariable,
      historicalMonthsCount: months.length,
    };
  }, [historicalData]);

  // Calculate time-based inputs
  const { daysElapsed, daysInMonth, daysRemaining } = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = isSameMonth(selectedMonth, today);
    
    const totalDays = getDaysInMonth(selectedMonth);
    
    if (!isCurrentMonth) {
      // For past/future months, show full month projection
      return {
        daysElapsed: totalDays,
        daysInMonth: totalDays,
        daysRemaining: 0,
      };
    }

    return {
      daysElapsed: calculateDaysElapsed(selectedMonth, today),
      daysInMonth: totalDays,
      daysRemaining: calculateDaysRemaining(selectedMonth, today),
    };
  }, [selectedMonth]);

  // Compute future engine projection
  const projection = useMemo(() => {
    return computeFutureEngine({
      currentBalance,
      pendingFixedExpenses,
      confirmedVariableThisMonth,
      historicalVariableAvg,
      daysElapsed,
      daysInMonth,
    });
  }, [
    currentBalance,
    pendingFixedExpenses,
    confirmedVariableThisMonth,
    historicalVariableAvg,
    daysElapsed,
    daysInMonth,
  ]);

  return {
    ...projection,
    isLoading,
    historicalVariableAvg,
    historicalMonthsCount,
    daysRemaining,
  };
}

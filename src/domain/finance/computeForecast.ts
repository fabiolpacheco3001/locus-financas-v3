/**
 * computeForecast - Pure function to derive forecast state from snapshot
 * 
 * PURE FUNCTION - No side effects, deterministic
 */

import { MonthlySnapshot, ForecastState, BalanceState } from './types';
import { differenceInDays, endOfMonth, startOfMonth, startOfDay } from 'date-fns';
import { logger } from './logger';

/**
 * Compute forecast state from a monthly snapshot
 * 
 * @param snapshot - The monthly snapshot
 * @param referenceDate - The date to calculate from (defaults to today)
 * @returns ForecastState with risk indicators
 */
export function computeForecast(
  snapshot: MonthlySnapshot,
  referenceDate: Date = new Date()
): ForecastState {
  const today = startOfDay(referenceDate);
  const { saldoPrevistoMes, expensePlanned, month } = snapshot;
  
  const isNegative = saldoPrevistoMes < 0;
  const riskAmount = isNegative ? Math.abs(saldoPrevistoMes) : 0;
  const balanceState: BalanceState = isNegative ? 'NEGATIVE' : 'NON_NEGATIVE';
  
  // Time calculations
  const monthEnd = endOfMonth(month);
  const monthStart = startOfMonth(month);
  const daysUntilMonthEnd = differenceInDays(monthEnd, today);
  
  // Check if we're in or before the selected month
  const isCurrentOrFutureMonth = today <= monthEnd && today >= monthStart;
  const isFutureMonth = today < monthStart;
  const monthNotEnded = isCurrentOrFutureMonth || isFutureMonth;
  
  // Preview conditions
  const hasPendingExpenses = expensePlanned > 0;
  const atLeast5DaysRemaining = daysUntilMonthEnd >= 5;
  const showRiskPreview = isNegative && hasPendingExpenses && monthNotEnded && atLeast5DaysRemaining;
  
  const forecast: ForecastState = {
    isNegative,
    riskAmount,
    balanceState,
    daysUntilMonthEnd,
    isCurrentOrFutureMonth: isCurrentOrFutureMonth || isFutureMonth,
    showRiskPreview,
  };
  
  logger.forecast(`Forecast computed for ${snapshot.monthKey}`, {
    balanceState,
    riskAmount,
    showRiskPreview,
    daysUntilMonthEnd,
  });
  
  return forecast;
}

/**
 * Compare two forecasts to detect state transitions
 */
export function detectBalanceTransition(
  previousState: BalanceState | null,
  currentState: BalanceState
): 'NEGATIVE_TO_POSITIVE' | 'POSITIVE_TO_NEGATIVE' | null {
  if (previousState === null) return null;
  
  if (previousState === 'NEGATIVE' && currentState === 'NON_NEGATIVE') {
    logger.transition('Balance transition: NEGATIVE -> NON_NEGATIVE');
    return 'NEGATIVE_TO_POSITIVE';
  }
  
  if (previousState === 'NON_NEGATIVE' && currentState === 'NEGATIVE') {
    logger.transition('Balance transition: NON_NEGATIVE -> NEGATIVE');
    return 'POSITIVE_TO_NEGATIVE';
  }
  
  return null;
}

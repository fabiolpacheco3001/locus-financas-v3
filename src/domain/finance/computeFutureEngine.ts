/**
 * computeFutureEngine - Pure function for end-of-month balance projection
 * 
 * Formula: estimatedEndOfMonth = currentBalance - pendingFixedExpenses - estimatedVariableSpending
 * 
 * NO side effects, NO React dependencies - this is a pure domain function.
 */

import { getDaysInMonth, differenceInDays, endOfMonth, startOfDay } from 'date-fns';

// ============================================
// INPUT/OUTPUT TYPES
// ============================================

export interface FutureEngineInput {
  /** Current available balance (excludes reserves) */
  currentBalance: number;
  
  /** Fixed expenses with status='planned' for this month */
  pendingFixedExpenses: number;
  
  /** Variable expenses already confirmed this month */
  confirmedVariableThisMonth: number;
  
  /** Historical average of monthly variable expenses (last 3 months) */
  historicalVariableAvg: number;
  
  /** Number of days elapsed in the current month */
  daysElapsed: number;
  
  /** Total days in the current month */
  daysInMonth: number;
  
  /** Optional safety buffer percentage (default: 10%) */
  safetyBufferPercent?: number;
}

export interface FutureEngineResult {
  // Core projections
  /** Estimated balance at end of month */
  estimatedEndOfMonth: number;
  
  /** Amount available to spend safely (with buffer) */
  safeSpendingZone: number;
  
  // Risk indicators
  /** Risk classification based on projected balance */
  riskLevel: 'safe' | 'caution' | 'danger';
  
  /** Percentage for progress bar (0-100, clamped) */
  riskPercentage: number;
  
  // Breakdown details
  /** Projected remaining variable spending for the month */
  projectedVariableRemaining: number;
  
  /** Total projected expenses (fixed pending + projected variable) */
  totalProjectedExpenses: number;
  
  /** Days remaining in the month */
  daysRemaining: number;
  
  // Metadata
  /** Whether there's sufficient historical data for reliable projection */
  isDataSufficient: boolean;
  
  /** Confidence level of the projection */
  confidenceLevel: 'high' | 'medium' | 'low';
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate days remaining in the month
 */
export function calculateDaysRemaining(selectedMonth: Date, referenceDate: Date = new Date()): number {
  const today = startOfDay(referenceDate);
  const monthEnd = endOfMonth(selectedMonth);
  
  const daysRemaining = differenceInDays(monthEnd, today);
  return Math.max(0, daysRemaining + 1); // +1 to include today
}

/**
 * Calculate days elapsed in the month
 */
export function calculateDaysElapsed(selectedMonth: Date, referenceDate: Date = new Date()): number {
  const today = startOfDay(referenceDate);
  const daysInMonth = getDaysInMonth(selectedMonth);
  const daysRemaining = calculateDaysRemaining(selectedMonth, referenceDate);
  
  return Math.max(1, daysInMonth - daysRemaining + 1);
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Compute end-of-month balance projection
 * 
 * Uses a daily rate model for variable expenses:
 * - Calculate daily variable rate from historical average
 * - Project remaining variable spending based on days left
 * - Subtract fixed pending expenses and projected variable from current balance
 */
export function computeFutureEngine(input: FutureEngineInput): FutureEngineResult {
  const {
    currentBalance,
    pendingFixedExpenses,
    confirmedVariableThisMonth,
    historicalVariableAvg,
    daysElapsed,
    daysInMonth,
    safetyBufferPercent = 10,
  } = input;

  // Calculate days remaining
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  // Calculate projected variable spending for remaining days
  // Using historical daily rate: (average / days in month) * days remaining
  const dailyVariableRate = daysInMonth > 0 ? historicalVariableAvg / daysInMonth : 0;
  const projectedVariableRemaining = dailyVariableRate * daysRemaining;

  // Total projected expenses
  const totalProjectedExpenses = pendingFixedExpenses + projectedVariableRemaining;

  // Estimated end of month balance
  const estimatedEndOfMonth = currentBalance - totalProjectedExpenses;

  // Calculate safe spending zone (with safety buffer)
  const safetyBuffer = Math.abs(currentBalance) * (safetyBufferPercent / 100);
  const safeSpendingZone = Math.max(0, currentBalance - pendingFixedExpenses - safetyBuffer);

  // Determine risk level
  let riskLevel: 'safe' | 'caution' | 'danger';
  if (estimatedEndOfMonth >= safetyBuffer) {
    riskLevel = 'safe';
  } else if (estimatedEndOfMonth >= 0) {
    riskLevel = 'caution';
  } else {
    riskLevel = 'danger';
  }

  // Calculate risk percentage for progress bar
  // 100% = fully safe, 0% = zero or negative balance
  let riskPercentage: number;
  if (currentBalance <= 0) {
    riskPercentage = 0;
  } else if (estimatedEndOfMonth >= currentBalance) {
    riskPercentage = 100;
  } else if (estimatedEndOfMonth <= 0) {
    riskPercentage = Math.max(0, ((currentBalance + estimatedEndOfMonth) / currentBalance) * 50);
  } else {
    riskPercentage = 50 + (estimatedEndOfMonth / currentBalance) * 50;
  }
  riskPercentage = Math.max(0, Math.min(100, riskPercentage));

  // Determine data sufficiency
  const isDataSufficient = historicalVariableAvg > 0;
  
  // Confidence level based on data quality
  let confidenceLevel: 'high' | 'medium' | 'low';
  if (historicalVariableAvg > 0 && daysElapsed >= 7) {
    confidenceLevel = 'high';
  } else if (historicalVariableAvg > 0 || daysElapsed >= 3) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'low';
  }

  return {
    estimatedEndOfMonth,
    safeSpendingZone,
    riskLevel,
    riskPercentage,
    projectedVariableRemaining,
    totalProjectedExpenses,
    daysRemaining,
    isDataSufficient,
    confidenceLevel,
  };
}

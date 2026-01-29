/**
 * computeMonthlySnapshot - Pure function to calculate monthly financial state
 * 
 * This is a PURE function with NO side effects:
 * - No database calls
 * - No React hooks
 * - No localStorage
 * - Deterministic output for same input
 * 
 * CRITICAL RULES (STRICT STATUS-BASED LOGIC):
 * 1. "Realized" = status === 'confirmed' (REGARDLESS of date)
 * 2. "Pending" = status === 'planned' (REGARDLESS of date)
 * 3. This ensures that marking something as "confirmed" immediately moves it to "Realized"
 * 
 * NOTE: Account Balance (bank reconciliation) still uses date-based logic separately.
 */

import { Transaction } from '@/types/finance';
import { MonthlySnapshot } from './types';
import { 
  startOfMonth, 
  endOfMonth, 
  parseISO, 
  isWithinInterval, 
  format,
  startOfDay
} from 'date-fns';
import { logger } from './logger';

/**
 * Gets the effective date for a transaction (used for month filtering).
 * - EXPENSE: uses due_date if available, else date
 * - INCOME/TRANSFER: uses date
 */
export function getEffectiveDate(transaction: Transaction): string {
  if (transaction.kind === 'EXPENSE' && transaction.due_date) {
    return transaction.due_date;
  }
  return transaction.date;
}

/**
 * Checks if a transaction falls within a month based on its effective date
 */
export function isInMonth(transaction: Transaction, month: Date): boolean {
  const effectiveDate = getEffectiveDate(transaction);
  const parsed = parseISO(effectiveDate);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  
  return isWithinInterval(parsed, { start: monthStart, end: monthEnd });
}

/**
 * Checks if transaction's effective date is in the past or today
 * (Only used for account balance calculation, not for card display)
 */
export function isEffectiveDatePastOrToday(transaction: Transaction): boolean {
  const effectiveDate = getEffectiveDate(transaction);
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
  return effectiveDate <= today;
}

/**
 * Compute the monthly snapshot from transactions
 * 
 * PURE FUNCTION - No side effects, deterministic
 * 
 * STRICT STATUS-BASED LOGIC (for card display):
 * - Realized = status === 'confirmed' (regardless of date)
 * - Pending = status === 'planned' (regardless of date)
 * 
 * This ensures that when a user marks something as "confirmed/paid",
 * it immediately moves from "A Pagar" to "Realizado" - NO DUPLICITY.
 * 
 * @param transactions - Array of transactions (will filter cancelled internally)
 * @param month - The month to calculate for
 * @returns MonthlySnapshot with all calculated values
 */
export function computeMonthlySnapshot(
  transactions: Transaction[],
  month: Date
): MonthlySnapshot {
  const monthKey = format(month, 'yyyy-MM');
  
  logger.snapshot(`Computing snapshot for ${monthKey}`, { 
    totalTransactions: transactions.length 
  });
  
  // Filter to valid transactions in this month (exclude cancelled)
  const activeTransactions = transactions.filter(t => 
    t.status !== 'cancelled' && !t.cancelled_at
  );
  const transactionsInMonth = activeTransactions.filter(t => isInMonth(t, month));
  
  // STRICT STATUS-BASED LOGIC: Split by status only (date is irrelevant)
  // Realized = status === 'confirmed' (even if future-dated)
  // Pending = status === 'planned' (regardless of date)
  const confirmed = transactionsInMonth.filter(t => t.status === 'confirmed');
  const planned = transactionsInMonth.filter(t => t.status === 'planned');
  
  // Income realized (ALL confirmed - regardless of date)
  const incomeRealized = confirmed
    .filter(t => t.kind === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  // Expense realized (ALL confirmed - regardless of date)
  const expenseRealized = confirmed
    .filter(t => t.kind === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  // saldoMes = income realized - expense realized
  const saldoMes = incomeRealized - expenseRealized;
  
  // Planned income (status === 'planned' ONLY)
  const incomePlanned = planned
    .filter(t => t.kind === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  // Planned expenses (a pagar - status === 'planned' ONLY)
  const expensePlanned = planned
    .filter(t => t.kind === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  // saldoPrevistoMes = (income realized + planned) - (expense realized + planned)
  const saldoPrevistoMes = (incomeRealized + incomePlanned) - (expenseRealized + expensePlanned);
  
  // Counts (strict status-based)
  const plannedIncomeCount = planned.filter(t => t.kind === 'INCOME').length;
  const plannedExpenseCount = planned.filter(t => t.kind === 'EXPENSE').length;
  const confirmedCount = confirmed.length;
  const totalCount = transactionsInMonth.length;
  
  const snapshot: MonthlySnapshot = {
    monthKey,
    month,
    incomeRealized,
    expenseRealized,
    saldoMes,
    incomePlanned,
    expensePlanned,
    saldoPrevistoMes,
    confirmedCount,
    plannedIncomeCount,
    plannedExpenseCount,
    totalCount,
    confirmedTransactions: confirmed,
    plannedTransactions: planned,
  };

  logger.snapshot(`Snapshot for ${monthKey}`, {
    incomeRealized,
    expenseRealized,
    saldoMes,
    incomePlanned,
    expensePlanned,
    saldoPrevistoMes,
    confirmedCount,
    plannedIncomeCount,
    plannedExpenseCount,
  });

  return snapshot;
}

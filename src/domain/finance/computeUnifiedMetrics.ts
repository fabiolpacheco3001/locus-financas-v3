/**
 * SINGLE SOURCE OF TRUTH - Unified Financial Metrics Calculation
 * 
 * This module provides a unified calculation for all financial metrics used across:
 * - Dashboard (HeroBalance, GlassStatCards)
 * - Accounts Page (balance per account)
 * - ProjectionDrawer (per-account breakdown)
 * - Budget Page (realized expenses by category)
 * - Transactions Page (summary cards)
 * 
 * CRITICAL RULES (STRICT STATUS-BASED LOGIC):
 * 1. Cancelled transactions (cancelled_at IS NOT NULL) are ALWAYS excluded
 * 2. "Realized" (Cards) = status === 'confirmed' (REGARDLESS of date)
 * 3. "Pending" (A Pagar) = status === 'planned' (REGARDLESS of date)
 * 4. "Account Balance" (Saldo Disponível) = confirmed transactions with effective_date <= END OF CURRENT MONTH
 *    (Uses end-of-month cutoff to avoid timezone issues while excluding future-month recurrences)
 * 5. Transfers between normal accounts don't affect "Available Balance"
 * 6. Transfers to/from reserve accounts (Caixinha) affect "Available Balance"
 * 
 * This ensures that when a user marks something as "confirmed/paid", it immediately
 * moves from "A Pagar" to "Realizado" - NO DUPLICITY.
 * 
 * Effective Date Logic (for filtering by month):
 * - EXPENSE: uses due_date if available, else date
 * - INCOME: uses date
 * - TRANSFER: uses date
 */

import { Transaction, Account } from '@/types/finance';
import { 
  startOfMonth, 
  endOfMonth, 
  parseISO, 
  isWithinInterval, 
  format,
  startOfDay
} from 'date-fns';

export interface AccountForMetrics {
  id: string;
  is_reserve: boolean;
  is_active: boolean;
  name: string;
  type: string;
}

export interface UnifiedMonthlyMetrics {
  // === REALIZED (status === 'confirmed' - strict status-based) ===
  incomeRealized: number;
  expenseRealized: number;
  /** incomeRealized - expenseRealized */
  balanceRealized: number;
  
  // === PENDING (status === 'planned' - strict status-based) ===
  incomePending: number;
  expensePending: number;
  
  // === FORECAST (realized + pending for the month) ===
  /** incomeRealized + incomePending */
  incomeForecast: number;
  /** expenseRealized + expensePending */
  expenseForecast: number;
  /** incomeForecast - expenseForecast */
  balanceForecast: number;
  
  // === COUNTS ===
  confirmedCount: number;
  plannedIncomeCount: number;
  plannedExpenseCount: number;
  totalCount: number;
}

export interface UnifiedAccountMetrics {
  account: AccountForMetrics;
  /** 
   * Realized balance for ACCOUNT: sum of confirmed transactions with effective_date <= today
   * NOTE: Account balance still uses date-based logic for accurate bank reconciliation
   */
  realizedBalance: number;
  /** Pending income: status === 'planned' within the month */
  pendingIncome: number;
  /** Pending expenses: status === 'planned' within the month */
  pendingExpenses: number;
  /** realizedBalance + pendingIncome - pendingExpenses */
  projectedBalance: number;
  /** Number of transactions contributing to realized balance */
  transactionCount: number;
  /** Is projected balance negative? */
  isNegativeProjected: boolean;
  /** Detailed list of pending incomes (status === 'planned') */
  plannedIncomes: PendingTransactionDetail[];
  /** Detailed list of pending expenses (status === 'planned') */
  plannedExpenses: PendingTransactionDetail[];
}

export interface PendingTransactionDetail {
  id: string;
  date: string;
  dueDate: string | null;
  description: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  amount: number;
}

export interface UnifiedTotals {
  // === ALL ACCOUNTS ===
  realizedBalance: number;
  projectedBalance: number;
  pendingIncome: number;
  pendingExpenses: number;
  
  // === RESERVE ACCOUNTS (Caixinhas) ===
  reserveRealizedBalance: number;
  reserveProjectedBalance: number;
  reservePendingIncome: number;
  reservePendingExpenses: number;
  
  // === AVAILABLE (non-reserve accounts) ===
  availableRealizedBalance: number;
  availableProjectedBalance: number;
  availablePendingIncome: number;
  availablePendingExpenses: number;
}

/**
 * Get the effective date for a transaction.
 * - EXPENSE: uses due_date if available, else date
 * - INCOME/TRANSFER: uses date
 */
export function getEffectiveDate(transaction: { kind: string; date: string; due_date?: string | null }): string {
  if (transaction.kind === 'EXPENSE' && transaction.due_date) {
    return transaction.due_date;
  }
  return transaction.date;
}

/**
 * Check if a transaction's effective date falls within a month
 */
export function isEffectiveDateInMonth(
  transaction: { kind: string; date: string; due_date?: string | null },
  month: Date
): boolean {
  const effectiveDate = getEffectiveDate(transaction);
  const parsed = parseISO(effectiveDate);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  
  return isWithinInterval(parsed, { start: monthStart, end: monthEnd });
}

/**
 * Check if a transaction's effective date is within the current month
 * Uses end-of-month cutoff to avoid timezone issues while excluding future months.
 */
export function isEffectiveDateWithinCurrentMonth(
  transaction: { kind: string; date: string; due_date?: string | null }
): boolean {
  const effectiveDate = getEffectiveDate(transaction);
  const now = new Date();
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const cutoffStr = format(endOfCurrentMonth, 'yyyy-MM-dd');
  return effectiveDate <= cutoffStr;
}

/**
 * Filter out cancelled transactions
 */
function filterValidTransactions<T extends { status: string; cancelled_at?: string | null }>(
  transactions: T[]
): T[] {
  return transactions.filter(t => 
    t.status !== 'cancelled' && 
    !t.cancelled_at
  );
}

/**
 * Compute unified monthly metrics from transactions.
 * This is the SINGLE SOURCE OF TRUTH for monthly stats.
 * 
 * STRICT STATUS-BASED LOGIC (for Cards):
 * - REALIZED = status === 'confirmed' (REGARDLESS of date)
 * - PENDING = status === 'planned' (REGARDLESS of date)
 * 
 * This ensures that when a user marks something as "confirmed/paid",
 * it immediately moves from "A Pagar" to "Realizado" - NO DUPLICITY.
 * 
 * NOTE: Account Balance (bank reconciliation) still uses date-based logic.
 * 
 * @param transactions - All transactions (will be filtered internally)
 * @param month - The reference month
 */
export function computeUnifiedMonthlyMetrics(
  transactions: Transaction[],
  month: Date
): UnifiedMonthlyMetrics {
  // Step 1: Filter out cancelled transactions
  const validTransactions = filterValidTransactions(transactions);
  
  // Step 2: Filter by month (using effective date)
  const transactionsInMonth = validTransactions.filter(t => isEffectiveDateInMonth(t, month));
  
  // Step 3: STRICT STATUS-BASED split (date is IRRELEVANT for card display)
  // REALIZED = status === 'confirmed' (even if future-dated)
  // PENDING = status === 'planned' (only planned items)
  const confirmed = transactionsInMonth.filter(t => t.status === 'confirmed');
  const planned = transactionsInMonth.filter(t => t.status === 'planned');
  
  // Step 4: Calculate realized (ALL confirmed - regardless of date)
  const incomeRealized = confirmed
    .filter(t => t.kind === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const expenseRealized = confirmed
    .filter(t => t.kind === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  // Step 5: Calculate pending (ONLY planned - strict status-based)
  const incomePending = planned
    .filter(t => t.kind === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const expensePending = planned
    .filter(t => t.kind === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  // Step 6: Calculate derived values
  const balanceRealized = incomeRealized - expenseRealized;
  const incomeForecast = incomeRealized + incomePending;
  const expenseForecast = expenseRealized + expensePending;
  const balanceForecast = incomeForecast - expenseForecast;
  
  // Step 7: Counts (strict status-based)
  const confirmedCount = confirmed.length;
  const plannedIncomeCount = planned.filter(t => t.kind === 'INCOME').length;
  const plannedExpenseCount = planned.filter(t => t.kind === 'EXPENSE').length;
  const totalCount = transactionsInMonth.length;
  
  return {
    incomeRealized,
    expenseRealized,
    balanceRealized,
    incomePending,
    expensePending,
    incomeForecast,
    expenseForecast,
    balanceForecast,
    confirmedCount,
    plannedIncomeCount,
    plannedExpenseCount,
    totalCount,
  };
}

/**
 * Compute per-account metrics for projections.
 * This is the SINGLE SOURCE OF TRUTH for account-level calculations.
 * 
 * HYBRID LOGIC:
 * - ACCOUNT BALANCE (realizedBalance): Uses date-based logic (effective_date <= today) for bank reconciliation
 * - PENDING (Dashboard cards): Uses status-based logic (status === 'planned' only)
 * 
 * @param transactions - All transactions with category/subcategory info
 * @param accounts - All accounts with is_reserve flag
 * @param month - The reference month (projections go up to end of month)
 */
export function computeUnifiedAccountMetrics(
  transactions: (Transaction & { 
    category?: { name: string } | null;
    subcategory?: { name: string } | null;
  })[],
  accounts: AccountForMetrics[],
  month: Date
): { projections: UnifiedAccountMetrics[]; totals: UnifiedTotals } {
  const validTransactions = filterValidTransactions(transactions);
  const endOfSelectedMonth = endOfMonth(month);
  
  // Use end-of-month cutoff to avoid timezone edge cases excluding "today" transactions
  // while still ignoring future-month confirmed transactions (e.g. recurring entries for next month).
  // This matches the ForceSync logic in useAccounts.ts for consistency.
  const now = new Date();
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const endOfMonthCutoffStr = format(endOfCurrentMonth, 'yyyy-MM-dd');
  

  const projections: UnifiedAccountMetrics[] = accounts.map(account => {
    let realizedBalance = 0;
    let pendingIncome = 0;
    let pendingExpenses = 0;
    let transactionCount = 0;
    const plannedIncomes: PendingTransactionDetail[] = [];
    const plannedExpenses: PendingTransactionDetail[] = [];
    
    validTransactions.forEach(t => {
      const amount = Number(t.amount);
      const effectiveDate = getEffectiveDate(t);
      const effectiveDateParsed = parseISO(effectiveDate);
      const isWithinProjectionPeriod = effectiveDateParsed <= endOfSelectedMonth;
      // Use end-of-month cutoff instead of "today" to include all current month transactions
      const isWithinCurrentMonth = effectiveDate <= endOfMonthCutoffStr;
      
      // ACCOUNT BALANCE: Confirmed transactions with effective_date <= end of current month
      // This avoids timezone issues while still excluding future-month recurrences
      if (t.status === 'confirmed' && isWithinCurrentMonth) {
        if (t.kind === 'INCOME' && t.account_id === account.id) {
          realizedBalance += amount;
          transactionCount++;
        } else if (t.kind === 'EXPENSE' && t.account_id === account.id) {
          realizedBalance -= amount;
          transactionCount++;
        } else if (t.kind === 'TRANSFER') {
          if (t.account_id === account.id) {
            realizedBalance -= amount;
            transactionCount++;
          }
          if (t.to_account_id === account.id) {
            realizedBalance += amount;
            transactionCount++;
          }
        }
      }
      
      // PENDING: STRICTLY status === 'planned' only (status-based logic)
      // This ensures confirmed transactions never appear in "A Pagar" regardless of date
      if (t.status === 'planned' && isWithinProjectionPeriod) {
        if (t.kind === 'INCOME' && t.account_id === account.id) {
          pendingIncome += amount;
          plannedIncomes.push({
            id: t.id,
            date: t.date,
            dueDate: t.due_date,
            description: t.description,
            categoryName: t.category?.name || null,
            subcategoryName: t.subcategory?.name || null,
            amount,
          });
        } else if (t.kind === 'EXPENSE' && t.account_id === account.id) {
          pendingExpenses += amount;
          plannedExpenses.push({
            id: t.id,
            date: t.date,
            dueDate: t.due_date,
            description: t.description,
            categoryName: t.category?.name || null,
            subcategoryName: t.subcategory?.name || null,
            amount,
          });
        }
        // Note: TRANSFER pending is NOT counted as pending income/expense
      }
    });
    
    // Sort by amount descending
    plannedIncomes.sort((a, b) => b.amount - a.amount);
    plannedExpenses.sort((a, b) => b.amount - a.amount);
    
    const projectedBalance = realizedBalance + pendingIncome - pendingExpenses;
    
    return {
      account,
      realizedBalance,
      pendingIncome,
      pendingExpenses,
      projectedBalance,
      transactionCount,
      isNegativeProjected: projectedBalance < 0,
      plannedIncomes,
      plannedExpenses,
    };
  });
  
  // Calculate totals
  const totals = projections.reduce<UnifiedTotals>(
    (acc, p) => {
      const isReserve = p.account.is_reserve ?? false;
      
      // Global totals
      acc.realizedBalance += p.realizedBalance;
      acc.projectedBalance += p.projectedBalance;
      acc.pendingIncome += p.pendingIncome;
      acc.pendingExpenses += p.pendingExpenses;
      
      if (isReserve) {
        // Reserve accounts (Caixinhas)
        acc.reserveRealizedBalance += p.realizedBalance;
        acc.reserveProjectedBalance += p.projectedBalance;
        acc.reservePendingIncome += p.pendingIncome;
        acc.reservePendingExpenses += p.pendingExpenses;
      } else {
        // Operational accounts (available for spending)
        acc.availableRealizedBalance += p.realizedBalance;
        acc.availableProjectedBalance += p.projectedBalance;
        acc.availablePendingIncome += p.pendingIncome;
        acc.availablePendingExpenses += p.pendingExpenses;
      }
      
      return acc;
    },
    {
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
    }
  );
  
  return { projections, totals };
}

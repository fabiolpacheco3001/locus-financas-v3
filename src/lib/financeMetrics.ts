/**
 * Financial Metrics - Re-exports from unified source of truth
 * 
 * This file provides backward compatibility with existing imports.
 * All actual calculations are delegated to computeUnifiedMetrics.
 * 
 * @see src/domain/finance/computeUnifiedMetrics.ts
 */

import { Transaction } from '@/types/finance';
import { startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { 
  computeUnifiedMonthlyMetrics,
  getEffectiveDate as unifiedGetEffectiveDate,
  isEffectiveDateInMonth,
} from '@/domain/finance/computeUnifiedMetrics';

// Re-export types for backward compatibility
export type { 
  UnifiedMonthlyMetrics,
  UnifiedAccountMetrics,
  UnifiedTotals,
  PendingTransactionDetail,
  AccountForMetrics,
} from '@/domain/finance/computeUnifiedMetrics';

// Re-export core functions
export { 
  computeUnifiedMonthlyMetrics,
  computeUnifiedAccountMetrics,
} from '@/domain/finance/computeUnifiedMetrics';

// Legacy interface for backward compatibility
export interface MonthlyMetrics {
  incomeRealized: number;
  expenseRealized: number;
  saldoMes: number;
  aPagarMes: number;
  incomePlanned: number;
  saldoPrevistoMes: number;
  plannedIncomeCount: number;
  plannedExpenseCount: number;
  confirmedCount: number;
  totalCount: number;
}

export interface TotalMetrics {
  saldoTotal: number;
  totalIncomeConfirmed: number;
  totalExpenseConfirmed: number;
}

export interface AccountForBalance {
  id: string;
  is_reserve: boolean;
}

export interface AvailableBalanceResult {
  saldoDisponivel: number;
  transfersToReserve: number;
  transfersFromReserve: number;
}

/**
 * Gets the effective date for a transaction.
 * Uses due_date if available for EXPENSE, otherwise falls back to date.
 */
export function getEffectiveDate(transaction: Transaction): string {
  return unifiedGetEffectiveDate(transaction);
}

/**
 * Checks if a transaction falls within a month based on its effective date
 */
export function isInMonth(transaction: Transaction, month: Date): boolean {
  return isEffectiveDateInMonth(transaction, month);
}

/**
 * Calculates monthly financial metrics from transactions
 * This is a WRAPPER around the unified metrics for backward compatibility.
 * 
 * @param transactions - Array of transactions (should be pre-filtered to exclude cancelled)
 * @param month - The month to calculate metrics for
 * @returns Monthly metrics object in legacy format
 */
export function calculateMonthlyMetrics(
  transactions: Transaction[],
  month: Date
): MonthlyMetrics {
  const unified = computeUnifiedMonthlyMetrics(transactions, month);
  
  // Map to legacy format
  return {
    incomeRealized: unified.incomeRealized,
    expenseRealized: unified.expenseRealized,
    saldoMes: unified.balanceRealized,
    aPagarMes: unified.expensePending,
    incomePlanned: unified.incomePending,
    saldoPrevistoMes: unified.balanceForecast,
    plannedIncomeCount: unified.plannedIncomeCount,
    plannedExpenseCount: unified.plannedExpenseCount,
    confirmedCount: unified.confirmedCount,
    totalCount: unified.totalCount,
  };
}

/**
 * Calculates total accumulated balance from all confirmed transactions
 * 
 * @param transactions - Array of all transactions (all dates)
 * @returns Total metrics object
 */
export function calculateTotalMetrics(transactions: Transaction[]): TotalMetrics {
  const confirmed = transactions.filter(t => t.status === 'confirmed' && !t.cancelled_at);

  const totalIncomeConfirmed = confirmed
    .filter(t => t.kind === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenseConfirmed = confirmed
    .filter(t => t.kind === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Note: TRANSFER doesn't affect total balance as it's internal movement
  const saldoTotal = totalIncomeConfirmed - totalExpenseConfirmed;

  return {
    saldoTotal,
    totalIncomeConfirmed,
    totalExpenseConfirmed,
  };
}

/**
 * Calculates the available balance for a month considering transfers to/from reserve accounts (Caixinha)
 * 
 * Available Balance = (Income - Expenses) - transfers_to_reserve + transfers_from_reserve
 * 
 * Where:
 * - transfers_to_reserve: TRANSFER from normal account (is_reserve=false) to reserve (is_reserve=true)
 * - transfers_from_reserve: TRANSFER from reserve (is_reserve=true) to normal account (is_reserve=false)
 * - Transfers between normal accounts (true->true or false->false) don't affect the balance
 * 
 * @param transactions - Array of transactions (confirmed TRANSFER transactions in the month)
 * @param accounts - Array of accounts with is_reserve flag
 * @param baseBalance - The base saldoMes (incomeRealized - expenseRealized)
 * @param month - The month to calculate for
 * @returns Available balance result with breakdown
 */
export function calculateAvailableBalanceMonth(
  transactions: Transaction[],
  accounts: AccountForBalance[],
  baseBalance: number,
  month: Date
): AvailableBalanceResult {
  // Create a map for quick account lookup
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  
  // Filter to confirmed TRANSFER transactions in the month
  const transfersInMonth = transactions.filter(t => 
    t.kind === 'TRANSFER' &&
    t.status === 'confirmed' &&
    isInMonth(t, month)
  );
  
  let transfersToReserve = 0;
  let transfersFromReserve = 0;
  
  for (const transfer of transfersInMonth) {
    const fromAccount = accountMap.get(transfer.account_id);
    const toAccount = transfer.to_account_id ? accountMap.get(transfer.to_account_id) : null;
    
    if (!fromAccount || !toAccount) continue;
    
    const amount = Number(transfer.amount);
    
    // Transfer from normal to reserve (money leaving available balance)
    if (!fromAccount.is_reserve && toAccount.is_reserve) {
      transfersToReserve += amount;
    }
    // Transfer from reserve to normal (money entering available balance)
    else if (fromAccount.is_reserve && !toAccount.is_reserve) {
      transfersFromReserve += amount;
    }
    // Transfers between same type (normal->normal or reserve->reserve) don't affect
  }
  
  const saldoDisponivel = baseBalance - transfersToReserve + transfersFromReserve;
  
  return {
    saldoDisponivel,
    transfersToReserve,
    transfersFromReserve,
  };
}

/**
 * Helper to format currency values in BRL
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

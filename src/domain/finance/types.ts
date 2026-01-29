/**
 * Domain Types - Pure data structures for the finance domain
 * No dependencies on React, Supabase, or UI libraries
 */

import type { Transaction, Account, Budget, Category } from '@/types/finance';

// ============================================
// SNAPSHOT TYPES
// ============================================

/**
 * Monthly financial snapshot - pure calculated state
 */
export interface MonthlySnapshot {
  // Reference
  monthKey: string; // YYYY-MM
  month: Date;
  
  // Realized values (confirmed only)
  incomeRealized: number;
  expenseRealized: number;
  saldoMes: number;
  
  // Planned values
  incomePlanned: number;
  expensePlanned: number; // a pagar
  
  // Projected balance
  saldoPrevistoMes: number;
  
  // Counts
  confirmedCount: number;
  plannedIncomeCount: number;
  plannedExpenseCount: number;
  totalCount: number;
  
  // Transactions lists
  confirmedTransactions: Transaction[];
  plannedTransactions: Transaction[];
}

/**
 * Forecast state derived from snapshot
 */
export interface ForecastState {
  // Risk indicators
  isNegative: boolean;
  riskAmount: number;
  
  // Balance state for state machine
  balanceState: BalanceState;
  
  // Time context
  daysUntilMonthEnd: number;
  isCurrentOrFutureMonth: boolean;
  
  // Preview conditions
  showRiskPreview: boolean;
}

export type BalanceState = 'NEGATIVE' | 'NON_NEGATIVE';

// ============================================
// RISK DETECTION TYPES
// ============================================

export interface OverdueExpense {
  id: string;
  description: string;
  daysOverdue: number;
  amount: number;
  subcategoryName?: string;
  categoryName?: string;
}

export interface CoverageRiskExpense {
  id: string;
  description: string;
  daysUntilDue: number;
  amount: number;
  subcategoryName?: string;
  categoryName?: string;
}

export interface RiskAssessment {
  overdueExpenses: OverdueExpense[];
  hasOverdueExpenses: boolean;
  coverageRiskExpenses: CoverageRiskExpense[];
  hasCoverageRisk: boolean;
}

// ============================================
// NOTIFICATION RULE TYPES - MESSAGE CONTRACT
// ============================================

/**
 * Notification payload using Message Contract (i18n)
 * Never stores final text - only message_key + params
 */
export interface NotificationPayload {
  eventType: string;
  referenceId: string;
  
  // Message Contract (i18n)
  messageKey: string;
  params: Record<string, unknown>;
  severity: 'action' | 'warning' | 'success' | 'info';
  
  // Entity info
  entityType?: string;
  entityId?: string;
  
  // CTA (call-to-action)
  ctaLabelKey?: string;
  ctaTarget?: string;
  
  // Legacy fields (deprecated - for backward compatibility)
  title?: string;
  message?: string;
  type?: 'action' | 'warning' | 'success' | 'info';
  ctaLabel?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Toast payload using Message Contract (i18n)
 */
export interface ToastPayload {
  variant?: 'default' | 'destructive';
  
  // Message Contract (i18n)
  titleKey: string;
  descriptionKey: string;
  params?: Record<string, unknown>;
  
  // Legacy fields (deprecated - for backward compatibility)
  title?: string;
  description?: string;
}

export type NotificationRuleAction = 
  | { type: 'CREATE'; payload: NotificationPayload }
  | { type: 'UPDATE'; payload: NotificationPayload }
  | { type: 'ARCHIVE'; eventType: string; referenceId: string }
  | { type: 'SKIP' }
  | { type: 'TOAST'; payload: ToastPayload };

// ============================================
// TRANSACTION FILTER TYPES
// ============================================

export interface TransactionFilter {
  status?: 'confirmed' | 'planned' | 'cancelled' | 'all';
  view?: 'overdue' | 'month_pending' | 'late_pattern';
  categoryId?: string;
  subcategoryId?: string;
  month?: string;
}

// ============================================
// STATE COMPARISON
// ============================================

export interface SnapshotComparison {
  previous: MonthlySnapshot | null;
  current: MonthlySnapshot;
  
  // Derived
  balanceTransition: BalanceTransition | null;
  improvementAmount: number;
}

export type BalanceTransition = 
  | 'NEGATIVE_TO_POSITIVE'
  | 'POSITIVE_TO_NEGATIVE';

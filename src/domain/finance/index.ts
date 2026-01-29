/**
 * Finance Domain - Pure business logic
 * 
 * This module exports pure functions for financial calculations
 * and rule evaluation. NO side effects, NO React dependencies.
 * 
 * Architecture:
 * - computeMonthlySnapshot: Calculate monthly financial state
 * - computeForecast: Derive forecast and risk indicators
 * - computeRiskAssessment: Assess transaction-level risks
 * - evaluateNotificationRules: Determine notification actions
 * - buildTransactionFiltersFromNotification: Parse notification CTAs
 * 
 * Usage:
 * 1. UI components call these pure functions to get calculated state
 * 2. Services consume the actions returned by evaluateNotificationRules
 * 3. State persistence is handled separately by services
 */

// Types
export * from './types';

// Pure calculation functions
export { 
  computeMonthlySnapshot, 
  getEffectiveDate, 
  isInMonth 
} from './computeMonthlySnapshot';

export { 
  computeForecast, 
  detectBalanceTransition 
} from './computeForecast';

export { computeRiskAssessment } from './computeRiskAssessment';

// NOTE: calculateAvailableBalance has been REMOVED.
// Balance calculation is now done exclusively via Postgres RPC:
// - get_account_balance(account_id): Single account
// - get_accounts_with_balances(): All accounts
// See: src/hooks/useAccounts.ts

// Unified financial metrics (SINGLE SOURCE OF TRUTH)
export {
  computeUnifiedMonthlyMetrics,
  computeUnifiedAccountMetrics,
  getEffectiveDate as getUnifiedEffectiveDate,
  isEffectiveDateInMonth,
  isEffectiveDateWithinCurrentMonth,
  type UnifiedMonthlyMetrics,
  type UnifiedAccountMetrics,
  type UnifiedTotals,
  type PendingTransactionDetail,
  type AccountForMetrics,
} from './computeUnifiedMetrics';

// Rule evaluation
export { evaluateNotificationRules } from './evaluateNotificationRules';

// Filter building
export { 
  buildTransactionFiltersFromNotification, 
  parseCtaTarget,
  buildTransactionUrl 
} from './buildTransactionFilters';

// Future Engine - End of Month Projection
export {
  computeFutureEngine,
  calculateDaysRemaining,
  calculateDaysElapsed,
  type FutureEngineInput,
  type FutureEngineResult,
} from './computeFutureEngine';

// Logger (for debugging)
export { logger } from './logger';

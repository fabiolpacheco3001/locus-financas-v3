/**
 * Message Types for i18n - Defines structured message keys with params
 * 
 * RULE: No hardcoded text in domain/notifications/insights
 * All messages use message_key + params pattern for runtime translation
 */

// ============================================
// TOAST MESSAGE KEYS
// ============================================

export type ToastMessageKey =
  | 'toasts.risk_month_negative'
  | 'toasts.month_recovered'
  | 'toasts.good_decision'
  | 'toasts.risk_reduced';

export interface ToastMessageParams {
  'toasts.risk_month_negative': { amount: number };
  'toasts.month_recovered': Record<string, never>;
  'toasts.good_decision': { amount: number };
  'toasts.risk_reduced': { amount: number };
}

// ============================================
// NOTIFICATION MESSAGE KEYS
// ============================================

export type NotificationMessageKey =
  // Overdue payments
  | 'notifications.payment_delayed.single.with_subcategory'
  | 'notifications.payment_delayed.single.with_category'
  | 'notifications.payment_delayed.single.with_description'
  | 'notifications.payment_delayed.multiple'
  | 'notifications.payment_delayed.title.overdue'
  | 'notifications.payment_delayed.title.very_overdue'
  | 'notifications.payment_delayed.title_plural.overdue'
  | 'notifications.payment_delayed.title_plural.very_overdue'
  // Month at risk
  | 'notifications.month_at_risk.title'
  | 'notifications.month_at_risk.message'
  | 'notifications.month_at_risk_preview.message'
  // Coverage risk
  | 'notifications.coverage_risk.title'
  | 'notifications.coverage_risk.message'
  // Recovery
  | 'notifications.month_recovered.title'
  | 'notifications.month_recovered.message'
  // Risk reduced
  | 'notifications.risk_reduced.title'
  | 'notifications.risk_reduced.message'
  // AI rules
  | 'notifications.recurring_late_payment.title'
  | 'notifications.recurring_late_payment.message'
  | 'notifications.missing_recurring_expense.title'
  | 'notifications.missing_recurring_expense.message';

export interface NotificationMessageParams {
  'notifications.payment_delayed.single.with_subcategory': {
    subcategory: string;
    category: string;
    days: number;
  };
  'notifications.payment_delayed.single.with_category': {
    category: string;
    days: number;
  };
  'notifications.payment_delayed.single.with_description': {
    description: string;
    days: number;
  };
  'notifications.payment_delayed.multiple': {
    count: number;
    days: number;
  };
  'notifications.payment_delayed.title.overdue': Record<string, never>;
  'notifications.payment_delayed.title.very_overdue': Record<string, never>;
  'notifications.payment_delayed.title_plural.overdue': Record<string, never>;
  'notifications.payment_delayed.title_plural.very_overdue': Record<string, never>;
  'notifications.month_at_risk.title': Record<string, never>;
  'notifications.month_at_risk.message': { amount: string };
  'notifications.month_at_risk_preview.message': Record<string, never>;
  'notifications.coverage_risk.title': Record<string, never>;
  'notifications.coverage_risk.message': { description: string; days: number };
  'notifications.month_recovered.title': Record<string, never>;
  'notifications.month_recovered.message': Record<string, never>;
  'notifications.risk_reduced.title': Record<string, never>;
  'notifications.risk_reduced.message': { amount: string };
  'notifications.recurring_late_payment.title': Record<string, never>;
  'notifications.recurring_late_payment.message': Record<string, never>;
  'notifications.missing_recurring_expense.title': Record<string, never>;
  'notifications.missing_recurring_expense.message': Record<string, never>;
}

// ============================================
// INSIGHT MESSAGE KEYS
// ============================================

export type InsightMessageKey =
  | 'insights.month_closes_negative'
  | 'insights.days_in_red'
  | 'insights.postpone_benefit.balances'
  | 'insights.postpone_benefit.reduces'
  | 'insights.pending_income_helps.balances'
  | 'insights.pending_income_helps.still_missing'
  | 'insights.overdue_payments'
  | 'insights.largest_pending_expense'
  | 'insights.action_hint.postpone'
  | 'insights.action_hint.regularize';

export interface InsightMessageParams {
  'insights.month_closes_negative': { amount: string };
  'insights.days_in_red': { days: number };
  'insights.postpone_benefit.balances': { description: string; amount: string };
  'insights.postpone_benefit.reduces': { description: string; amount: string; deficit: string };
  'insights.pending_income_helps.balances': { amount: string };
  'insights.pending_income_helps.still_missing': { amount: string; missing: string };
  'insights.overdue_payments': { count: number; total: string };
  'insights.largest_pending_expense': { description: string; amount: string; percentage: number };
  'insights.action_hint.postpone': Record<string, never>;
  'insights.action_hint.regularize': Record<string, never>;
}

// ============================================
// ERROR MESSAGE KEYS
// ============================================

export type ErrorMessageKey =
  // Auth
  | 'errors.auth.invalid_credentials'
  | 'errors.auth.email_not_confirmed'
  | 'errors.auth.email_registered'
  | 'errors.auth.signup_disabled'
  | 'errors.auth.rate_limit'
  | 'errors.auth.invalid_email'
  | 'errors.auth.password_too_short'
  | 'errors.auth.password_weak'
  | 'errors.auth.jwt_expired'
  // Business rules
  | 'errors.business.insufficient_balance'
  // Foreign key violations
  | 'errors.fk.transactions_account'
  | 'errors.fk.transactions_category'
  | 'errors.fk.transactions_subcategory'
  | 'errors.fk.transactions_member'
  | 'errors.fk.budgets_category'
  | 'errors.fk.budgets_subcategory'
  | 'errors.fk.subcategories_category'
  | 'errors.fk.generic'
  // Unique violations
  | 'errors.unique.budget_exists'
  | 'errors.unique.generic'
  // Constraints
  | 'errors.constraint.not_null'
  | 'errors.constraint.check'
  // Permissions
  | 'errors.permission.rls'
  | 'errors.permission.denied'
  | 'errors.permission.login_required'
  // Network
  | 'errors.network.connection'
  | 'errors.network.timeout'
  // Generic
  | 'errors.generic.no_household'
  | 'errors.generic.unknown';

// ============================================
// CTA LABELS
// ============================================

export type CtaLabelKey =
  | 'common.cta.view_transactions'
  | 'common.cta.view_transaction';

// ============================================
// LOCALIZED MESSAGE TYPE
// Used to store message_key + params in database instead of final text
// ============================================

export interface LocalizedMessage<K extends string = string> {
  messageKey: K;
  params?: Record<string, unknown>;
}

/**
 * Create a localized message object
 */
export function createLocalizedMessage<K extends string>(
  messageKey: K,
  params?: Record<string, unknown>
): LocalizedMessage<K> {
  return { messageKey, params };
}

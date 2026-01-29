export type NotificationType = 'info' | 'warning' | 'action' | 'success';

// AI Decision category for ia_decision notifications
export type NotificationCategory = 'risk' | 'ia_decision';

export type NotificationEventType = 
  | 'MONTH_AT_RISK' 
  | 'MONTH_AT_RISK_PREVIEW'       // IA: Risco de fechar o mês no vermelho (5+ dias antes do fim)
  | 'UPCOMING_EXPENSE_COVERAGE_RISK' // IA: Conta pode faltar cobertura
  | 'PAYMENT_DELAYED' 
  | 'RISK_REDUCED' 
  | 'MONTH_RECOVERED'
  // AI Decision events (Sprint 1)
  | 'RECURRING_LATE_PAYMENT'      // Regra 01: Conta costuma atrasar
  | 'MISSING_RECURRING_EXPENSE';  // Regra 02: Despesa recorrente não registrada

export type NotificationStatus = 'unread' | 'read' | 'archived';

export interface NotificationParams {
  count?: number;
  maxDaysOverdue?: number;
  daysOverdue?: number;
  daysUntilDue?: number;
  amount?: number;
  formattedAmount?: string;
  description?: string;
  categoryName?: string;
  subcategoryName?: string;
  monthKey?: string;
  transactionIds?: string[];
  categoryId?: string;
  subcategoryId?: string;
  averageAmount?: number;
  lastTriggeredAt?: string;
  lateOccurrences?: number;
  [key: string]: unknown;
}

export interface NotificationMetadata extends NotificationParams {
  // Alias for backward compatibility
}

/**
 * Notification entity - Message Contract
 * 
 * IMPORTANT: Never persist final text in the database.
 * Always use message_key + params for i18n rendering at runtime.
 */
export interface Notification {
  id: string;
  household_id: string;
  
  // Message Contract fields (i18n)
  message_key: string;
  params: NotificationParams;
  severity: NotificationType;
  entity_type: string;
  entity_id: string | null;
  status: NotificationStatus;
  
  // Legacy fields (kept for backward compatibility during migration)
  type: NotificationType;
  event_type: string;
  title?: string;
  message?: string;
  
  // CTA (call-to-action)
  cta_label_key?: string | null;
  cta_label?: string | null;
  cta_target?: string | null;
  
  // References
  reference_id?: string | null;
  metadata?: NotificationParams | null;
  dedupe_key?: string | null;
  
  // Timestamps
  created_at: string;
  updated_at?: string | null;
  read_at?: string | null;
  dismissed_at?: string | null;
}

/**
 * Input for creating notifications - uses Message Contract
 */
export interface CreateNotificationInput {
  // Message Contract (required)
  message_key: string;
  params?: NotificationParams;
  severity: NotificationType;
  entity_type?: string;
  entity_id?: string;
  
  // Event info
  event_type: NotificationEventType;
  
  // Legacy fields (optional, for backward compatibility)
  type?: NotificationType;
  title?: string;
  message?: string;
  
  // CTA
  cta_label_key?: string;
  cta_label?: string;
  cta_target?: string;
  
  // References
  reference_id?: string;
  metadata?: NotificationParams;
}

/**
 * Message Contract: Title keys for each event type
 */
export const NOTIFICATION_TITLE_KEYS: Record<NotificationEventType, string> = {
  PAYMENT_DELAYED: 'notifications.messages.payment_delayed_title',
  MONTH_AT_RISK: 'notifications.messages.month_at_risk_title',
  MONTH_AT_RISK_PREVIEW: 'notifications.messages.month_at_risk_preview_title',
  UPCOMING_EXPENSE_COVERAGE_RISK: 'notifications.messages.coverage_risk_title',
  MONTH_RECOVERED: 'notifications.messages.month_recovered_title',
  RISK_REDUCED: 'notifications.messages.risk_reduced_title',
  RECURRING_LATE_PAYMENT: 'notifications.messages.recurring_late_payment_title',
  MISSING_RECURRING_EXPENSE: 'notifications.messages.missing_recurring_expense_title',
};

/**
 * Message Contract: Message keys for each event type
 */
export const NOTIFICATION_MESSAGE_KEYS: Record<NotificationEventType, string> = {
  PAYMENT_DELAYED: 'notifications.messages.payment_delayed',
  MONTH_AT_RISK: 'notifications.messages.month_at_risk',
  MONTH_AT_RISK_PREVIEW: 'notifications.messages.month_at_risk_preview',
  UPCOMING_EXPENSE_COVERAGE_RISK: 'notifications.messages.coverage_risk',
  MONTH_RECOVERED: 'notifications.messages.month_recovered',
  RISK_REDUCED: 'notifications.messages.risk_reduced',
  RECURRING_LATE_PAYMENT: 'notifications.messages.recurring_late_payment',
  MISSING_RECURRING_EXPENSE: 'notifications.messages.missing_recurring_expense',
};

/**
 * CTA Label keys
 */
export const CTA_LABEL_KEYS = {
  VIEW_TRANSACTIONS: 'common.viewTransactions',
  VIEW_TRANSACTION: 'common.viewTransaction',
  VIEW_DETAILS: 'common.viewDetails',
  VIEW_PENDING: 'common.viewPending',
} as const;

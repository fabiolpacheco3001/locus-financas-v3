/**
 * evaluateNotificationRules - Pure function to evaluate notification rules
 * 
 * PURE FUNCTION - Returns actions to be taken, does NOT execute them
 * 
 * MESSAGE CONTRACT: This function returns message_key + params instead of final text.
 * All text rendering happens at the UI layer via i18n.
 */

import { 
  MonthlySnapshot, 
  ForecastState, 
  RiskAssessment,
  NotificationRuleAction,
  BalanceState,
  BalanceTransition,
  ToastPayload,
} from './types';
import { logger } from './logger';

export interface NotificationRulesInput {
  snapshot: MonthlySnapshot;
  forecast: ForecastState;
  riskAssessment: RiskAssessment;
  previousBalanceState: BalanceState | null;
  balanceTransition: BalanceTransition | null;
}

export interface NotificationRulesOutput {
  actions: NotificationRuleAction[];
  toasts: ToastPayload[];
}

/**
 * Evaluate notification rules and return actions to be taken
 * 
 * PURE FUNCTION - No side effects
 * MESSAGE CONTRACT - Returns message_key + params, not final text
 * 
 * @param input - Current state to evaluate
 * @returns List of actions to be taken by the service layer
 */
export function evaluateNotificationRules(
  input: NotificationRulesInput
): NotificationRulesOutput {
  const { 
    snapshot, 
    forecast, 
    riskAssessment, 
    previousBalanceState,
    balanceTransition 
  } = input;
  
  const actions: NotificationRuleAction[] = [];
  const toasts: ToastPayload[] = [];
  
  logger.rules('Evaluating notification rules', {
    monthKey: snapshot.monthKey,
    balanceState: forecast.balanceState,
    previousState: previousBalanceState,
    transition: balanceTransition,
  });
  
  // ========================================
  // RULE: Balance State Transition Toasts
  // ========================================
  if (balanceTransition === 'POSITIVE_TO_NEGATIVE') {
    toasts.push({
      variant: 'destructive',
      titleKey: 'toasts.risk_month_negative.title',
      descriptionKey: 'toasts.risk_month_negative.description',
      params: { amount: Math.abs(forecast.riskAmount) },
    });
    logger.rules('Toast queued: Risk (POSITIVE_TO_NEGATIVE)');
  }
  
  if (balanceTransition === 'NEGATIVE_TO_POSITIVE') {
    toasts.push({
      titleKey: 'toasts.month_recovered.title',
      descriptionKey: 'toasts.month_recovered.description',
      params: {},
    });
    logger.rules('Toast queued: Recovery (NEGATIVE_TO_POSITIVE)');
  }
  
  // ========================================
  // RULE: Overdue Payments Notification
  // ========================================
  if (riskAssessment.hasOverdueExpenses) {
    const { overdueExpenses } = riskAssessment;
    const count = overdueExpenses.length;
    const maxDaysOverdue = Math.max(...overdueExpenses.map(e => e.daysOverdue));
    
    const isSingleExpense = count === 1;
    const expense = isSingleExpense ? overdueExpenses[0] : null;
    
    // Determine message key based on count and severity
    const messageKey = isSingleExpense 
      ? 'notifications.messages.payment_delayed_single'
      : 'notifications.messages.payment_delayed_multiple';
    
    const severity = maxDaysOverdue > 7 ? 'action' : 'warning';
    
    actions.push({
      type: 'CREATE',
      payload: {
        eventType: 'PAYMENT_DELAYED',
        referenceId: 'overdue_payments',
        messageKey,
        params: {
          count,
          maxDaysOverdue,
          daysOverdue: expense?.daysOverdue ?? maxDaysOverdue,
          description: expense?.description ?? '',
          categoryName: expense?.categoryName ?? '',
          subcategoryName: expense?.subcategoryName ?? '',
          transactionIds: overdueExpenses.map(e => e.id),
        },
        severity,
        entityType: 'transaction',
        entityId: isSingleExpense ? expense?.id : undefined,
        ctaLabelKey: 'common.viewTransactions',
        ctaTarget: '/transactions?view=overdue',
      },
    });
    
    logger.rules('Action queued: PAYMENT_DELAYED', { count, maxDaysOverdue });
  }
  
  // ========================================
  // RULE: Month at Risk Notification
  // ========================================
  if (forecast.isNegative && !riskAssessment.hasOverdueExpenses) {
    if (forecast.showRiskPreview) {
      // Preview (warning) - 5+ days before month end
      actions.push({
        type: 'CREATE',
        payload: {
          eventType: 'MONTH_AT_RISK_PREVIEW',
          referenceId: snapshot.monthKey,
          messageKey: 'notifications.messages.month_at_risk_preview',
          params: {
            monthKey: snapshot.monthKey,
          },
          severity: 'warning',
          entityType: 'month',
          entityId: snapshot.monthKey,
          ctaLabelKey: 'common.viewTransactions',
          ctaTarget: `/transactions?view=month_pending&month=${snapshot.monthKey}`,
        },
      });
      logger.rules('Action queued: MONTH_AT_RISK_PREVIEW');
    } else {
      // Full risk (action)
      actions.push({
        type: 'CREATE',
        payload: {
          eventType: 'MONTH_AT_RISK',
          referenceId: snapshot.monthKey,
          messageKey: 'notifications.messages.month_at_risk',
          params: {
            amount: Math.abs(forecast.riskAmount),
            monthKey: snapshot.monthKey,
          },
          severity: 'action',
          entityType: 'month',
          entityId: snapshot.monthKey,
          ctaLabelKey: 'common.viewTransactions',
          ctaTarget: '/transactions?view=overdue',
        },
      });
      logger.rules('Action queued: MONTH_AT_RISK');
    }
  }
  
  // ========================================
  // RULE: Coverage Risk Notification
  // ========================================
  if (riskAssessment.hasCoverageRisk && !riskAssessment.hasOverdueExpenses && !forecast.isNegative) {
    for (const expense of riskAssessment.coverageRiskExpenses) {
      actions.push({
        type: 'CREATE',
        payload: {
          eventType: 'UPCOMING_EXPENSE_COVERAGE_RISK',
          referenceId: expense.id,
          messageKey: 'notifications.messages.coverage_risk',
          params: {
            description: expense.description,
            daysUntilDue: expense.daysUntilDue,
            amount: expense.amount,
          },
          severity: 'warning',
          entityType: 'transaction',
          entityId: expense.id,
          ctaLabelKey: 'common.viewTransaction',
          ctaTarget: `/transactions?highlight=${expense.id}`,
        },
      });
      logger.rules('Action queued: UPCOMING_EXPENSE_COVERAGE_RISK', { expenseId: expense.id });
    }
  }
  
  // ========================================
  // RULE: Month Recovered (archive risk notifications)
  // ========================================
  if (balanceTransition === 'NEGATIVE_TO_POSITIVE') {
    actions.push({
      type: 'ARCHIVE',
      eventType: 'MONTH_AT_RISK',
      referenceId: snapshot.monthKey,
    });
    actions.push({
      type: 'ARCHIVE',
      eventType: 'MONTH_AT_RISK_PREVIEW',
      referenceId: snapshot.monthKey,
    });
    logger.rules('Action queued: Archive risk notifications');
  }
  
  logger.rules(`Rules evaluation complete: ${actions.length} actions, ${toasts.length} toasts`);
  
  return { actions, toasts };
}

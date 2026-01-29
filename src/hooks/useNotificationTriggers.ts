import { useCallback } from 'react';
import { useNotifications } from './useNotifications';
import { NotificationParams, CTA_LABEL_KEYS } from '@/types/notifications';
import { format, differenceInDays, parseISO } from 'date-fns';

interface TriggerOptions {
  referenceMonth?: Date;
  referenceId?: string;
  amount?: number;
  description?: string;
  daysOverdue?: number;
}

interface OverdueTransaction {
  id: string;
  description: string;
  daysOverdue: number;
  subcategoryName?: string;
  categoryName?: string;
}

interface TriggerPaymentDelayedBatchOptions {
  overdueTransactions: OverdueTransaction[];
}

// AI Decision Rule 01 options
interface TriggerRecurringLatePaymentOptions {
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  lateOccurrences: number;
  averageDaysLate: number;
  referenceKey: string;
}

// AI Decision Rule 02 options
interface TriggerMissingRecurringExpenseOptions {
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  averageAmount: number;
  referenceKey: string;
}

// AI: Conta pode faltar cobertura
interface TriggerUpcomingExpenseCoverageRiskOptions {
  transactionId: string;
  categoryName: string;
  subcategoryName: string | null;
  amount: number;
  daysUntilDue: number;
}

export function useNotificationTriggers() {
  const { 
    createNotification, 
    findActiveNotification, 
    checkNotificationAction,
    updateNotification,
    archiveByReference 
  } = useNotifications();

  // ========================================
  // IDEMPOTENCY RULES:
  // 1. dedupe_key = event_type:entity_type:entity_id:time_window(month)
  // 2. If OPEN notification exists with same dedupe_key → UPDATE it
  // 3. If ARCHIVED notification exists → Only create if state escalates
  // 4. Month navigation does NOT create new notifications
  // ========================================

  // MONTH_AT_RISK notification - upsert logic with deduplication
  const triggerMonthAtRisk = useCallback(async (options: TriggerOptions) => {
    const { referenceMonth, amount } = options;
    if (!referenceMonth || amount === undefined) return;

    const monthKey = format(referenceMonth, 'yyyy-MM');
    const severity = 'action' as const;

    // Check what action to take using idempotency rules
    const result = await checkNotificationAction('MONTH_AT_RISK', monthKey, {
      newType: severity,
      allowStateEscalation: true,
      entityType: 'month',
    });

    if (result.action === 'skip') {
      return;
    }

    const params: NotificationParams = {
      amount: Math.abs(amount),
      monthKey,
    };

    if (result.action === 'update') {
      await updateNotification.mutateAsync({ 
        id: result.notification.id, 
        message_key: 'notifications.messages.month_at_risk',
        params,
        severity,
        cta_label_key: CTA_LABEL_KEYS.VIEW_TRANSACTIONS,
        cta_target: '/transactions?view=overdue',
      });
      return;
    }

    await createNotification.mutateAsync({
      message_key: 'notifications.messages.month_at_risk',
      params,
      severity,
      event_type: 'MONTH_AT_RISK',
      entity_type: 'month',
      entity_id: monthKey,
      cta_label_key: CTA_LABEL_KEYS.VIEW_TRANSACTIONS,
      cta_target: '/transactions?view=overdue',
      reference_id: monthKey,
    });
  }, [createNotification, checkNotificationAction, updateNotification]);

  // MONTH_AT_RISK_PREVIEW notification - AI preview warning
  const triggerMonthAtRiskPreview = useCallback(async (options: TriggerOptions) => {
    const { referenceMonth } = options;
    if (!referenceMonth) return;

    const monthKey = format(referenceMonth, 'yyyy-MM');
    const severity = 'warning' as const;

    const result = await checkNotificationAction('MONTH_AT_RISK_PREVIEW', monthKey, {
      newType: severity,
      entityType: 'month',
    });

    if (result.action === 'skip') {
      return;
    }

    const params: NotificationParams = {
      monthKey,
    };

    if (result.action === 'update') {
      await updateNotification.mutateAsync({ 
        id: result.notification.id, 
        message_key: 'notifications.messages.month_at_risk_preview',
        params,
        severity,
        cta_label_key: CTA_LABEL_KEYS.VIEW_TRANSACTIONS,
        cta_target: `/transactions?view=month_pending&month=${monthKey}`,
      });
      return;
    }

    await createNotification.mutateAsync({
      message_key: 'notifications.messages.month_at_risk_preview',
      params,
      severity,
      event_type: 'MONTH_AT_RISK_PREVIEW',
      entity_type: 'month',
      entity_id: monthKey,
      cta_label_key: CTA_LABEL_KEYS.VIEW_TRANSACTIONS,
      cta_target: `/transactions?view=month_pending&month=${monthKey}`,
      reference_id: monthKey,
    });
  }, [createNotification, checkNotificationAction, updateNotification]);

  // Archive MONTH_AT_RISK_PREVIEW when conditions no longer apply
  const archiveMonthAtRiskPreview = useCallback(async (referenceMonth: Date) => {
    const monthKey = format(referenceMonth, 'yyyy-MM');
    await archiveByReference.mutateAsync({ 
      eventType: 'MONTH_AT_RISK_PREVIEW', 
      referenceId: monthKey 
    });
  }, [archiveByReference]);

  // PAYMENT_DELAYED notification - BATCH/GROUPED version
  const triggerPaymentDelayedBatch = useCallback(async (options: TriggerPaymentDelayedBatchOptions) => {
    const { overdueTransactions } = options;
    if (!overdueTransactions || overdueTransactions.length === 0) return;

    const count = overdueTransactions.length;
    const maxDaysOverdue = Math.max(...overdueTransactions.map(t => t.daysOverdue));
    const transactionIds = overdueTransactions.map(t => t.id);
    
    const severity = maxDaysOverdue > 7 ? 'action' as const : 'warning' as const;
    const referenceId = 'overdue_payments';

    const result = await checkNotificationAction('PAYMENT_DELAYED', referenceId, {
      newType: severity,
      allowStateEscalation: true,
      entityType: 'transaction',
    });

    // Get first transaction details for single expense message
    const tx = count === 1 ? overdueTransactions[0] : null;
    
    const messageKey = count === 1 
      ? 'notifications.messages.payment_delayed_single'
      : 'notifications.messages.payment_delayed_multiple';
    
    const params: NotificationParams = {
      count,
      maxDaysOverdue,
      daysOverdue: tx?.daysOverdue ?? maxDaysOverdue,
      description: tx?.description ?? '',
      categoryName: tx?.categoryName ?? '',
      subcategoryName: tx?.subcategoryName ?? '',
      transactionIds,
    };

    if (result.action === 'update') {
      await updateNotification.mutateAsync({ 
        id: result.notification.id, 
        message_key: messageKey,
        params,
        severity,
        cta_label_key: CTA_LABEL_KEYS.VIEW_TRANSACTIONS,
        cta_target: '/transactions?view=overdue',
      });
      return;
    }

    if (result.action === 'skip') {
      return;
    }

    await createNotification.mutateAsync({
      message_key: messageKey,
      params,
      severity,
      event_type: 'PAYMENT_DELAYED',
      entity_type: 'transaction',
      entity_id: tx?.id,
      cta_label_key: CTA_LABEL_KEYS.VIEW_TRANSACTIONS,
      cta_target: '/transactions?view=overdue',
      reference_id: referenceId,
    });
  }, [createNotification, checkNotificationAction, updateNotification]);

  // Legacy single-transaction trigger
  const triggerPaymentDelayed = useCallback(async (options: TriggerOptions) => {
    const { referenceId, description, daysOverdue = 1 } = options;
    if (!referenceId || !description) return;

    await triggerPaymentDelayedBatch({
      overdueTransactions: [{
        id: referenceId,
        description,
        daysOverdue,
      }],
    });
  }, [triggerPaymentDelayedBatch]);

  // RISK_REDUCED notification
  const triggerRiskReduced = useCallback(async (options: TriggerOptions) => {
    const { amount } = options;
    if (amount === undefined || amount <= 0) return;

    await createNotification.mutateAsync({
      message_key: 'notifications.messages.risk_reduced',
      params: { amount: Math.abs(amount) },
      severity: 'success',
      event_type: 'RISK_REDUCED',
      entity_type: 'generic',
    });
  }, [createNotification]);

  // MONTH_RECOVERED notification
  const triggerMonthRecovered = useCallback(async (options: TriggerOptions) => {
    const { referenceMonth } = options;
    if (!referenceMonth) return;

    const monthKey = format(referenceMonth, 'yyyy-MM');

    await archiveByReference.mutateAsync({ 
      eventType: 'MONTH_AT_RISK', 
      referenceId: monthKey 
    });

    await createNotification.mutateAsync({
      message_key: 'notifications.messages.month_recovered',
      params: { monthKey },
      severity: 'success',
      event_type: 'MONTH_RECOVERED',
      entity_type: 'month',
      entity_id: monthKey,
      reference_id: monthKey,
    });
  }, [createNotification, archiveByReference]);

  // Auto-archive PAYMENT_DELAYED when all transactions are paid
  const archivePaymentDelayed = useCallback(async () => {
    await archiveByReference.mutateAsync({ 
      eventType: 'PAYMENT_DELAYED', 
      referenceId: 'overdue_payments' 
    });
  }, [archiveByReference]);

  // ========================================
  // AI DECISION TRIGGERS (Sprint 1)
  // ========================================

  // REGRA 01 - CONTA VENCIDA RECORRENTE
  const triggerRecurringLatePayment = useCallback(async (options: TriggerRecurringLatePaymentOptions) => {
    const { 
      categoryId, 
      categoryName, 
      subcategoryId, 
      subcategoryName, 
      lateOccurrences,
      referenceKey 
    } = options;

    const severity = 'warning' as const;

    const result = await checkNotificationAction('RECURRING_LATE_PAYMENT', referenceKey, {
      newType: severity,
      entityType: 'category',
    });

    if (result.action === 'skip') {
      return;
    }

    const params: NotificationParams = {
      categoryId,
      categoryName,
      subcategoryId: subcategoryId ?? undefined,
      subcategoryName: subcategoryName ?? undefined,
      lateOccurrences,
      lastTriggeredAt: new Date().toISOString(),
    };

    if (result.action === 'update') {
      const lastTriggered = result.notification.params?.lastTriggeredAt;
      if (lastTriggered) {
        const daysSinceLastTrigger = differenceInDays(new Date(), parseISO(lastTriggered as string));
        if (daysSinceLastTrigger < 30) {
          return;
        }
      }
      
      await updateNotification.mutateAsync({
        id: result.notification.id,
        message_key: 'notifications.messages.recurring_late_payment',
        params,
        severity,
        cta_label_key: CTA_LABEL_KEYS.VIEW_TRANSACTIONS,
        cta_target: `/transactions?filter=late_pattern&category=${categoryId}${subcategoryId ? `&subcategory=${subcategoryId}` : ''}`,
      });
      return;
    }

    await createNotification.mutateAsync({
      message_key: 'notifications.messages.recurring_late_payment',
      params,
      severity,
      event_type: 'RECURRING_LATE_PAYMENT',
      entity_type: 'category',
      entity_id: subcategoryId ?? categoryId,
      cta_label_key: CTA_LABEL_KEYS.VIEW_TRANSACTIONS,
      cta_target: `/transactions?filter=late_pattern&category=${categoryId}${subcategoryId ? `&subcategory=${subcategoryId}` : ''}`,
      reference_id: referenceKey,
    });
  }, [createNotification, checkNotificationAction, updateNotification]);

  // Archive RECURRING_LATE_PAYMENT when resolved
  const archiveRecurringLatePayment = useCallback(async (referenceKey: string) => {
    await archiveByReference.mutateAsync({ 
      eventType: 'RECURRING_LATE_PAYMENT', 
      referenceId: referenceKey 
    });
  }, [archiveByReference]);

  // REGRA 02 - DESPESA RECORRENTE NÃO REGISTRADA
  const triggerMissingRecurringExpense = useCallback(async (options: TriggerMissingRecurringExpenseOptions) => {
    const { 
      categoryId, 
      categoryName, 
      subcategoryId, 
      subcategoryName, 
      averageAmount,
      referenceKey 
    } = options;

    const severity = 'warning' as const;

    const result = await checkNotificationAction('MISSING_RECURRING_EXPENSE', referenceKey, {
      newType: severity,
      entityType: 'category',
    });

    if (result.action === 'skip') {
      return;
    }

    const params: NotificationParams = {
      categoryId,
      categoryName,
      subcategoryId: subcategoryId ?? undefined,
      subcategoryName: subcategoryName ?? undefined,
      averageAmount,
    };

    if (result.action === 'update') {
      await updateNotification.mutateAsync({
        id: result.notification.id,
        message_key: 'notifications.messages.missing_recurring_expense',
        params,
        severity,
        cta_label_key: CTA_LABEL_KEYS.VIEW_TRANSACTIONS,
        cta_target: `/transactions?prefill_category=${categoryId}${subcategoryId ? `&prefill_subcategory=${subcategoryId}` : ''}&prefill_amount=${Math.round(averageAmount)}`,
      });
      return;
    }

    await createNotification.mutateAsync({
      message_key: 'notifications.messages.missing_recurring_expense',
      params,
      severity,
      event_type: 'MISSING_RECURRING_EXPENSE',
      entity_type: 'category',
      entity_id: subcategoryId ?? categoryId,
      cta_label_key: CTA_LABEL_KEYS.VIEW_TRANSACTIONS,
      cta_target: `/transactions?prefill_category=${categoryId}${subcategoryId ? `&prefill_subcategory=${subcategoryId}` : ''}&prefill_amount=${Math.round(averageAmount)}`,
      reference_id: referenceKey,
    });
  }, [createNotification, checkNotificationAction, updateNotification]);

  // Archive MISSING_RECURRING_EXPENSE when expense is registered
  const archiveMissingRecurringExpense = useCallback(async (referenceKey: string) => {
    await archiveByReference.mutateAsync({ 
      eventType: 'MISSING_RECURRING_EXPENSE', 
      referenceId: referenceKey 
    });
  }, [archiveByReference]);

  // ========================================
  // UPCOMING_EXPENSE_COVERAGE_RISK
  // ========================================
  const triggerUpcomingExpenseCoverageRisk = useCallback(async (options: TriggerUpcomingExpenseCoverageRiskOptions) => {
    const { 
      transactionId, 
      categoryName, 
      subcategoryName, 
      amount,
      daysUntilDue 
    } = options;

    const severity = 'warning' as const;

    const result = await checkNotificationAction('UPCOMING_EXPENSE_COVERAGE_RISK', transactionId, {
      newType: severity,
      entityType: 'transaction',
    });

    if (result.action === 'skip') {
      return;
    }

    const params: NotificationParams = {
      transactionId,
      categoryName,
      subcategoryName: subcategoryName ?? undefined,
      amount,
      daysUntilDue,
      description: subcategoryName ? `${subcategoryName} – ${categoryName}` : categoryName,
    };

    if (result.action === 'update') {
      await updateNotification.mutateAsync({
        id: result.notification.id,
        message_key: 'notifications.messages.coverage_risk',
        params,
        severity,
        cta_label_key: CTA_LABEL_KEYS.VIEW_TRANSACTION,
        cta_target: `/transactions?view=single&id=${transactionId}`,
      });
      return;
    }

    await createNotification.mutateAsync({
      message_key: 'notifications.messages.coverage_risk',
      params,
      severity,
      event_type: 'UPCOMING_EXPENSE_COVERAGE_RISK',
      entity_type: 'transaction',
      entity_id: transactionId,
      cta_label_key: CTA_LABEL_KEYS.VIEW_TRANSACTION,
      cta_target: `/transactions?view=single&id=${transactionId}`,
      reference_id: transactionId,
    });
  }, [createNotification, checkNotificationAction, updateNotification]);

  // Archive UPCOMING_EXPENSE_COVERAGE_RISK when transaction is paid
  const archiveUpcomingExpenseCoverageRisk = useCallback(async (transactionId: string) => {
    await archiveByReference.mutateAsync({ 
      eventType: 'UPCOMING_EXPENSE_COVERAGE_RISK', 
      referenceId: transactionId 
    });
  }, [archiveByReference]);

  // Check if precedence-blocking notifications exist
  const hasBlockingNotifications = useCallback(async () => {
    const [hasOverdue, hasMonthAtRisk, hasMonthAtRiskPreview] = await Promise.all([
      findActiveNotification('PAYMENT_DELAYED', 'overdue_payments'),
      findActiveNotification('MONTH_AT_RISK'),
      findActiveNotification('MONTH_AT_RISK_PREVIEW'),
    ]);
    return !!(hasOverdue || hasMonthAtRisk || hasMonthAtRiskPreview);
  }, [findActiveNotification]);

  return {
    triggerMonthAtRisk,
    triggerMonthAtRiskPreview,
    archiveMonthAtRiskPreview,
    triggerPaymentDelayed,
    triggerPaymentDelayedBatch,
    triggerRiskReduced,
    triggerMonthRecovered,
    archivePaymentDelayed,
    // AI Decision triggers
    triggerRecurringLatePayment,
    archiveRecurringLatePayment,
    triggerMissingRecurringExpense,
    archiveMissingRecurringExpense,
    // Upcoming expense coverage risk
    triggerUpcomingExpenseCoverageRisk,
    archiveUpcomingExpenseCoverageRisk,
    hasBlockingNotifications,
  };
}

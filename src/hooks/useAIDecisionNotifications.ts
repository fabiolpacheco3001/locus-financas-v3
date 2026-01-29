import { useMemo } from 'react';
import { useAIDecisionDetection } from './useAIDecisionDetection';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction } from '@/types/finance';

interface AIDecisionNotificationsInput {
  transactions: Transaction[];
  selectedMonth: Date;
  enabled?: boolean;
}

/**
 * i18n-safe pattern interface for recurring late payments.
 * Contains messageKey + params for UI translation.
 */
export interface RecurringLatePaymentPattern {
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  lateOccurrences: number;
  averageDaysLate: number;
  referenceKey: string;
  /** i18n message key for title */
  titleKey: string;
  /** i18n message key for message body */
  messageKey: string;
  /** Parameters for i18n interpolation */
  params: Record<string, unknown>;
}

/**
 * i18n-safe pattern interface for missing recurring expenses.
 * Contains messageKey + params for UI translation.
 */
export interface MissingRecurringExpensePattern {
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  averageAmount: number;
  referenceKey: string;
  /** i18n message key for title */
  titleKey: string;
  /** i18n message key for message body */
  messageKey: string;
  /** Parameters for i18n interpolation */
  params: Record<string, unknown>;
}

export interface AIDecisionIndicators {
  recurringLatePayments: RecurringLatePaymentPattern[];
  missingRecurringExpenses: MissingRecurringExpensePattern[];
  hasRecurringLatePayments: boolean;
  hasMissingRecurringExpenses: boolean;
  isProcessing: boolean;
}

/**
 * Hook that detects AI patterns for UI display only.
 * NO database writes - just computes state for toasts/banners.
 * 
 * CRITICAL: Returns messageKey + params for i18n-safe rendering.
 * UI must translate using t(messageKey, params).
 * 
 * Notifications are persisted ONLY by:
 * - Transaction data events (create/edit/confirm/cancel)
 * - Daily scheduled job
 * 
 * Implements pattern detection for:
 * - REGRA 01: Conta vencida recorrente
 * - REGRA 02: Despesa recorrente não registrada
 */
export function useAIDecisionNotifications({
  transactions,
  selectedMonth,
  enabled = true,
}: AIDecisionNotificationsInput): AIDecisionIndicators {
  const { householdId } = useAuth();
  
  const {
    recurringLatePayments: detectedLatePayments,
    missingRecurringExpenses: detectedMissingExpenses,
    checkMissingExpenseResolved,
    checkLatePaymentResolved,
    isLoading,
  } = useAIDecisionDetection({
    transactions,
    selectedMonth,
    enabled,
  });

  // Filter patterns that are not resolved (UI display only)
  const indicators = useMemo<AIDecisionIndicators>(() => {
    if (!householdId || !enabled || isLoading) {
      return {
        recurringLatePayments: [],
        missingRecurringExpenses: [],
        hasRecurringLatePayments: false,
        hasMissingRecurringExpenses: false,
        isProcessing: isLoading,
      };
    }

    // Filter late payments that are not resolved - with i18n keys
    const recurringLatePayments: RecurringLatePaymentPattern[] = detectedLatePayments
      .filter(pattern => !checkLatePaymentResolved(pattern.categoryId, pattern.subcategoryId))
      .map(pattern => ({
        categoryId: pattern.categoryId,
        categoryName: pattern.categoryName,
        subcategoryId: pattern.subcategoryId,
        subcategoryName: pattern.subcategoryName,
        lateOccurrences: pattern.lateOccurrences,
        averageDaysLate: pattern.averageDaysLate,
        referenceKey: pattern.referenceKey,
        // i18n-safe keys
        titleKey: 'notifications.recurring_late_payment.title',
        messageKey: 'notifications.recurring_late_payment.message',
        params: {
          categoryName: pattern.categoryName,
          subcategoryName: pattern.subcategoryName || '',
          occurrences: pattern.lateOccurrences,
          averageDays: Math.round(pattern.averageDaysLate),
        },
      }));

    // Filter missing expenses that are not resolved - with i18n keys
    const missingRecurringExpenses: MissingRecurringExpensePattern[] = detectedMissingExpenses
      .filter(pattern => !checkMissingExpenseResolved(pattern.categoryId, pattern.subcategoryId))
      .map(pattern => ({
        categoryId: pattern.categoryId,
        categoryName: pattern.categoryName,
        subcategoryId: pattern.subcategoryId,
        subcategoryName: pattern.subcategoryName,
        averageAmount: pattern.averageAmount,
        referenceKey: pattern.referenceKey,
        // i18n-safe keys
        titleKey: 'notifications.missing_recurring_expense.title',
        messageKey: 'notifications.missing_recurring_expense.message',
        params: {
          categoryName: pattern.categoryName,
          subcategoryName: pattern.subcategoryName || '',
          amount: pattern.averageAmount,
        },
      }));

    return {
      recurringLatePayments,
      missingRecurringExpenses,
      hasRecurringLatePayments: recurringLatePayments.length > 0,
      hasMissingRecurringExpenses: missingRecurringExpenses.length > 0,
      isProcessing: isLoading,
    };
  }, [
    householdId,
    enabled,
    isLoading,
    detectedLatePayments,
    detectedMissingExpenses,
    checkLatePaymentResolved,
    checkMissingExpenseResolved,
  ]);

  return indicators;
}

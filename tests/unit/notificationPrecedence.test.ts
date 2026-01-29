import { describe, it, expect } from 'vitest';

// Notification types from the app
type NotificationEventType = 
  | 'PAYMENT_DELAYED'
  | 'MONTH_AT_RISK'
  | 'MONTH_AT_RISK_PREVIEW'
  | 'UPCOMING_EXPENSE_COVERAGE_RISK'
  | 'RECURRING_LATE_PAYMENT'
  | 'MISSING_RECURRING_EXPENSE'
  | 'RISK_REDUCED'
  | 'MONTH_RECOVERED';

interface Notification {
  id: string;
  event_type: NotificationEventType;
  reference_id: string | null;
  type: 'action' | 'warning' | 'success' | 'info';
  dismissed_at: string | null;
  metadata?: { transactionIds?: string[] };
}

/**
 * Extracted precedence filter logic from useNotifications.ts for testing
 * This mirrors the actual implementation at lines 380-418
 */
function applyPrecedenceFilter(notifications: Notification[]): Notification[] {
  const activeNotifications = notifications.filter(n => !n.dismissed_at);
  
  const hasOverdueExpenses = activeNotifications.some(
    n => n.event_type === 'PAYMENT_DELAYED'
  );
  
  const hasMonthAtRisk = activeNotifications.some(
    n => n.event_type === 'MONTH_AT_RISK' || n.event_type === 'MONTH_AT_RISK_PREVIEW'
  );
  
  const hasCoverageRisk = activeNotifications.some(
    n => n.event_type === 'UPCOMING_EXPENSE_COVERAGE_RISK'
  );
  
  // Get transaction IDs from overdue notifications
  const overdueTransactionIds = new Set<string>();
  activeNotifications
    .filter(n => n.event_type === 'PAYMENT_DELAYED')
    .forEach(n => {
      const transactionIds = n.metadata?.transactionIds;
      if (transactionIds) {
        transactionIds.forEach(id => overdueTransactionIds.add(id));
      }
    });
  
  return activeNotifications.filter(n => {
    // Priority 1: PAYMENT_DELAYED - always shown
    if (n.event_type === 'PAYMENT_DELAYED') {
      return true;
    }
    
    // Priority 2: MONTH_AT_RISK - always shown
    if (n.event_type === 'MONTH_AT_RISK' || n.event_type === 'MONTH_AT_RISK_PREVIEW') {
      return true;
    }
    
    // Priority 3: UPCOMING_EXPENSE_COVERAGE_RISK
    if (n.event_type === 'UPCOMING_EXPENSE_COVERAGE_RISK') {
      if (hasOverdueExpenses || hasMonthAtRisk) {
        return false;
      }
      const txId = n.reference_id;
      if (txId && overdueTransactionIds.has(txId)) {
        return false;
      }
      return true;
    }
    
    // Priority 4: RECURRING_LATE_PAYMENT
    if (n.event_type === 'RECURRING_LATE_PAYMENT') {
      if (hasOverdueExpenses || hasMonthAtRisk || hasCoverageRisk) {
        return false;
      }
      return true;
    }
    
    // All other notifications - always shown
    return true;
  });
}

function createNotification(overrides: Partial<Notification>): Notification {
  return {
    id: 'notif-' + Math.random().toString(36).substr(2, 9),
    event_type: 'RECURRING_LATE_PAYMENT',
    reference_id: null,
    type: 'warning',
    dismissed_at: null,
    ...overrides,
  };
}

describe('Notification Precedence Rules', () => {
  describe('RECURRING_LATE_PAYMENT hiding', () => {
    it('should hide "costuma atrasar" when "vencida" (PAYMENT_DELAYED) is active', () => {
      const notifications = [
        createNotification({ 
          event_type: 'PAYMENT_DELAYED', 
          reference_id: 'overdue_payments',
          type: 'action',
          metadata: { transactionIds: ['tx-1'] }
        }),
        createNotification({ 
          event_type: 'RECURRING_LATE_PAYMENT', 
          reference_id: 'tx-2',
          type: 'warning'
        }),
      ];

      const filtered = applyPrecedenceFilter(notifications);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].event_type).toBe('PAYMENT_DELAYED');
      expect(filtered.some(n => n.event_type === 'RECURRING_LATE_PAYMENT')).toBe(false);
    });

    it('should show RECURRING_LATE_PAYMENT when no higher priority alerts exist', () => {
      const notifications = [
        createNotification({ 
          event_type: 'RECURRING_LATE_PAYMENT', 
          reference_id: 'tx-1',
          type: 'warning'
        }),
      ];

      const filtered = applyPrecedenceFilter(notifications);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].event_type).toBe('RECURRING_LATE_PAYMENT');
    });

    it('should hide RECURRING_LATE_PAYMENT when MONTH_AT_RISK is active', () => {
      const notifications = [
        createNotification({ 
          event_type: 'MONTH_AT_RISK', 
          reference_id: '2025-01',
          type: 'warning'
        }),
        createNotification({ 
          event_type: 'RECURRING_LATE_PAYMENT', 
          reference_id: 'tx-1',
          type: 'warning'
        }),
      ];

      const filtered = applyPrecedenceFilter(notifications);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].event_type).toBe('MONTH_AT_RISK');
    });

    it('should hide RECURRING_LATE_PAYMENT when UPCOMING_EXPENSE_COVERAGE_RISK is active', () => {
      const notifications = [
        createNotification({ 
          event_type: 'UPCOMING_EXPENSE_COVERAGE_RISK', 
          reference_id: 'tx-1',
          type: 'warning'
        }),
        createNotification({ 
          event_type: 'RECURRING_LATE_PAYMENT', 
          reference_id: 'tx-2',
          type: 'warning'
        }),
      ];

      const filtered = applyPrecedenceFilter(notifications);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].event_type).toBe('UPCOMING_EXPENSE_COVERAGE_RISK');
    });
  });

  describe('PAYMENT_DELAYED (highest priority)', () => {
    it('should always show PAYMENT_DELAYED regardless of other notifications', () => {
      const notifications = [
        createNotification({ 
          event_type: 'PAYMENT_DELAYED', 
          type: 'action'
        }),
        createNotification({ 
          event_type: 'MONTH_AT_RISK', 
          type: 'warning'
        }),
        createNotification({ 
          event_type: 'UPCOMING_EXPENSE_COVERAGE_RISK',
          type: 'warning'
        }),
        createNotification({ 
          event_type: 'RECURRING_LATE_PAYMENT',
          type: 'warning'
        }),
      ];

      const filtered = applyPrecedenceFilter(notifications);
      
      expect(filtered.some(n => n.event_type === 'PAYMENT_DELAYED')).toBe(true);
    });
  });

  describe('UPCOMING_EXPENSE_COVERAGE_RISK', () => {
    it('should hide when PAYMENT_DELAYED includes the same transaction', () => {
      const notifications = [
        createNotification({ 
          event_type: 'PAYMENT_DELAYED', 
          type: 'action',
          metadata: { transactionIds: ['tx-1', 'tx-2'] }
        }),
        createNotification({ 
          event_type: 'UPCOMING_EXPENSE_COVERAGE_RISK',
          reference_id: 'tx-1', // Same transaction
          type: 'warning'
        }),
      ];

      const filtered = applyPrecedenceFilter(notifications);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].event_type).toBe('PAYMENT_DELAYED');
    });

    it('should hide when MONTH_AT_RISK is active', () => {
      const notifications = [
        createNotification({ 
          event_type: 'MONTH_AT_RISK', 
          type: 'warning'
        }),
        createNotification({ 
          event_type: 'UPCOMING_EXPENSE_COVERAGE_RISK',
          type: 'warning'
        }),
      ];

      const filtered = applyPrecedenceFilter(notifications);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].event_type).toBe('MONTH_AT_RISK');
    });
  });

  describe('Dismissed notifications', () => {
    it('should not include dismissed notifications in filtered results', () => {
      const notifications = [
        createNotification({ 
          event_type: 'PAYMENT_DELAYED', 
          type: 'action',
          dismissed_at: '2025-01-15T10:00:00Z'
        }),
        createNotification({ 
          event_type: 'RECURRING_LATE_PAYMENT',
          type: 'warning',
          dismissed_at: null
        }),
      ];

      const filtered = applyPrecedenceFilter(notifications);
      
      // RECURRING_LATE_PAYMENT should show because PAYMENT_DELAYED is dismissed
      expect(filtered).toHaveLength(1);
      expect(filtered[0].event_type).toBe('RECURRING_LATE_PAYMENT');
    });
  });
});

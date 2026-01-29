import { describe, it, expect, vi } from 'vitest';

// Types
interface Notification {
  id: string;
  event_type: string;
  reference_id: string | null;
  type: 'action' | 'warning' | 'success' | 'info';
  dismissed_at: string | null;
  created_at: string;
}

interface NotificationAction {
  action: 'create' | 'update' | 'skip';
  notification?: Notification;
}

/**
 * Simulates the checkNotificationAction logic from useNotifications.ts
 * This is the idempotency controller that determines what action to take
 */
function checkNotificationAction(
  existingNotifications: Notification[],
  eventType: string,
  referenceId: string,
  options?: {
    newType?: 'warning' | 'action' | 'success' | 'info';
    allowStateEscalation?: boolean;
  }
): NotificationAction {
  // Find the most recent notification with matching event_type + reference_id
  const matching = existingNotifications
    .filter(n => n.event_type === eventType && n.reference_id === referenceId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  const notification = matching[0];
  
  if (!notification) {
    // No existing notification - can create new
    return { action: 'create' };
  }
  
  // If notification is active (not dismissed), update it
  if (!notification.dismissed_at) {
    return { action: 'update', notification };
  }
  
  // Notification is archived - check if state escalation allows new creation
  if (options?.allowStateEscalation && options.newType === 'action' && notification.type === 'warning') {
    // State changed from warning → action (e.g., overdue → very late)
    return { action: 'create' };
  }
  
  // Archived notification exists with same state - skip (don't recreate)
  return { action: 'skip' };
}

function createNotification(overrides: Partial<Notification>): Notification {
  return {
    id: 'notif-' + Math.random().toString(36).substr(2, 9),
    event_type: 'PAYMENT_DELAYED',
    reference_id: 'overdue_payments',
    type: 'warning',
    dismissed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Notification Idempotency', () => {
  describe('Duplicate prevention with same dedupe_key (event_type + reference_id)', () => {
    it('should return "update" when active notification exists with same key', () => {
      const existingNotifications = [
        createNotification({
          event_type: 'MONTH_AT_RISK',
          reference_id: '2025-01',
          dismissed_at: null,
        }),
      ];

      const result = checkNotificationAction(
        existingNotifications,
        'MONTH_AT_RISK',
        '2025-01'
      );

      expect(result.action).toBe('update');
      expect(result.notification).toBeDefined();
    });

    it('should return "skip" when archived notification exists with same key', () => {
      const existingNotifications = [
        createNotification({
          event_type: 'MONTH_AT_RISK',
          reference_id: '2025-01',
          dismissed_at: '2025-01-10T10:00:00Z',
        }),
      ];

      const result = checkNotificationAction(
        existingNotifications,
        'MONTH_AT_RISK',
        '2025-01'
      );

      expect(result.action).toBe('skip');
    });

    it('should return "create" when no notification exists with the key', () => {
      const existingNotifications: Notification[] = [];

      const result = checkNotificationAction(
        existingNotifications,
        'MONTH_AT_RISK',
        '2025-01'
      );

      expect(result.action).toBe('create');
    });

    it('should return "create" when only different reference_id exists', () => {
      const existingNotifications = [
        createNotification({
          event_type: 'MONTH_AT_RISK',
          reference_id: '2024-12', // Different month
          dismissed_at: null,
        }),
      ];

      const result = checkNotificationAction(
        existingNotifications,
        'MONTH_AT_RISK',
        '2025-01' // Different reference_id
      );

      expect(result.action).toBe('create');
    });
  });

  describe('State escalation (warning → action)', () => {
    it('should allow creation when escalating from warning to action', () => {
      const existingNotifications = [
        createNotification({
          event_type: 'PAYMENT_DELAYED',
          reference_id: 'overdue_payments',
          type: 'warning',
          dismissed_at: '2025-01-10T10:00:00Z',
        }),
      ];

      const result = checkNotificationAction(
        existingNotifications,
        'PAYMENT_DELAYED',
        'overdue_payments',
        { newType: 'action', allowStateEscalation: true }
      );

      expect(result.action).toBe('create');
    });

    it('should skip when not escalating (same severity)', () => {
      const existingNotifications = [
        createNotification({
          event_type: 'PAYMENT_DELAYED',
          reference_id: 'overdue_payments',
          type: 'warning',
          dismissed_at: '2025-01-10T10:00:00Z',
        }),
      ];

      const result = checkNotificationAction(
        existingNotifications,
        'PAYMENT_DELAYED',
        'overdue_payments',
        { newType: 'warning', allowStateEscalation: true }
      );

      expect(result.action).toBe('skip');
    });
  });

  describe('Multiple notifications with same key', () => {
    it('should use the most recent notification for decision', () => {
      const existingNotifications = [
        createNotification({
          id: 'old-notif',
          event_type: 'MONTH_AT_RISK',
          reference_id: '2025-01',
          dismissed_at: '2025-01-05T10:00:00Z',
          created_at: '2025-01-01T10:00:00Z',
        }),
        createNotification({
          id: 'new-notif',
          event_type: 'MONTH_AT_RISK',
          reference_id: '2025-01',
          dismissed_at: null,
          created_at: '2025-01-10T10:00:00Z',
        }),
      ];

      const result = checkNotificationAction(
        existingNotifications,
        'MONTH_AT_RISK',
        '2025-01'
      );

      expect(result.action).toBe('update');
      expect(result.notification?.id).toBe('new-notif');
    });
  });
});

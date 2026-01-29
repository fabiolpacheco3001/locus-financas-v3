import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Notification, CreateNotificationInput, NotificationEventType, NotificationParams } from '@/types/notifications';
import { useEffect, useCallback } from 'react';
import { format, startOfMonth } from 'date-fns';
import { sanitizeNotificationMetadata, sanitizeNotificationParams } from '@/lib/sanitizeMetadata';
import type { Json } from '@/integrations/supabase/types';

/**
 * Time window types for notification deduplication.
 */
type TimeWindow = 'month' | 'day' | 'none';

/**
 * Generate a dedupe_key for idempotent notification creation.
 * Format: {event_type}:{entity_type}:{entity_id}:{time_window}
 */
function generateDedupeKey(
  eventType: string,
  entityType: string = 'generic',
  entityId: string = '',
  timeWindow: TimeWindow = 'month',
  referenceDate: Date = new Date()
): string {
  let timeKey = '';
  
  switch (timeWindow) {
    case 'month':
      timeKey = format(startOfMonth(referenceDate), 'yyyy-MM');
      break;
    case 'day':
      timeKey = format(referenceDate, 'yyyy-MM-dd');
      break;
    case 'none':
      timeKey = 'always';
      break;
  }
  
  return `${eventType}:${entityType}:${entityId}:${timeKey}`;
}

export function useNotifications() {
  const { householdId } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all notifications (including archived for history view)
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', householdId],
    queryFn: async () => {
      if (!householdId) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!householdId,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!householdId) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', householdId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, queryClient]);

  /**
   * Check if an open notification with the given dedupe_key already exists.
   * Used for idempotency checks.
   */
  const hasOpenNotificationByDedupeKey = useCallback(async (
    dedupeKey: string
  ): Promise<{ exists: boolean; notification?: Notification }> => {
    if (!householdId) return { exists: false };

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('household_id', householdId)
      .eq('dedupe_key', dedupeKey)
      .is('dismissed_at', null)
      .limit(1)
      .maybeSingle();

    if (error || !data) return { exists: false };
    return { exists: true, notification: data as Notification };
  }, [householdId]);

  // Create notification using Message Contract with idempotency
  const createNotification = useMutation({
    mutationFn: async (input: CreateNotificationInput) => {
      if (!householdId) throw new Error('No household');

      // Generate dedupe_key for idempotency
      const dedupeKey = generateDedupeKey(
        input.event_type,
        input.entity_type || 'generic',
        input.entity_id || input.reference_id || '',
        'month'
      );

      // IDEMPOTENCY CHECK: If open notification exists, update instead of create
      const existing = await hasOpenNotificationByDedupeKey(dedupeKey);
      
      if (existing.exists && existing.notification) {
        // Update existing notification instead of creating duplicate
        // Sanitize params before update
        const sanitizedParams = sanitizeNotificationParams(input.params);

        const { error } = await supabase
          .from('notifications')
          .update({
            message_key: input.message_key,
            params: sanitizedParams as Json,
            severity: input.severity,
            type: input.severity,
            read_at: null,
            status: 'unread',
            cta_label_key: input.cta_label_key || null,
            cta_target: input.cta_target || null,
          })
          .eq('id', existing.notification.id);

        if (error) throw error;
        return existing.notification;
      }

      // Check for archived notification with same dedupe_key (state escalation)
      const { data: archivedData } = await supabase
        .from('notifications')
        .select('id, severity, type')
        .eq('household_id', householdId)
        .eq('dedupe_key', dedupeKey)
        .not('dismissed_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (archivedData) {
        const existingSeverity = archivedData.severity || archivedData.type;
        // Only create new if escalating from warning → action
        if (!(input.severity === 'action' && existingSeverity === 'warning')) {
          // Skip creation - already processed
          return null;
        }
      }

      // Sanitize params and metadata before insertion
      const sanitizedParams = sanitizeNotificationParams(input.params);
      const sanitizedMetadata = sanitizeNotificationMetadata(input.params);

      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          household_id: householdId,
          dedupe_key: dedupeKey,
          message_key: input.message_key,
          params: sanitizedParams as Json,
          severity: input.severity,
          entity_type: input.entity_type || 'generic',
          entity_id: input.entity_id || null,
          status: 'unread',
          type: input.severity, // Legacy field
          event_type: input.event_type,
          title: '', // Legacy field - empty, use message_key
          message: '', // Legacy field - empty, use message_key
          cta_label_key: input.cta_label_key || null,
          cta_label: '', // Legacy field
          cta_target: input.cta_target || null,
          reference_id: input.reference_id || null,
          metadata: sanitizedMetadata as Json,
        }])
        .select()
        .maybeSingle();

      if (error) {
        // Handle unique constraint violation (race condition)
        if (error.code === '23505') {
          console.log('Notification already exists (dedupe conflict), skipping');
          return null;
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', householdId] });
    },
    onError: (error) => {
      // Silent fail for notification creation - non-critical, log for debugging
      console.error('[Notifications] Failed to create notification:', error);
    },
  });

  // Mark as read
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          read_at: new Date().toISOString(),
          status: 'read',
        })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', householdId] });
    },
    onError: (error) => {
      // Silent fail for mark as read - non-critical
      console.error('[Notifications] Failed to mark as read:', error);
    },
  });

  // Dismiss notification
  const dismiss = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          dismissed_at: new Date().toISOString(),
          status: 'archived',
        })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', householdId] });
    },
    onError: (error) => {
      // Silent fail for dismiss - non-critical
      console.error('[Notifications] Failed to dismiss notification:', error);
    },
  });

  // Find existing active notification by event_type and reference_id
  const findActiveNotification = async (
    eventType: string,
    referenceId?: string
  ): Promise<Notification | null> => {
    if (!householdId) return null;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('household_id', householdId)
      .eq('event_type', eventType)
      .is('dismissed_at', null);

    if (referenceId) {
      query = query.eq('reference_id', referenceId);
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error || !data) return null;
    return data as Notification;
  };

  // ========================================
  // IDEMPOTENCY RULES
  // ========================================
  
  /**
   * Check what action to take for a notification.
   * This is the CORE idempotency check.
   * 
   * Returns:
   * - 'skip': An open or archived notification exists, don't create
   * - 'update': An open notification exists, update it
   * - 'create': No notification exists, create new
   */
  const checkNotificationAction = async (
    eventType: string,
    referenceId: string,
    options?: {
      newType?: 'warning' | 'action' | 'success' | 'info';
      allowStateEscalation?: boolean;
      entityType?: string;
    }
  ): Promise<{ action: 'update'; notification: Notification } | { action: 'create' } | { action: 'skip' }> => {
    if (!householdId) return { action: 'skip' };

    // Generate dedupe_key for lookup
    const dedupeKey = generateDedupeKey(
      eventType,
      options?.entityType || 'generic',
      referenceId,
      'month'
    );

    // First check by dedupe_key (preferred)
    const { data: byDedupeKey } = await supabase
      .from('notifications')
      .select('*')
      .eq('household_id', householdId)
      .eq('dedupe_key', dedupeKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byDedupeKey) {
      const notification = byDedupeKey as Notification;
      
      // If not dismissed, update it
      if (!notification.dismissed_at) {
        return { action: 'update', notification };
      }

      // If dismissed, check for state escalation
      if (options?.allowStateEscalation && options.newType === 'action' && 
          (notification.type === 'warning' || notification.severity === 'warning')) {
        return { action: 'create' };
      }

      // Already dismissed, skip
      return { action: 'skip' };
    }

    // Fallback: check by event_type + reference_id (legacy)
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('household_id', householdId)
      .eq('event_type', eventType)
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return { action: 'create' };
    }

    const notification = data as Notification;

    if (!notification.dismissed_at) {
      return { action: 'update', notification };
    }

    if (options?.allowStateEscalation && options.newType === 'action' && 
        (notification.type === 'warning' || notification.severity === 'warning')) {
      return { action: 'create' };
    }

    return { action: 'skip' };
  };

  /**
   * Find existing notification (including archived) for backward compatibility.
   */
  const findExistingNotification = async (
    eventType: string,
    referenceId: string,
    options?: {
      allowIfStateChanged?: boolean;
      previousType?: 'warning' | 'action';
      newType?: 'warning' | 'action';
    }
  ): Promise<Notification | null> => {
    if (!householdId) return null;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('household_id', householdId)
      .eq('event_type', eventType)
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const notification = data as Notification;

    if (notification.dismissed_at) {
      if (options?.allowIfStateChanged && options?.newType && notification.type !== options.newType) {
        return null;
      }
      return notification;
    }

    return notification;
  };

  /**
   * Check if any notification exists that would block creation.
   */
  const shouldBlockNotification = async (
    eventType: string,
    referenceId: string
  ): Promise<boolean> => {
    if (!householdId) return false;

    // Check by dedupe_key
    const dedupeKey = generateDedupeKey(eventType, 'generic', referenceId, 'month');
    
    const { data: byDedupeKey } = await supabase
      .from('notifications')
      .select('id, dismissed_at')
      .eq('household_id', householdId)
      .eq('dedupe_key', dedupeKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byDedupeKey) return true;

    // Fallback to reference_id
    const { data, error } = await supabase
      .from('notifications')
      .select('id, dismissed_at')
      .eq('household_id', householdId)
      .eq('event_type', eventType)
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  };

  // Update existing notification using Message Contract
  const updateNotification = useMutation({
    mutationFn: async ({ 
      id, 
      message_key,
      params,
      severity,
      cta_label_key,
      cta_target,
      // Legacy fields (deprecated)
      message,
      type,
      title,
      metadata,
      cta_label,
    }: { 
      id: string; 
      message_key?: string;
      params?: NotificationParams;
      severity?: 'action' | 'warning' | 'success' | 'info';
      cta_label_key?: string;
      cta_target?: string;
      // Legacy
      message?: string; 
      type?: 'action' | 'warning' | 'success' | 'info';
      title?: string;
      metadata?: Record<string, unknown>;
      cta_label?: string;
    }) => {
      const updateData: Record<string, unknown> = { 
        read_at: null,
        status: 'unread',
      };
      
      // Message Contract fields
      if (message_key) updateData.message_key = message_key;
      if (params) updateData.params = sanitizeNotificationParams(params) as Json;
      if (severity) {
        updateData.severity = severity;
        updateData.type = severity; // Also update legacy field
      }
      if (cta_label_key) updateData.cta_label_key = cta_label_key;
      if (cta_target) updateData.cta_target = cta_target;
      
      // Legacy fields (for backward compatibility)
      if (message) updateData.message = message;
      if (type && !severity) updateData.type = type;
      if (title) updateData.title = title;
      if (metadata) updateData.metadata = sanitizeNotificationMetadata(metadata) as Json;
      if (cta_label) updateData.cta_label = cta_label;

      const { error } = await supabase
        .from('notifications')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', householdId] });
    },
    onError: (error) => {
      // Silent fail for update - non-critical
      console.error('[Notifications] Failed to update notification:', error);
    },
  });

  // Archive notification by event_type and reference_id
  const archiveByReference = useMutation({
    mutationFn: async ({ eventType, referenceId }: { eventType: string; referenceId: string }) => {
      if (!householdId) throw new Error('No household');

      const { error } = await supabase
        .from('notifications')
        .update({ 
          dismissed_at: new Date().toISOString(),
          status: 'archived',
        })
        .eq('household_id', householdId)
        .eq('event_type', eventType)
        .eq('reference_id', referenceId)
        .is('dismissed_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', householdId] });
    },
    onError: (error) => {
      // Silent fail for archive - non-critical
      console.error('[Notifications] Failed to archive notification:', error);
    },
  });

  // Derived state - active notifications (not dismissed)
  const activeNotifications = notifications.filter(n => !n.dismissed_at);
  
  // ========================================
  // PRECEDENCE RULES
  // ========================================
  const hasOverdueExpenses = activeNotifications.some(
    n => n.event_type === 'PAYMENT_DELAYED'
  );
  
  const hasMonthAtRisk = activeNotifications.some(
    n => n.event_type === 'MONTH_AT_RISK' || n.event_type === 'MONTH_AT_RISK_PREVIEW'
  );
  
  const hasCoverageRisk = activeNotifications.some(
    n => n.event_type === 'UPCOMING_EXPENSE_COVERAGE_RISK'
  );
  
  const overdueTransactionIds = new Set<string>();
  activeNotifications
    .filter(n => n.event_type === 'PAYMENT_DELAYED')
    .forEach(n => {
      const transactionIds = n.params?.transactionIds as string[] | undefined;
      if (transactionIds) {
        transactionIds.forEach(id => overdueTransactionIds.add(id));
      }
    });
  
  const filteredActiveNotifications = activeNotifications.filter(n => {
    if (n.event_type === 'PAYMENT_DELAYED') {
      return true;
    }
    
    if (n.event_type === 'MONTH_AT_RISK' || n.event_type === 'MONTH_AT_RISK_PREVIEW') {
      return true;
    }
    
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
    
    if (n.event_type === 'RECURRING_LATE_PAYMENT') {
      if (hasOverdueExpenses || hasMonthAtRisk || hasCoverageRisk) {
        return false;
      }
      return true;
    }
    
    return true;
  });
  
  const unreadNotifications = filteredActiveNotifications.filter(n => !n.read_at);
  const unreadCount = unreadNotifications.length;
  
  const actionNotifications = unreadNotifications.filter(n => n.severity === 'action' || n.type === 'action');
  const warningNotifications = unreadNotifications.filter(n => n.severity === 'warning' || n.type === 'warning');
  const infoNotifications = unreadNotifications.filter(n => 
    n.severity === 'info' || n.severity === 'success' || n.type === 'info' || n.type === 'success'
  );
  
  const hasActionItems = actionNotifications.length > 0;
  const hasWarningItems = warningNotifications.length > 0;

  const highestSeverity: 'action' | 'warning' | 'info' | null = 
    hasActionItems ? 'action' : hasWarningItems ? 'warning' : unreadCount > 0 ? 'info' : null;

  const dominantCount = hasActionItems 
    ? actionNotifications.length 
    : hasWarningItems 
      ? warningNotifications.length 
      : infoNotifications.length;

  return {
    notifications,
    filteredNotifications: filteredActiveNotifications,
    allNotifications: activeNotifications,
    isLoading,
    unreadCount,
    dominantCount,
    hasActionItems,
    hasWarningItems,
    highestSeverity,
    hasOverdueExpenses,
    actionCount: actionNotifications.length,
    warningCount: warningNotifications.length,
    createNotification,
    markAsRead,
    dismiss,
    findActiveNotification,
    findExistingNotification,
    shouldBlockNotification,
    checkNotificationAction,
    updateNotification,
    archiveByReference,
  };
}

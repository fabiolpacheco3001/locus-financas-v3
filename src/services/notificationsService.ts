/**
 * Notification Service - Centralizes all notification mutations
 * 
 * MESSAGE CONTRACT: This service uses message_key + params instead of final text.
 * All text rendering happens at the UI layer via i18n.
 * 
 * IDEMPOTENCY: Notifications use dedupe_key = rule_id + entity_type + entity_id + time_window
 * to prevent duplicate notifications. Navigating between months does NOT create new notifications.
 * 
 * This service is the ONLY place where notifications are created/updated/archived.
 * UI components should NEVER call mutations directly.
 */

import { supabase } from '@/integrations/supabase/client';
import type { NotificationRuleAction, ToastPayload } from '@/domain/finance/types';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/domain/finance/logger';
import { translateMessage } from '@/i18n/translateMessage';
import { format, startOfMonth } from 'date-fns';
import { sanitizeNotificationMetadata, sanitizeNotificationParams } from '@/lib/sanitizeMetadata';
import type { Json } from '@/integrations/supabase/types';

export interface NotificationData {
  id?: string;
  household_id: string;
  event_type: string;
  reference_id?: string | null;
  
  // Message Contract (i18n)
  message_key: string;
  params?: Record<string, unknown>;
  severity: 'action' | 'warning' | 'success' | 'info';
  entity_type?: string;
  entity_id?: string | null;
  
  // CTA
  cta_label_key?: string | null;
  cta_target?: string | null;
  
  // Idempotency
  dedupe_key?: string | null;
  
  // Legacy fields (deprecated)
  title?: string;
  message?: string;
  type?: 'action' | 'warning' | 'success' | 'info';
  cta_label?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Time window types for notification deduplication.
 * - 'month': One notification per month (default for most financial rules)
 * - 'day': One notification per day
 * - 'none': No time window - dedupe by entity only
 */
export type TimeWindow = 'month' | 'day' | 'none';

/**
 * Generate a dedupe_key for idempotent notification creation.
 * 
 * Format: {event_type}:{entity_type}:{entity_id}:{time_window}
 * 
 * Examples:
 * - MONTH_AT_RISK:month:2024-01:2024-01
 * - PAYMENT_DELAYED:transaction:overdue_payments:2024-01
 * - RECURRING_LATE_PAYMENT:category:cat_123:2024-01
 * 
 * @param eventType - The notification rule/event type
 * @param entityType - The type of entity (month, transaction, category)
 * @param entityId - The specific entity identifier
 * @param timeWindow - Time window for deduplication
 * @param referenceDate - Date to use for time window calculation (defaults to now)
 */
export function generateDedupeKey(
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

/**
 * Legacy dedupe key generator for backward compatibility.
 * @deprecated Use generateDedupeKey with explicit parameters
 */
export function generateLegacyDedupeKey(eventType: string, referenceId?: string | null): string {
  return referenceId ? `${eventType}:${referenceId}` : eventType;
}

/**
 * Check if a notification with the same dedupe_key already exists (open = not dismissed).
 * Returns the existing notification or null.
 */
async function findExistingByDedupeKey(
  householdId: string,
  dedupeKey: string
): Promise<{ id: string; dismissed_at: string | null; type: string; severity: string; params: Record<string, unknown> | null } | null> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, dismissed_at, type, severity, params')
    .eq('household_id', householdId)
    .eq('dedupe_key', dedupeKey)
    .is('dismissed_at', null) // Only open notifications
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error || !data) return null;
  
  return {
    id: data.id,
    dismissed_at: data.dismissed_at,
    type: data.type,
    severity: data.severity ?? data.type,
    params: data.params as Record<string, unknown> | null,
  };
}

/**
 * Check if a notification with the same dedupe_key exists (including archived).
 * Used for state escalation checks.
 */
async function findAnyByDedupeKey(
  householdId: string,
  dedupeKey: string
): Promise<{ id: string; dismissed_at: string | null; type: string; severity: string } | null> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, dismissed_at, type, severity')
    .eq('household_id', householdId)
    .eq('dedupe_key', dedupeKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error || !data) return null;
  return data;
}

/**
 * Find existing notification by event_type and reference_id (legacy method).
 */
async function findExistingNotification(
  householdId: string,
  eventType: string,
  referenceId: string,
  dedupeKey?: string
): Promise<{ id: string; dismissed_at: string | null; type: string; severity: string } | null> {
  // Try dedupe_key first (preferred)
  if (dedupeKey) {
    const existing = await findAnyByDedupeKey(householdId, dedupeKey);
    if (existing) return existing;
  }
  
  // Fallback to event_type + reference_id
  const { data, error } = await supabase
    .from('notifications')
    .select('id, dismissed_at, type, severity')
    .eq('household_id', householdId)
    .eq('event_type', eventType)
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error || !data) return null;
  return data;
}

/**
 * Create a new notification using Message Contract with idempotency.
 * 
 * IDEMPOTENCY RULES:
 * 1. If an OPEN notification with same dedupe_key exists → UPDATE it
 * 2. If an ARCHIVED notification exists → Only create if state escalates (warning → action)
 * 3. Otherwise → CREATE new notification
 */
async function createNotification(data: NotificationData): Promise<void> {
  const dedupeKey = data.dedupe_key || generateDedupeKey(
    data.event_type,
    data.entity_type || 'generic',
    data.entity_id || data.reference_id || '',
    'month'
  );
  
  // Check for existing OPEN notification (idempotency check)
  const existingOpen = await findExistingByDedupeKey(data.household_id, dedupeKey);
  
  if (existingOpen) {
    logger.rules('Notification already exists (open), updating instead', { 
      eventType: data.event_type, 
      dedupeKey,
      existingId: existingOpen.id,
    });
    
    // Update existing notification instead of creating duplicate
    await updateNotification(existingOpen.id, {
      message_key: data.message_key,
      params: data.params,
      severity: data.severity,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      cta_label_key: data.cta_label_key,
      cta_target: data.cta_target,
    });
    return;
  }
  
  // Check for archived notification (state escalation)
  const existingAny = await findAnyByDedupeKey(data.household_id, dedupeKey);
  
  if (existingAny?.dismissed_at) {
    const existingSeverity = existingAny.severity || existingAny.type;
    
    // Only create new if escalating from warning → action
    if (!(data.severity === 'action' && existingSeverity === 'warning')) {
      logger.rules('Notification already dismissed, skipping (no state escalation)', {
        eventType: data.event_type,
        dedupeKey,
        existingSeverity,
        newSeverity: data.severity,
      });
      return;
    }
    
    logger.rules('State escalation detected, creating new notification', {
      eventType: data.event_type,
      dedupeKey,
      existingSeverity,
      newSeverity: data.severity,
    });
  }
  
  logger.rules('Creating notification', { 
    eventType: data.event_type, 
    referenceId: data.reference_id,
    messageKey: data.message_key,
    dedupeKey 
  });
  
  // Sanitize params and metadata before insertion (allowlist + size limit)
  const sanitizedParams = sanitizeNotificationParams(data.params);
  const sanitizedMetadata = sanitizeNotificationMetadata(data.metadata || data.params);

  const insertData = {
    household_id: data.household_id,
    event_type: data.event_type,
    reference_id: data.reference_id ?? null,
    dedupe_key: dedupeKey,
    
    // Message Contract fields
    message_key: data.message_key,
    params: sanitizedParams as Json,
    severity: data.severity,
    entity_type: data.entity_type || 'generic',
    entity_id: data.entity_id ?? null,
    status: 'unread',
    
    // CTA
    cta_label_key: data.cta_label_key ?? null,
    cta_target: data.cta_target ?? null,
    
    // Legacy fields (for backward compatibility)
    title: '', // Empty - use message_key
    message: '', // Empty - use message_key
    type: data.severity,
    cta_label: '', // Empty - use cta_label_key
    metadata: sanitizedMetadata as Json,
  };
  
  const { error } = await supabase
    .from('notifications')
    .insert([insertData]);
  
  if (error) {
    if (error.code === '23505') {
      logger.rules('Notification already exists (dedupe_key conflict), skipping');
      return;
    }
    console.error('Failed to create notification:', error);
    throw error;
  }
}

/**
 * Update an existing notification
 */
async function updateNotification(
  id: string,
  data: Partial<NotificationData>
): Promise<void> {
  logger.rules('Updating notification', { id });
  
  const updateData: Record<string, unknown> = {
    status: 'unread',
    read_at: null,
  };
  
  // Message Contract fields
  if (data.message_key !== undefined) updateData.message_key = data.message_key;
  if (data.params !== undefined) {
    updateData.params = sanitizeNotificationParams(data.params) as Json;
  }
  if (data.severity !== undefined) {
    updateData.severity = data.severity;
    updateData.type = data.severity;
  }
  if (data.entity_type !== undefined) updateData.entity_type = data.entity_type;
  if (data.entity_id !== undefined) updateData.entity_id = data.entity_id;
  
  // CTA
  if (data.cta_label_key !== undefined) updateData.cta_label_key = data.cta_label_key;
  if (data.cta_target !== undefined) updateData.cta_target = data.cta_target;
  
  // Legacy fields
  if (data.title !== undefined) updateData.title = data.title;
  if (data.message !== undefined) updateData.message = data.message;
  if (data.metadata !== undefined) {
    updateData.metadata = sanitizeNotificationMetadata(data.metadata) as Json;
  }
  
  const { error } = await supabase
    .from('notifications')
    .update(updateData)
    .eq('id', id);
  
  if (error) {
    console.error('Failed to update notification:', error);
    throw error;
  }
}

/**
 * Archive (dismiss) a notification
 */
async function archiveNotification(
  householdId: string,
  eventType: string,
  referenceId: string
): Promise<void> {
  logger.rules('Archiving notification', { eventType, referenceId });
  
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
  
  if (error) {
    console.error('Failed to archive notification:', error);
    throw error;
  }
}

/**
 * Archive notifications by dedupe_key pattern
 */
async function archiveByDedupeKeyPattern(
  householdId: string,
  dedupeKeyPrefix: string
): Promise<void> {
  logger.rules('Archiving notifications by dedupe_key pattern', { dedupeKeyPrefix });
  
  const { error } = await supabase
    .from('notifications')
    .update({ 
      dismissed_at: new Date().toISOString(),
      status: 'archived',
    })
    .eq('household_id', householdId)
    .like('dedupe_key', `${dedupeKeyPrefix}%`)
    .is('dismissed_at', null);
  
  if (error) {
    console.error('Failed to archive notifications by pattern:', error);
    throw error;
  }
}

/**
 * Execute a single notification action
 */
async function executeAction(
  householdId: string,
  action: NotificationRuleAction
): Promise<void> {
  switch (action.type) {
    case 'CREATE': {
      const { payload } = action;
      
      // Generate proper dedupe_key with time window
      const dedupeKey = generateDedupeKey(
        payload.eventType,
        payload.entityType || 'generic',
        payload.entityId || payload.referenceId || '',
        'month'
      );
      
      await createNotification({
        household_id: householdId,
        event_type: payload.eventType,
        reference_id: payload.referenceId,
        dedupe_key: dedupeKey,
        message_key: payload.messageKey,
        params: payload.params,
        severity: payload.severity,
        entity_type: payload.entityType,
        entity_id: payload.entityId,
        cta_label_key: payload.ctaLabelKey,
        cta_target: payload.ctaTarget,
      });
      break;
    }
    
    case 'UPDATE': {
      const { payload } = action;
      
      const dedupeKey = generateDedupeKey(
        payload.eventType,
        payload.entityType || 'generic',
        payload.entityId || payload.referenceId || '',
        'month'
      );
      
      const existing = await findExistingByDedupeKey(householdId, dedupeKey);
      
      if (existing) {
        await updateNotification(existing.id, {
          message_key: payload.messageKey,
          params: payload.params,
          severity: payload.severity,
          entity_type: payload.entityType,
          entity_id: payload.entityId,
          cta_label_key: payload.ctaLabelKey,
          cta_target: payload.ctaTarget,
        });
      }
      break;
    }
    
    case 'ARCHIVE': {
      await archiveNotification(householdId, action.eventType, action.referenceId);
      break;
    }
    
    case 'SKIP':
      break;
  }
}

/**
 * Execute notification actions returned by rule evaluation
 */
export async function executeNotificationActions(
  householdId: string,
  actions: NotificationRuleAction[]
): Promise<void> {
  for (const action of actions) {
    try {
      await executeAction(householdId, action);
    } catch (error) {
      console.error('Failed to execute notification action:', action, error);
    }
  }
}

/**
 * Show toasts from rule evaluation using Message Contract (i18n)
 */
export function showToasts(toasts: ToastPayload[]): void {
  for (const toastPayload of toasts) {
    // Translate using message keys
    const title = toastPayload.titleKey 
      ? translateMessage(toastPayload.titleKey, toastPayload.params)
      : toastPayload.title || '';
    
    const description = toastPayload.descriptionKey
      ? translateMessage(toastPayload.descriptionKey, toastPayload.params)
      : toastPayload.description || '';
    
    toast({
      variant: toastPayload.variant,
      title,
      description,
    });
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ 
      read_at: new Date().toISOString(),
      status: 'read',
    })
    .eq('id', id);
  
  if (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
}

/**
 * Dismiss a notification
 */
export async function dismissNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ 
      dismissed_at: new Date().toISOString(),
      status: 'archived',
    })
    .eq('id', id);
  
  if (error) {
    console.error('Failed to dismiss notification:', error);
    throw error;
  }
}

/**
 * Check if a notification already exists for the given dedupe parameters.
 * Useful for UI-side checks before triggering notification creation.
 */
export async function hasOpenNotification(
  householdId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  timeWindow: TimeWindow = 'month',
  referenceDate: Date = new Date()
): Promise<boolean> {
  const dedupeKey = generateDedupeKey(eventType, entityType, entityId, timeWindow, referenceDate);
  const existing = await findExistingByDedupeKey(householdId, dedupeKey);
  return existing !== null;
}

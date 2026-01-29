/**
 * NotificationItem - Single Source of Truth for Notification Rendering
 * 
 * This component handles ALL notification display logic including:
 * - Safe JSON parsing of params (handles both string and object from DB)
 * - MERGES metadata + params for maximum variable coverage
 * - Brute-force placeholder replacement as fallback
 * - Currency formatting via translateWithCurrency
 */

import { AlertTriangle, Info, CheckCircle, Check, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Notification } from '@/types/notifications';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/useLocale';
import { translateWithCurrency } from '@/i18n/translateMessage';

// ============= CORE PARSING LOGIC =============

/**
 * Safely parse params - handles both object and JSON string from DB
 * Also handles double-encoded JSON strings
 */
function safeParse(data: unknown): Record<string, unknown> {
  if (!data) return {};
  if (typeof data === 'object' && data !== null) return data as Record<string, unknown>;
  if (typeof data === 'string') {
    try {
      // Handle double-encoded JSON if necessary
      let cleanData = data;
      if (data.startsWith('"') && data.endsWith('"')) {
        try {
          cleanData = JSON.parse(data);
        } catch {
          // Not double-encoded, use as-is
        }
      }
      const parsed = JSON.parse(cleanData);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (e) {
      console.warn('Failed to parse notification params:', e);
      return {};
    }
  }
  return {};
}

/**
 * Get interpolation params - MERGES metadata and params for maximum safety
 * Priority: Params > Metadata (params override metadata)
 */
function getParams(n: Notification): Record<string, unknown> {
  const metadata = safeParse(n.metadata);
  const params = safeParse(n.params);
  
  const merged = { ...metadata, ...params };

  // === DATA NORMALIZATION / ALIASES ===
  // Garante compatibilidade entre notificações antigas e novas
  if (merged.description && !merged.subcategoryName) {
    merged.subcategoryName = merged.description;
  }
  if (merged.description && !merged.categoryName) {
    merged.categoryName = merged.categoryName || '';
  }
  if (!merged.daysOverdue && merged.days) {
    merged.daysOverdue = merged.days;
  }
  
  return merged;
}

/**
 * Manual placeholder replacement as fallback if translation fails
 * Supports whitespace in placeholders (e.g. {{ description }})
 */
function replacePlaceholders(text: string, params: Record<string, unknown>): string {
  if (!text || !text.includes('{{')) return text;
  
  let result = text;
  Object.entries(params).forEach(([key, value]) => {
    // Handle null/undefined gracefully
    const valStr = value === null || value === undefined ? '' : String(value);
    // Regex handles {{key}} and {{ key }}
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), valStr);
  });
  return result;
}

// ============= PUBLIC API =============

/**
 * Get translated notification title with robust interpolation
 */
export function getNotificationTitle(n: Notification): string {
  const params = getParams(n);
  
  // LEGACY GUARD: Se não há parâmetros para interpolar, use o texto estático do banco
  if (Object.keys(params).length === 0 && n.title) {
    return n.title;
  }
  
  if (n.message_key) {
    const titleKey = n.message_key.endsWith('_title') 
      ? n.message_key 
      : n.message_key.replace(/\.(single|multiple)?$/, '_title');
      
    const translated = translateWithCurrency(titleKey, params);
    
    if (translated && translated !== titleKey) {
      return replacePlaceholders(translated, params);
    }
  }
  
  return replacePlaceholders(n.title || '', params);
}

/**
 * Get translated notification message with robust interpolation
 */
export function getNotificationMessage(n: Notification): string {
  const params = getParams(n);
  
  // LEGACY GUARD: Se não há parâmetros para interpolar, use o texto estático do banco
  if (Object.keys(params).length === 0 && n.message) {
    return n.message;
  }
  
  if (n.message_key) {
    const translated = translateWithCurrency(n.message_key, params);
    
    if (translated && translated !== n.message_key) {
      // Verificação Extra: Se a tradução resultante ainda tiver chaves {{}} não resolvidas,
      // prefira o fallback n.message (que provavelmente está correto)
      const result = replacePlaceholders(translated, params);
      if (result.includes('{{') && n.message) {
        return n.message;
      }
      return result;
    }
  }
  
  return replacePlaceholders(n.message || '', params);
}

/**
 * Get translated CTA label
 */
export function getCtaLabel(n: Notification): string {
  const params = getParams(n);
  
  if (n.cta_label_key) {
    const translated = translateWithCurrency(n.cta_label_key, params);
    if (translated && translated !== n.cta_label_key) {
      return replacePlaceholders(translated, params);
    }
  }
  
  return replacePlaceholders(n.cta_label || '', params);
}

// ============= UI HELPERS =============

export function getNotificationIcon(type: Notification['type'], size: 'sm' | 'md' = 'md') {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  switch (type) {
    case 'action':
      return <AlertTriangle className={cn(sizeClass, 'text-destructive')} />;
    case 'warning':
      return <Info className={cn(sizeClass, 'text-warning')} />;
    case 'success':
      return <CheckCircle className={cn(sizeClass, 'text-success')} />;
    default:
      return <Info className={cn(sizeClass, 'text-muted-foreground')} />;
  }
}

export function getSeverityBorder(type: Notification['type']) {
  switch (type) {
    case 'action':
      return 'border-l-4 border-l-destructive';
    case 'warning':
      return 'border-l-4 border-l-warning';
    default:
      return 'border-l-4 border-l-muted-foreground/30';
  }
}

export function getTypeBadgeVariant(type: Notification['type']) {
  switch (type) {
    case 'action':
      return 'destructive';
    case 'warning':
      return 'secondary';
    case 'success':
      return 'default';
    default:
      return 'outline';
  }
}

// ============= COMPACT ITEM (for Popover) =============

export interface NotificationItemCompactProps {
  notification: Notification;
  count?: number;
  hasUnread?: boolean;
  onCTA?: (notification: Notification) => void;
  onMarkAsRead?: (e: React.MouseEvent) => void;
  onDismiss?: (e: React.MouseEvent) => void;
}

export function NotificationItemCompact({
  notification,
  count = 1,
  hasUnread = false,
  onCTA,
  onMarkAsRead,
  onDismiss,
}: NotificationItemCompactProps) {
  const { t, formatRelativeTime } = useLocale();
  const hasMultiple = count > 1;

  // Pre-compute text to avoid recalculation
  const title = getNotificationTitle(notification);
  const message = getNotificationMessage(notification);

  return (
    <div
      className={cn(
        'p-3 hover:bg-muted/50 transition-colors cursor-pointer',
        getSeverityBorder(notification.type),
        hasUnread && 'bg-muted/30'
      )}
      onClick={() => notification.cta_target && onCTA?.(notification)}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getNotificationIcon(notification.type, 'sm')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-sm', hasUnread && 'font-medium')}>
              {title}
              {hasMultiple && (
                <span className="ml-1 text-muted-foreground font-normal">
                  ({count})
                </span>
              )}
            </p>
            <div className="flex-shrink-0 flex gap-1">
              {hasUnread && onMarkAsRead && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => { e.stopPropagation(); onMarkAsRead(e); }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {hasMultiple ? t('notifications.markAllAsRead') : t('notifications.markAsRead')}
                  </TooltipContent>
                </Tooltip>
              )}
              {onDismiss && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => { e.stopPropagation(); onDismiss(e); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {hasMultiple ? t('notifications.archiveAll') : t('notifications.archive')}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {message}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(notification.created_at)}
            </span>
            {(notification.cta_label_key || notification.cta_label) && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={(e) => { e.stopPropagation(); onCTA?.(notification); }}
              >
                {getCtaLabel(notification)}
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= FULL ITEM (for Notifications Page) =============

export interface NotificationItemFullProps {
  notification: Notification;
  isNested?: boolean;
  isArchived?: boolean;
  onCTA?: (notification: Notification) => void;
  onMarkAsRead?: (notificationId: string) => void;
  onDismiss?: (notificationId: string) => void;
}

export function NotificationItemFull({
  notification,
  isNested = false,
  isArchived = false,
  onCTA,
  onMarkAsRead,
  onDismiss,
}: NotificationItemFullProps) {
  const { t, formatRelativeTime } = useLocale();

  // Pre-compute text to avoid recalculation
  const title = getNotificationTitle(notification);
  const message = getNotificationMessage(notification);

  const getCardStyles = () => {
    const severityBorder = getSeverityBorder(notification.type);
    
    if (isArchived || notification.dismissed_at) {
      return `opacity-60 bg-muted/30 ${severityBorder}`;
    }
    if (!notification.read_at) {
      return `bg-card ${severityBorder}`;
    }
    return `bg-card ${severityBorder}`;
  };

  return (
    <div 
      className={cn(
        'p-4 transition-colors',
        isNested && 'pl-12 border-t border-dashed',
        getCardStyles()
      )}
    >
      <div className="flex gap-4">
        {!isNested && (
          <div className="flex-shrink-0 mt-1">
            {getNotificationIcon(notification.type)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-2 mb-1">
            <h3 className={cn(
              'text-base',
              !notification.read_at && !notification.dismissed_at && 'font-semibold'
            )}>
              {title}
            </h3>
            {!isNested && (
              <Badge variant={getTypeBadgeVariant(notification.type) as any}>
                {t(`notifications.${notification.type === 'action' ? 'actionRequired' : notification.type === 'warning' ? 'attention' : notification.type === 'success' ? 'success' : 'information'}`)}
              </Badge>
            )}
          </div>
          <p className={cn(
            'text-sm mb-2',
            notification.dismissed_at ? 'text-muted-foreground/70' : 'text-muted-foreground'
          )}>
            {message}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(notification.created_at)}
            </span>
            
            {(notification.cta_label_key || notification.cta_label) && notification.cta_target && !notification.dismissed_at && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onCTA?.(notification)}
              >
                {getCtaLabel(notification)}
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
            
            {!notification.read_at && !notification.dismissed_at && onMarkAsRead && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onMarkAsRead(notification.id)}
              >
                <Check className="h-3 w-3 mr-1" />
                {t('notifications.markAsRead')}
              </Button>
            )}
            
            {!notification.dismissed_at && onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => onDismiss(notification.id)}
              >
                <X className="h-3 w-3 mr-1" />
                {t('notifications.archive')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

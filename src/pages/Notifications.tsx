import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, AlertTriangle, Info, Filter, Inbox, ChevronDown, ChevronUp, Check, X, ExternalLink } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';
import { useLocale } from '@/i18n/useLocale';
import { Notification } from '@/types/notifications';
import { cn } from '@/lib/utils';
import { 
  NotificationItemFull, 
  getNotificationIcon, 
  getSeverityBorder, 
  getTypeBadgeVariant,
  getNotificationTitle,
  getNotificationMessage,
  getCtaLabel
} from '@/components/notifications/NotificationItem';

type StatusFilter = 'open' | 'all' | 'unread' | 'action' | 'warning' | 'info' | 'archived';

interface NotificationGroup {
  key: string;
  type: Notification['type'];
  event_type: string;
  reference_id: string | null;
  notifications: Notification[];
  latestNotification: Notification;
  count: number;
}

const PAGE_SIZE = 15;

export default function Notifications() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { notifications: rawNotifications, filteredNotifications, allNotifications, isLoading, markAsRead, dismiss } = useNotifications();
  const { t, formatRelativeTime } = useLocale();
  
  // Initialize filter from URL query param
  const urlFilter = searchParams.get('filter') as StatusFilter | null;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    urlFilter && ['open', 'all', 'unread', 'action', 'warning', 'info', 'archived'].includes(urlFilter) 
      ? urlFilter 
      : 'open'
  );
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Sync filter with URL on mount
  useEffect(() => {
    if (urlFilter && ['open', 'all', 'unread', 'action', 'warning', 'info', 'archived'].includes(urlFilter)) {
      setStatusFilter(urlFilter);
    }
  }, [urlFilter]);

  // Group notifications by type + event_type + reference_id for anti-spam
  const groupNotifications = (notifications: Notification[]): NotificationGroup[] => {
    const groups = new Map<string, NotificationGroup>();
    
    for (const n of notifications) {
      const key = `${n.event_type}-${n.reference_id || 'no-ref'}`;
      
      if (groups.has(key)) {
        const group = groups.get(key)!;
        group.notifications.push(n);
        group.count++;
        // Keep the most recent as the main one
        if (new Date(n.created_at) > new Date(group.latestNotification.created_at)) {
          group.latestNotification = n;
        }
      } else {
        groups.set(key, {
          key,
          type: n.type,
          event_type: n.event_type,
          reference_id: n.reference_id || null,
          notifications: [n],
          latestNotification: n,
          count: 1,
        });
      }
    }
    
    return Array.from(groups.values());
  };

  // Filter, group and sort notifications
  const { groupedNotifications, totalGroups } = useMemo(() => {
    // For 'archived' and 'all' filters, use raw notifications (no precedence)
    // For other filters, use filteredNotifications (with full precedence applied from hook)
    let baseNotifications: Notification[];
    
    if (statusFilter === 'archived') {
      // Show all archived notifications (no precedence filter)
      baseNotifications = rawNotifications.filter(n => n.dismissed_at);
    } else if (statusFilter === 'all') {
      // Show all notifications (no precedence filter)
      baseNotifications = rawNotifications;
    } else {
      // Use precedence-filtered active notifications from hook
      baseNotifications = filteredNotifications;
    }
    
    let filtered = [...baseNotifications];

    // Status filter (additional filtering on top of precedence)
    switch (statusFilter) {
      case 'open':
        filtered = filtered.filter(n => !n.dismissed_at);
        break;
      case 'unread':
        filtered = filtered.filter(n => !n.read_at && !n.dismissed_at);
        break;
      case 'action':
        filtered = filtered.filter(n => n.type === 'action' && !n.dismissed_at);
        break;
      case 'warning':
        filtered = filtered.filter(n => n.type === 'warning' && !n.dismissed_at);
        break;
      case 'info':
        filtered = filtered.filter(n => (n.type === 'info' || n.type === 'success') && !n.dismissed_at);
        break;
      case 'archived':
        // Already filtered above
        break;
      case 'all':
        // Show all
        break;
    }

    // Group notifications
    const groups = groupNotifications(filtered);

    // Sort by severity then by most recent (updated_at or created_at)
    const severityOrder = { action: 0, warning: 1, info: 2, success: 3 };
    const getLatestTimestamp = (n: Notification) => {
      // Use updated_at if available, otherwise created_at
      const updatedAt = (n as any).updated_at;
      return new Date(updatedAt || n.created_at).getTime();
    };
    groups.sort((a, b) => {
      const severityDiff = (severityOrder[a.type] ?? 4) - (severityOrder[b.type] ?? 4);
      if (severityDiff !== 0) return severityDiff;
      return getLatestTimestamp(b.latestNotification) - getLatestTimestamp(a.latestNotification);
    });

    const total = groups.length;
    return { 
      groupedNotifications: groups.slice(0, displayCount),
      totalGroups: total
    };
  }, [rawNotifications, filteredNotifications, statusFilter, displayCount]);

  // Counters - use filteredNotifications (with precedence applied) for counters
  const openNotifications = filteredNotifications;
  const unreadNotifications = openNotifications.filter(n => !n.read_at);
  const unreadCount = unreadNotifications.length;
  // Action/Warning counts are ALL open of that severity (not just unread)
  const actionCount = openNotifications.filter(n => n.type === 'action').length;
  const warningCount = openNotifications.filter(n => n.type === 'warning').length;

  // Use unified helpers from NotificationItem
  const getIcon = (type: Notification['type']) => getNotificationIcon(type);
  
  const getTypeLabel = (type: Notification['type']) => {
    switch (type) {
      case 'action':
        return t('notifications.actionRequired');
      case 'warning':
        return t('notifications.attention');
      case 'success':
        return t('notifications.success');
      default:
        return t('notifications.information');
    }
  };

  const handleCTA = (notification: Notification) => {
    if (notification.cta_target) {
      markAsRead.mutate(notification.id);
      navigate(notification.cta_target);
    }
  };

  const handleDismiss = (notificationId: string) => {
    dismiss.mutate(notificationId);
  };

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead.mutate(notificationId);
  };

  const handleDismissGroup = (group: NotificationGroup) => {
    // Dismiss all notifications in the group
    group.notifications.forEach(n => {
      if (!n.dismissed_at) {
        dismiss.mutate(n.id);
      }
    });
  };

  const handleMarkGroupAsRead = (group: NotificationGroup) => {
    // Mark all notifications in the group as read
    group.notifications.forEach(n => {
      if (!n.read_at) {
        markAsRead.mutate(n.id);
      }
    });
  };

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const hasMore = totalGroups > displayCount;

  // Reset display count when filters change and update URL
  const handleFilterChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setDisplayCount(PAGE_SIZE);
    setExpandedGroups(new Set());
    // Update URL query param
    if (value === 'open') {
      setSearchParams({});
    } else {
      setSearchParams({ filter: value });
    }
  };

  const getSeverityBorderClass = (type: Notification['type']) => {
    switch (type) {
      case 'action':
        return 'border-l-4 border-l-destructive';
      case 'warning':
        return 'border-l-4 border-l-warning';
      default:
        return 'border-l-4 border-l-muted-foreground/30';
    }
  };

  const getNotificationCardStyles = (notification: Notification, isArchived: boolean) => {
    const severityBorder = getSeverityBorderClass(notification.type);
    
    if (isArchived || notification.dismissed_at) {
      return `opacity-60 bg-muted/30 ${severityBorder}`;
    }
    if (!notification.read_at) {
      return `bg-card ${severityBorder}`;
    }
    return `bg-card ${severityBorder}`;
  };

  const renderNotificationItem = (notification: Notification, isNested = false) => (
    <div 
      key={notification.id}
      className={cn(
        'p-4 transition-colors',
        isNested && 'pl-12 border-t border-dashed',
        getNotificationCardStyles(notification, statusFilter === 'archived')
      )}
    >
      <div className="flex gap-4">
        {!isNested && (
          <div className="flex-shrink-0 mt-1">
            {getIcon(notification.type)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-2 mb-1">
            <h3 className={cn(
              'text-base',
              !notification.read_at && !notification.dismissed_at && 'font-semibold'
            )}>
              {getNotificationTitle(notification)}
            </h3>
            {!isNested && (
              <Badge variant={getTypeBadgeVariant(notification.type) as any}>
                {getTypeLabel(notification.type)}
              </Badge>
            )}
          </div>
          <p className={cn(
            'text-sm mb-2',
            notification.dismissed_at ? 'text-muted-foreground/70' : 'text-muted-foreground'
          )}>
            {getNotificationMessage(notification)}
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
                onClick={() => handleCTA(notification)}
              >
                {getCtaLabel(notification)}
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
            
            {!notification.read_at && !notification.dismissed_at && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleMarkAsRead(notification.id)}
              >
                <Check className="h-3 w-3 mr-1" />
                {t('notifications.markAsRead')}
              </Button>
            )}
            
            {!notification.dismissed_at && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => handleDismiss(notification.id)}
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

  const renderNotificationGroup = (group: NotificationGroup) => {
    const isExpanded = expandedGroups.has(group.key);
    const hasMultiple = group.count > 1;
    const mainNotification = group.latestNotification;
    const hasUnread = group.notifications.some(n => !n.read_at && !n.dismissed_at);

    return (
      <Card 
        key={group.key} 
        className={cn(
          'transition-colors overflow-hidden',
          getNotificationCardStyles(mainNotification, statusFilter === 'archived')
        )}
      >
        <CardContent className="p-0">
          {/* Main notification */}
          <div className="p-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                {getIcon(group.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start gap-2 mb-1">
                  <h3 className={cn(
                    'text-base',
                    hasUnread && 'font-semibold'
                  )}>
                    {getNotificationTitle(mainNotification)}
                    {hasMultiple && (
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        ({group.count})
                      </span>
                    )}
                  </h3>
                  <Badge variant={getTypeBadgeVariant(group.type) as any}>
                    {getTypeLabel(group.type)}
                  </Badge>
                </div>
                <p className={cn(
                  'text-sm mb-2',
                  mainNotification.dismissed_at ? 'text-muted-foreground/70' : 'text-muted-foreground'
                )}>
                  {getNotificationMessage(mainNotification)}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(mainNotification.created_at)}
                  </span>
                  
                  {(mainNotification.cta_label_key || mainNotification.cta_label) && mainNotification.cta_target && !mainNotification.dismissed_at && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleCTA(mainNotification)}
                    >
                      {getCtaLabel(mainNotification)}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                  
                  {hasUnread && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => hasMultiple ? handleMarkGroupAsRead(group) : handleMarkAsRead(mainNotification.id)}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      {hasMultiple ? t('notifications.markAllAsRead') : t('notifications.markAsRead')}
                    </Button>
                  )}
                  
                  {!mainNotification.dismissed_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => hasMultiple ? handleDismissGroup(group) : handleDismiss(mainNotification.id)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      {hasMultiple ? t('notifications.archiveAll') : t('notifications.archive')}
                    </Button>
                  )}

                  {hasMultiple && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleGroupExpanded(group.key)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          {t('notifications.hideHistory')}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          {t('notifications.viewHistory')}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Expanded history */}
          {hasMultiple && isExpanded && (
            <div className="bg-muted/20 border-t">
              {group.notifications
                .filter(n => n.id !== mainNotification.id)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(n => renderNotificationItem(n, true))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <PageHeader
        title={t('notifications.title')}
        description={t('notifications.description')}
      />

      {/* Counters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Card 
          className={cn(
            "flex-1 min-w-[120px] cursor-pointer transition-colors hover:border-destructive/50",
            statusFilter === 'action' && 'border-destructive'
          )}
          onClick={() => handleFilterChange('action')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{actionCount}</p>
              <p className="text-xs text-muted-foreground">{t('notifications.actionRequired')}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "flex-1 min-w-[120px] cursor-pointer transition-colors hover:border-warning/50",
            statusFilter === 'warning' && 'border-warning'
          )}
          onClick={() => handleFilterChange('warning')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-warning/10">
              <Info className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{warningCount}</p>
              <p className="text-xs text-muted-foreground">{t('notifications.attention')}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "flex-1 min-w-[120px] cursor-pointer transition-colors hover:border-primary/50",
            statusFilter === 'unread' && 'border-primary'
          )}
          onClick={() => handleFilterChange('unread')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{unreadCount}</p>
              <p className="text-xs text-muted-foreground">{t('notifications.filters.unread')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('common.filters')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={statusFilter === 'open' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('open')}
            >
              {t('notifications.filters.open')}
            </Button>
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('all')}
            >
              {t('notifications.filters.all')}
            </Button>
            <Button
              variant={statusFilter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('unread')}
            >
              {t('notifications.filters.unread')}
            </Button>
            <Button
              variant={statusFilter === 'action' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('action')}
            >
              {t('notifications.filters.action')}
            </Button>
            <Button
              variant={statusFilter === 'warning' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('warning')}
            >
              {t('notifications.filters.warning')}
            </Button>
            <Button
              variant={statusFilter === 'archived' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('archived')}
            >
              {t('notifications.filters.archived')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groupedNotifications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-1">{t('notifications.empty.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'open' 
                ? t('notifications.empty.openDescription')
                : t('notifications.empty.filteredDescription')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedNotifications.map(group => renderNotificationGroup(group))}

          {hasMore && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => setDisplayCount(prev => prev + PAGE_SIZE)}
              >
                {t('common.loadMore')} ({t('common.remaining', { count: totalGroups - displayCount })})
              </Button>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}

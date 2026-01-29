/**
 * NotificationBell - Popover component for notification bell in header
 * 
 * All rendering logic is delegated to NotificationItem.tsx (Single Source of Truth).
 */

import React, { useState, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { useLocale } from '@/i18n/useLocale';
import { NotificationItemCompact } from './NotificationItem';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Notification } from '@/types/notifications';
import { cn } from '@/lib/utils';

export const NotificationBell = () => {
  const { 
    filteredNotifications, 
    unreadCount, 
    dominantCount,
    highestSeverity,
    markAsRead, 
    dismiss,
    isLoading 
  } = useNotifications();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Filter to only show relevant notifications in popover
  const displayNotifications = filteredNotifications
    .filter(n => !n.dismissed_at && (!n.read_at || n.type === 'action'))
    .slice(0, 10);

  const handleNotificationClick = useCallback((notification: Notification) => {
    if (!notification.read_at) {
      markAsRead.mutate(notification.id);
    }
    
    if (notification.cta_target) {
      setOpen(false);
      navigate(notification.cta_target);
    }
  }, [markAsRead, navigate]);

  const handleMarkAsRead = useCallback((e: React.MouseEvent | undefined, notification: Notification) => {
    e?.stopPropagation();
    markAsRead.mutate(notification.id);
  }, [markAsRead]);

  const handleDismiss = useCallback((e: React.MouseEvent | undefined, notification: Notification) => {
    e?.stopPropagation();
    dismiss.mutate(notification.id);
  }, [dismiss]);

  // Bell badge color based on severity
  const getBadgeVariant = () => {
    switch (highestSeverity) {
      case 'action': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'default';
    }
  };

  const getBellColor = () => {
    switch (highestSeverity) {
      case 'action': return 'text-destructive';
      case 'warning': return 'text-warning';
      default: return '';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="notification-bell">
          <Bell className={cn("h-5 w-5", getBellColor())} />
          {dominantCount > 0 && (
            <Badge 
              variant={getBadgeVariant() as any}
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {dominantCount > 9 ? '9+' : dominantCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">{t('notifications.title')}</h4>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {unreadCount} {t('notifications.unread')}
            </span>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <span className="text-muted-foreground text-sm">{t('common.loading')}</span>
            </div>
          ) : displayNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center p-4">
              <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('notifications.noNotifications')}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t('notifications.silenceIsGood')}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {displayNotifications.map((notification) => (
                <NotificationItemCompact
                  key={notification.id}
                  notification={notification}
                  hasUnread={!notification.read_at}
                  onCTA={() => handleNotificationClick(notification)}
                  onMarkAsRead={(e) => handleMarkAsRead(e, notification)}
                  onDismiss={(e) => handleDismiss(e, notification)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setOpen(false);
              navigate('/notifications');
            }}
          >
            {t('notifications.viewAll')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

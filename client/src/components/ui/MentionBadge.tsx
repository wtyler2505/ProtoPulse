/**
 * MentionBadge — Bell icon with unread count badge and dropdown list
 * of mention notifications. Uses the MentionNotificationManager singleton.
 */

import { Bell, Check, Trash2, X } from 'lucide-react';
import { useMentions } from '@/lib/mentions';
import type { MentionNotification } from '@/lib/mentions';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StyledTooltip } from '@/components/ui/styled-tooltip';

// ---------------------------------------------------------------------------
// NotificationItem
// ---------------------------------------------------------------------------

function NotificationItem({
  notification,
  onMarkRead,
  onRemove,
}: {
  notification: MentionNotification;
  onMarkRead: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const timeAgo = formatTimeAgo(notification.createdAt);

  return (
    <div
      data-testid={`mention-notification-${notification.id}`}
      className={cn(
        'flex items-start gap-2 px-3 py-2 text-xs border-b border-border last:border-b-0 transition-colors',
        notification.read ? 'bg-transparent opacity-60' : 'bg-primary/5',
      )}
    >
      {/* Unread dot */}
      <div className="mt-1.5 shrink-0">
        {!notification.read && (
          <div data-testid={`mention-unread-dot-${notification.id}`} className="w-1.5 h-1.5 rounded-full bg-primary" />
        )}
        {notification.read && <div className="w-1.5 h-1.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-foreground">
          <span className="font-medium">@{notification.fromUser}</span>{' '}
          mentioned you
        </p>
        <p className="text-muted-foreground truncate mt-0.5" title={notification.commentExcerpt}>
          {notification.commentExcerpt}
        </p>
        <p className="text-muted-foreground/60 mt-0.5">{timeAgo}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {!notification.read && (
          <StyledTooltip content="Mark read" side="left">
            <button
              data-testid={`mention-mark-read-${notification.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notification.id);
              }}
              className="p-1 hover:bg-muted/50 rounded-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Mark as read"
            >
              <Check className="w-3 h-3" />
            </button>
          </StyledTooltip>
        )}
        <StyledTooltip content="Dismiss" side="left">
          <button
            data-testid={`mention-remove-${notification.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(notification.id);
            }}
            className="p-1 hover:bg-muted/50 rounded-sm text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Dismiss notification"
          >
            <X className="w-3 h-3" />
          </button>
        </StyledTooltip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MentionBadge
// ---------------------------------------------------------------------------

export default function MentionBadge() {
  const { notifications, unreadCount, markRead, markAllRead, remove, clearAll } = useMentions();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <StyledTooltip content="Mentions" side="bottom">
          <button
            data-testid="mention-badge-button"
            className="p-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors rounded-sm relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={unreadCount > 0 ? `${String(unreadCount)} unread mentions` : 'Mentions'}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span
                data-testid="mention-unread-count"
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-full tabular-nums"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </StyledTooltip>
      </PopoverTrigger>
      <PopoverContent
        data-testid="mention-dropdown"
        className="w-80 p-0 max-h-96 overflow-hidden flex flex-col"
        align="end"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-medium text-foreground">
            Mentions {unreadCount > 0 && `(${String(unreadCount)})`}
          </span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                data-testid="mention-mark-all-read"
                onClick={markAllRead}
                className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 hover:bg-muted/50 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <StyledTooltip content="Clear all" side="left">
                <button
                  data-testid="mention-clear-all"
                  onClick={clearAll}
                  className="p-1 hover:bg-muted/50 rounded-sm text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Clear all notifications"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </StyledTooltip>
            )}
          </div>
        </div>

        {/* Notification list */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div data-testid="mention-empty" className="px-3 py-8 text-center text-xs text-muted-foreground">
              No mentions yet
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={markRead}
                onRemove={remove}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${String(minutes)}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${String(hours)}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${String(days)}d ago`;
  }

  const months = Math.floor(days / 30);
  return `${String(months)}mo ago`;
}

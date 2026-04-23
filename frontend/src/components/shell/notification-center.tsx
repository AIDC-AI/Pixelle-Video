'use client';

import Link from 'next/link';
import { AlertTriangle, Bell, CheckCheck, CircleCheck, Info, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotifications, type NotificationItem } from '@/lib/hooks/use-notifications';
import { formatRelativeTime } from '@/lib/pipeline-utils';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

type NotificationTab = 'all' | 'system' | 'tasks';

function NotificationIcon({ notification }: { notification: NotificationItem }) {
  const className = cn('size-4', notification.severity === 'error' && 'text-destructive');

  if (notification.severity === 'error') {
    return <AlertTriangle className={className} />;
  }
  if (notification.severity === 'success') {
    return <CircleCheck className={className} />;
  }
  if (notification.type === 'system') {
    return <Info className={className} />;
  }
  return <Bell className={className} />;
}

function getGroupLabel(dateValue: string): string {
  const date = new Date(dateValue);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const time = date.getTime();

  if (time >= startOfToday) {
    return 'Today';
  }
  if (time >= startOfYesterday) {
    return 'Yesterday';
  }
  return 'Earlier';
}

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
}) {
  const unread = !notification.read_at;

  return (
    <article
      className={cn(
        'relative rounded-2xl border border-border/70 bg-card p-4',
        unread && 'border-primary/40',
        notification.severity === 'error' && 'border-destructive/40 bg-destructive/5'
      )}
    >
      {unread ? <span className="absolute inset-y-4 left-0 w-0.5 rounded-full bg-primary" /> : null}
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-muted p-2">
          <NotificationIcon notification={notification} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">{notification.title}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(notification.created_at)}</span>
          </div>
          <p className="text-sm text-muted-foreground">{notification.summary}</p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Badge variant="outline">{notification.type === 'task' ? 'Task' : 'System'}</Badge>
            {notification.action_href ? (
              <Link href={notification.action_href} className="text-xs font-medium text-primary hover:underline">
                Open
              </Link>
            ) : null}
            {unread ? (
              <Button type="button" variant="ghost" size="xs" onClick={() => onMarkRead(notification.id)}>
                Mark read
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function groupNotifications(notifications: NotificationItem[]) {
  const groups = new Map<string, NotificationItem[]>();
  notifications.forEach((notification) => {
    const label = getGroupLabel(notification.created_at);
    groups.set(label, [...(groups.get(label) ?? []), notification]);
  });
  return Array.from(groups.entries());
}

export function NotificationCenter({ onOpenChange, open }: NotificationCenterProps) {
  const { clear, isLoading, markAllRead, markRead, notifications, unreadCount } = useNotifications();
  const [tab, setTab] = useState<NotificationTab>('all');

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        if (tab === 'tasks') {
          return notification.type === 'task';
        }
        if (tab === 'system') {
          return notification.type === 'system';
        }
        return true;
      }),
    [notifications, tab]
  );

  const grouped = groupNotifications(filteredNotifications);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!left-auto !right-0 !top-0 h-full !max-w-[420px] !translate-x-0 !translate-y-0 !rounded-none border-l border-border/70 p-0 sm:!max-w-[420px]"
      >
        <DialogHeader className="border-b border-border/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Notifications</DialogTitle>
            {unreadCount > 0 ? <Badge>{unreadCount} unread</Badge> : null}
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 border-b border-border/70 p-3">
          <Button type="button" variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <Trash2 className="size-4" />
            Clear
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as NotificationTab)} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="border-b border-border/70 p-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>
          {(['all', 'tasks', 'system'] as NotificationTab[]).map((value) => (
            <TabsContent key={value} value={value} className="min-h-0 flex-1">
              <div role="log" aria-live="polite" className="h-[calc(100vh-11rem)] overflow-y-auto p-4">
                {isLoading ? <p className="text-sm text-muted-foreground">Loading notifications…</p> : null}
                {!isLoading && grouped.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                    No notifications for now.
                  </div>
                ) : null}
                <div className="space-y-6">
                  {grouped.map(([label, items]) => (
                    <section key={label} className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
                      {items.map((notification) => (
                        <NotificationRow key={notification.id} notification={notification} onMarkRead={markRead} />
                      ))}
                    </section>
                  ))}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

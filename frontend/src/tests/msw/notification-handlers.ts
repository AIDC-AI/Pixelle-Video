import { http, HttpResponse } from 'msw';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export interface MockNotification {
  action_href?: string | null;
  created_at: string;
  id: string;
  read_at?: string | null;
  severity: 'error' | 'info' | 'success' | 'warning';
  summary: string;
  title: string;
  type: 'system' | 'task';
}

let notifications: MockNotification[] = [];

export function resetMockNotifications() {
  notifications = [
    {
      action_href: '/batch/queue',
      created_at: new Date().toISOString(),
      id: 'notification-task-failed',
      read_at: null,
      severity: 'error',
      summary: 'Batch task failed while rendering the final video.',
      title: 'Task failed',
      type: 'task',
    },
    {
      action_href: '/library/videos',
      created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      id: 'notification-task-completed',
      read_at: null,
      severity: 'success',
      summary: 'Your video is ready in the Library.',
      title: 'Task completed',
      type: 'task',
    },
    {
      action_href: '/settings/storage',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      id: 'notification-system-storage',
      read_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      severity: 'warning',
      summary: 'Storage usage is approaching the configured warning threshold.',
      title: 'Storage warning',
      type: 'system',
    },
  ];
}

export function setMockNotifications(nextNotifications: MockNotification[]) {
  notifications = structuredClone(nextNotifications);
}

export const notificationHandlers = [
  http.get(`${baseURL}/api/notifications`, () => {
    return HttpResponse.json({ items: structuredClone(notifications) });
  }),
  http.post(`${baseURL}/api/notifications/:id/read`, ({ params }) => {
    const id = String(params.id);
    const now = new Date().toISOString();
    notifications = notifications.map((notification) =>
      notification.id === id ? { ...notification, read_at: now } : notification
    );
    return HttpResponse.json({ success: true });
  }),
  http.post(`${baseURL}/api/notifications/read-all`, () => {
    const now = new Date().toISOString();
    notifications = notifications.map((notification) => ({ ...notification, read_at: now }));
    return HttpResponse.json({ success: true });
  }),
  http.delete(`${baseURL}/api/notifications`, () => {
    notifications = [];
    return HttpResponse.json({ success: true });
  }),
];

resetMockNotifications();

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { usePolling } from '@/lib/hooks/use-polling';

export interface NotificationItem {
  action_href?: string | null;
  created_at: string;
  id: string;
  read_at?: string | null;
  severity: 'error' | 'info' | 'success' | 'warning';
  summary: string;
  title: string;
  type: 'system' | 'task';
}

interface NotificationListResponse {
  items: NotificationItem[];
}

export function sortNotifications(notifications: NotificationItem[]): NotificationItem[] {
  return [...notifications].sort((left, right) => {
    if (left.severity === 'error' && right.severity !== 'error') {
      return -1;
    }
    if (right.severity === 'error' && left.severity !== 'error') {
      return 1;
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient<NotificationListResponse>('/api/notifications'),
  });

  usePolling(() => {
    void query.refetch();
  }, 10_000, true);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient<{ success: boolean }>('/api/notifications/read-all', { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => apiClient<{ success: boolean }>('/api/notifications', { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = sortNotifications(query.data?.items ?? []);

  return {
    clear: () => clearMutation.mutate(),
    isLoading: query.isLoading,
    markAllRead: () => markAllReadMutation.mutate(),
    markRead: (id: string) => markReadMutation.mutate(id),
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read_at).length,
  };
}

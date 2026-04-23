import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it } from 'vitest';

import { sortNotifications, useNotifications } from './use-notifications';

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useNotifications', () => {
  it('loads mock notifications and exposes unread count', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.notifications.length).toBeGreaterThan(0));
    expect(result.current.unreadCount).toBeGreaterThan(0);
  });

  it('sorts failed notifications first', () => {
    const sorted = sortNotifications([
      {
        created_at: '2026-01-02T00:00:00Z',
        id: 'info',
        read_at: null,
        severity: 'info',
        summary: 'Info',
        title: 'Info',
        type: 'system',
      },
      {
        created_at: '2026-01-01T00:00:00Z',
        id: 'error',
        read_at: null,
        severity: 'error',
        summary: 'Error',
        title: 'Error',
        type: 'task',
      },
    ]);

    expect(sorted[0]?.id).toBe('error');
  });
});

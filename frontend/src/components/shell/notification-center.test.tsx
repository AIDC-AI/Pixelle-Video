import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NotificationCenter } from './notification-center';

function renderCenter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationCenter open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  );
}

describe('NotificationCenter', () => {
  it('renders notifications with tabs and live log', async () => {
    const user = userEvent.setup();
    renderCenter();

    expect(screen.getByRole('log')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Task failed')).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: 'System' }));
    await waitFor(() => expect(screen.getByText('Storage warning')).toBeInTheDocument());
  });

  it('marks all notifications read and clears them', async () => {
    const user = userEvent.setup();
    renderCenter();

    await waitFor(() => expect(screen.getByText('Task failed')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /mark all read/i }));
    await waitFor(() => expect(screen.queryByText(/unread/i)).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^clear$/i }));
    await waitFor(() => expect(screen.getByText('No notifications for now.')).toBeInTheDocument());
  });
});

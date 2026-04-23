import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PreflightCheck } from '@/components/create/preflight-check';

function renderWithClient(element: React.ReactElement, queryClient: QueryClient) {
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

describe('PreflightCheck', () => {
  it('submits immediately when required data is available', async () => {
    const onPass = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    queryClient.setQueryData(['settings'], {
      llm: { api_key: 'sk-demo' },
    });
    queryClient.setQueryData(['settings', 'storage-stats'], {
      total_size_bytes: 1024,
    });

    const user = userEvent.setup();
    renderWithClient(
      <PreflightCheck
        pipeline="quick"
        requiredFields={[{ key: 'title', label: 'Title', value: 'Launch clip' }]}
        onPass={onPass}
      >
        Submit
      </PreflightCheck>,
      queryClient
    );

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onPass).toHaveBeenCalledTimes(1);
    });
  });

  it('shows failures and links to settings when api keys are missing', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const user = userEvent.setup();
    renderWithClient(
      <PreflightCheck
        pipeline="quick"
        requiredFields={[{ key: 'title', label: 'Title', value: '' }]}
        onPass={vi.fn()}
      >
        Submit
      </PreflightCheck>,
      queryClient
    );

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('修复失败项后再提交。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '前往 Settings' })).toHaveAttribute('href', '/settings');
  });

  it('submits when the settings query is still warming the cache', async () => {
    const onPass = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    queryClient.fetchQuery({
      queryKey: ['settings'],
      queryFn: () => new Promise(() => undefined),
    }).catch(() => undefined);

    const user = userEvent.setup();
    renderWithClient(
      <PreflightCheck
        pipeline="quick"
        requiredFields={[{ key: 'title', label: 'Title', value: 'Launch clip' }]}
        onPass={onPass}
      >
        Submit
      </PreflightCheck>,
      queryClient
    );

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onPass).toHaveBeenCalledTimes(1);
    });
  });
});

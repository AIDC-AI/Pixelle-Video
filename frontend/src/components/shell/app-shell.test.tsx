import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './app-shell';

vi.mock('./topbar', () => ({ Topbar: () => <div data-testid="topbar" /> }));
vi.mock('./sidebar', () => ({ Sidebar: () => <div data-testid="sidebar" /> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('AppShell', () => {
  it('renders children with Topbar and Sidebar', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AppShell>
          <div data-testid="child">Hello</div>
        </AppShell>
      </QueryClientProvider>
    );
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

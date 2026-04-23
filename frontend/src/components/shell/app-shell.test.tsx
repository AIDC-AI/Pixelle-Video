import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './app-shell';

vi.mock('./topbar', () => ({ Topbar: () => <div data-testid="topbar" /> }));
vi.mock('./sidebar', () => ({ Sidebar: () => <div data-testid="sidebar" /> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));
vi.mock('./empty-projects-prompt', () => ({ EmptyProjectsPrompt: () => <div data-testid="empty-projects-prompt" /> }));

describe('AppShell', () => {
  it('renders children with Topbar and Sidebar', () => {
    render(
      <AppShell>
        <div data-testid="child">Hello</div>
      </AppShell>
    );
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('empty-projects-prompt')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

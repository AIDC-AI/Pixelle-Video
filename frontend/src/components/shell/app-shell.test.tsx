import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './app-shell';

vi.mock('./topbar', () => ({ Topbar: () => <div data-testid="topbar" /> }));
vi.mock('./sidebar', () => ({ Sidebar: () => <div data-testid="sidebar" /> }));

describe('AppShell', () => {
  it('renders children with Topbar and Sidebar', () => {
    render(
      <AppShell>
        <div data-testid="child">Hello</div>
      </AppShell>
    );
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

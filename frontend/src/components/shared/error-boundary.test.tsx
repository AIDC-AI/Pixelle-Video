import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './error-boundary';

function BrokenChild(): null {
  throw new Error('Exploded during render');
}

describe('ErrorBoundary', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it('renders fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('工作台发生错误。')).toBeInTheDocument();
    expect(screen.getByText('Exploded during render')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
});

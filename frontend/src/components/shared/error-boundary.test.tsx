import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './error-boundary';

function BrokenChild(): null {
  throw new Error('Exploded during render');
}

describe('ErrorBoundary', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it('renders fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong in the workbench.')).toBeInTheDocument();
    expect(screen.getByText('Exploded during render')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

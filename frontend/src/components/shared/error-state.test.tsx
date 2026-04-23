import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { axe } from '@/tests/setup-axe';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('renders card and page variants as alerts and supports retry', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const { container, rerender } = render(
      <ErrorState variant="card" title="Task failed" description="Try again." onRetry={retry} />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<ErrorState variant="page" title="Load failed" description="Support is available." />);
    expect(screen.getByRole('button', { name: 'Contact support' })).toBeInTheDocument();
  });

  it('renders inline variant without an alert role', () => {
    render(<ErrorState variant="inline" title="Inline error" description="Fix the field." />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Inline error')).toBeInTheDocument();
  });
});

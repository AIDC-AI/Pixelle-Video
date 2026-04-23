import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProviderStatusCard } from './provider-status-card';

describe('ProviderStatusCard', () => {
  it('renders a masked key and verified state', () => {
    render(
      <ProviderStatusCard
        name="OpenAI"
        maskedKey="sk-***abc"
        status="valid"
        onEdit={vi.fn()}
        onTest={vi.fn()}
      />
    );

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('sk-***abc')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('calls edit and test handlers', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onTest = vi.fn();

    render(
      <ProviderStatusCard
        name="ComfyUI"
        maskedKey="***"
        status="unknown"
        onEdit={onEdit}
        onTest={onTest}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Test Connection' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onTest).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('disables connection testing while checking', () => {
    render(
      <ProviderStatusCard
        name="RunningHub"
        maskedKey="rh-***key"
        status="checking"
        onEdit={vi.fn()}
        onTest={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Test Connection' })).toBeDisabled();
    expect(screen.getByText('Checking')).toBeInTheDocument();
  });
});

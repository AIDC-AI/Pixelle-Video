import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProjectRequiredDialog } from './project-required-dialog';

describe('ProjectRequiredDialog', () => {
  it('renders the dialog content and closes through the action button', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn<(open: boolean) => void>();

    render(<ProjectRequiredDialog open onOpenChange={onOpenChange} />);

    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Close' })[0]);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

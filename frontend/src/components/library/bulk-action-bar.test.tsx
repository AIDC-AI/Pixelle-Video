import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BulkActionBar } from './bulk-action-bar';

describe('BulkActionBar', () => {
  it('runs bulk actions after confirmation', async () => {
    const user = userEvent.setup();
    const onClearSelection = vi.fn();
    const onDelete = vi.fn();
    const onDownload = vi.fn();

    render(
      <BulkActionBar
        selectedCount={3}
        onClearSelection={onClearSelection}
        onDelete={onDelete}
        onDownload={onDownload}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete', hidden: false }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

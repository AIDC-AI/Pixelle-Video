import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { readLibraryView, ViewToggle, writeLibraryView } from './view-toggle';

describe('ViewToggle', () => {
  it('switches between grid and list views', async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    render(<ViewToggle view="grid" onViewChange={onViewChange} />);

    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'List view' }));

    expect(onViewChange).toHaveBeenCalledWith('list');
  });

  it('persists the selected view', () => {
    writeLibraryView('images', 'list');

    expect(readLibraryView('images')).toBe('list');
  });
});

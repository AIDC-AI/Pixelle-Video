import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { readStarredAsset, StarButton, writeStarredAsset } from './star-button';

describe('StarButton', () => {
  it('renders active state and toggles', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<StarButton starred onToggle={onToggle} />);

    expect(screen.getByRole('button', { name: 'Remove from starred' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Remove from starred' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('persists starred assets in localStorage', () => {
    writeStarredAsset('videos', 'task-1', true);
    expect(readStarredAsset('videos', 'task-1')).toBe(true);

    writeStarredAsset('videos', 'task-1', false);
    expect(readStarredAsset('videos', 'task-1')).toBe(false);
  });
});

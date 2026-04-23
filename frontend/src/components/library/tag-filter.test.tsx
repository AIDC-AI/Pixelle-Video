import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TagFilter } from './tag-filter';

describe('TagFilter', () => {
  it('toggles and clears selected tags', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<TagFilter tags={['quick', 'i2v', 'quick']} selected={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'i2v' }));
    expect(onChange).toHaveBeenCalledWith(['i2v']);

    rerender(<TagFilter tags={['quick', 'i2v']} selected={['i2v']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});

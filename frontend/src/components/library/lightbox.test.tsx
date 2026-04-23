import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Lightbox } from './lightbox';

const images = [
  { id: '1', title: 'First', url: '/first.png' },
  { id: '2', title: 'Second', url: '/second.png' },
];

describe('Lightbox', () => {
  it('navigates and closes with keyboard', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Lightbox open images={images} onOpenChange={onOpenChange} />);

    expect(screen.getByText('First')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(screen.getByText('Second')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

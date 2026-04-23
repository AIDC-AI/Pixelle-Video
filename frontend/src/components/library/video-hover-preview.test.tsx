import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { VideoHoverPreview } from './video-hover-preview';

describe('VideoHoverPreview', () => {
  it('shows the hover preview and maps mouse position to time', () => {
    vi.spyOn(Date, 'now').mockReturnValue(200);
    render(<VideoHoverPreview src="/video.mp4" duration={20} />);

    const preview = screen.getByLabelText('Video hover preview').parentElement?.parentElement;
    expect(preview).toBeTruthy();

    Object.defineProperty(preview, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 100 }),
    });

    fireEvent.mouseEnter(preview!);
    fireEvent.mouseMove(preview!, { clientX: 50 });

    expect(screen.getByText('00:10')).toBeInTheDocument();
  });
});

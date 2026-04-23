import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WaveformPlayer } from './waveform-player';

const playPause = vi.fn();

vi.mock('wavesurfer.js', () => ({
  default: {
    create: vi.fn(() => ({
      destroy: vi.fn(),
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'ready') {
          queueMicrotask(callback);
        }
      }),
      pause: vi.fn(),
      play: vi.fn(),
      playPause,
    })),
  },
}));

describe('WaveformPlayer', () => {
  it('creates a waveform and toggles playback', async () => {
    const user = userEvent.setup();
    render(<WaveformPlayer src="/voice.mp3" />);

    await waitFor(() => expect(screen.getByText('Ready')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /play/i }));

    expect(playPause).toHaveBeenCalledTimes(1);
  });
});

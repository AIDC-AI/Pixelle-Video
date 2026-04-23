import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InlineAudioPlayer } from './inline-audio-player';

describe('InlineAudioPlayer', () => {
  it('plays audio and updates progress', async () => {
    const user = userEvent.setup();
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();

    render(<InlineAudioPlayer src="/bgm.mp3" duration={10} />);

    await user.click(screen.getByRole('button', { name: 'Play audio' }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    const audio = document.querySelector('audio')!;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 10 });
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 5 });
    fireEvent.timeUpdate(audio);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });
});

import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useVideoShortcuts } from './use-video-shortcuts';

function Harness({ video }: { video: HTMLVideoElement }) {
  const ref = useRef<HTMLVideoElement | null>(video);
  useVideoShortcuts({ videoRef: ref });
  return <div />;
}

describe('useVideoShortcuts', () => {
  it('controls playback, seeking, fullscreen, and mute', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'paused', { configurable: true, value: true });
    Object.defineProperty(video, 'duration', { configurable: true, value: 100 });
    video.currentTime = 30;
    video.play = vi.fn().mockResolvedValue(undefined);
    video.pause = vi.fn();
    video.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    render(<Harness video={video} />);

    fireEvent.keyDown(window, { key: 'k' });
    expect(video.play).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'j' });
    expect(video.currentTime).toBe(20);

    fireEvent.keyDown(window, { key: 'l' });
    expect(video.currentTime).toBe(30);

    fireEvent.keyDown(window, { key: 'f' });
    expect(video.requestFullscreen).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'm' });
    expect(video.muted).toBe(true);
  });
});

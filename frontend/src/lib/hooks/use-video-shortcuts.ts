'use client';

import { useEffect } from 'react';

interface UseVideoShortcutsOptions {
  enabled?: boolean;
  frameDuration?: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
    target.getAttribute('role') === 'textbox'
  );
}

export function useVideoShortcuts({
  enabled = true,
  frameDuration = 1 / 30,
  videoRef,
}: UseVideoShortcutsOptions) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const video = videoRef.current;
      if (!video) {
        return;
      }

      const key = event.key.toLowerCase();
      if (![' ', 'k', 'j', 'l', ',', '.', 'f', 'm'].includes(key)) {
        return;
      }

      event.preventDefault();

      if (key === ' ' || key === 'k') {
        if (video.paused) {
          void video.play();
        } else {
          video.pause();
        }
      } else if (key === 'j') {
        video.currentTime = Math.max(0, video.currentTime - 10);
      } else if (key === 'l') {
        video.currentTime = Math.min(video.duration || Number.MAX_SAFE_INTEGER, video.currentTime + 10);
      } else if (key === ',') {
        video.currentTime = Math.max(0, video.currentTime - frameDuration);
      } else if (key === '.') {
        video.currentTime = Math.min(video.duration || Number.MAX_SAFE_INTEGER, video.currentTime + frameDuration);
      } else if (key === 'f') {
        void video.requestFullscreen?.();
      } else if (key === 'm') {
        video.muted = !video.muted;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, frameDuration, videoRef]);
}

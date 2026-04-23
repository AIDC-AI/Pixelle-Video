'use client';

import { useEffect, useRef } from 'react';

export function usePolling(callback: () => void, interval: number, enabled = true) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || interval <= 0 || typeof window === 'undefined') {
      return;
    }

    let timerId: number | null = null;

    const stop = () => {
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    };

    const tick = () => {
      callbackRef.current();
    };

    const start = () => {
      stop();
      if (document.visibilityState === 'hidden') {
        return;
      }
      timerId = window.setInterval(tick, interval);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stop();
        return;
      }

      tick();
      start();
    };

    start();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, interval]);
}

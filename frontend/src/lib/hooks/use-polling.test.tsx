import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePolling } from '@/lib/hooks/use-polling';

function PollingHarness({ callback }: { callback: () => void }) {
  usePolling(callback, 100, true);
  return null;
}

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the callback on the configured interval', () => {
    const callback = vi.fn();
    render(<PollingHarness callback={callback} />);

    vi.advanceTimersByTime(320);

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('pauses while the tab is hidden and resumes on visibility change', () => {
    const callback = vi.fn();
    render(<PollingHarness callback={callback} />);

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    vi.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(callback).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(3);
  });
});

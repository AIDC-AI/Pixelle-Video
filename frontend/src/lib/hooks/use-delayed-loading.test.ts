import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDelayedLoading } from './use-delayed-loading';

describe('useDelayedLoading', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('suppresses loading state until the delay expires', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ loading }) => useDelayedLoading(loading, 200),
      { initialProps: { loading: true } }
    );

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);

    rerender({ loading: false });
    expect(result.current).toBe(false);
  });
});

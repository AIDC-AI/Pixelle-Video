import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCurrentProjectHydration } from './use-current-project';
import { useCurrentProjectStore } from '@/stores/current-project';

describe('useCurrentProjectHydration', () => {
  beforeEach(() => {
    localStorage.clear();
    useCurrentProjectStore.setState({ currentProject: null });
  });

  it('returns hydrated state immediately when persistence is already hydrated', () => {
    const hasHydratedSpy = vi.spyOn(useCurrentProjectStore.persist, 'hasHydrated').mockReturnValue(true);
    const rehydrateSpy = vi.spyOn(useCurrentProjectStore.persist, 'rehydrate').mockResolvedValue(undefined);
    useCurrentProjectStore.setState({ currentProject: { id: 'project-1', name: 'Launch Campaign' } });

    const { result } = renderHook(() => useCurrentProjectHydration());

    expect(result.current.isHydrated).toBe(true);
    expect(result.current.currentProject).toEqual({ id: 'project-1', name: 'Launch Campaign' });
    expect(rehydrateSpy).not.toHaveBeenCalled();

    hasHydratedSpy.mockRestore();
    rehydrateSpy.mockRestore();
  });

  it('rehydrates persisted state when hydration has not completed', async () => {
    const hasHydratedSpy = vi.spyOn(useCurrentProjectStore.persist, 'hasHydrated').mockReturnValue(false);
    const rehydrateSpy = vi.spyOn(useCurrentProjectStore.persist, 'rehydrate').mockResolvedValue(undefined);

    renderHook(() => useCurrentProjectHydration());

    await waitFor(() => {
      expect(rehydrateSpy).toHaveBeenCalled();
    });

    hasHydratedSpy.mockRestore();
    rehydrateSpy.mockRestore();
  });

  it('handles a missing persist api gracefully', () => {
    const originalPersist = useCurrentProjectStore.persist;
    Object.defineProperty(useCurrentProjectStore, 'persist', {
      value: undefined,
      configurable: true,
    });

    try {
      const { result } = renderHook(() => useCurrentProjectHydration());
      expect(result.current.isHydrated).toBe(true);
    } finally {
      Object.defineProperty(useCurrentProjectStore, 'persist', {
        value: originalPersist,
        configurable: true,
      });
    }
  });

  it('marks the hook as hydrated after the persist callback fires', async () => {
    const hasHydratedSpy = vi.spyOn(useCurrentProjectStore.persist, 'hasHydrated').mockReturnValue(false);
    const rehydrateSpy = vi.spyOn(useCurrentProjectStore.persist, 'rehydrate').mockResolvedValue(undefined);
    const onFinishHydrationSpy = vi
      .spyOn(useCurrentProjectStore.persist, 'onFinishHydration')
      .mockImplementation((callback) => {
        callback(useCurrentProjectStore.getState());
        return () => undefined;
      });

    const { result } = renderHook(() => useCurrentProjectHydration());

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(rehydrateSpy).toHaveBeenCalled();

    onFinishHydrationSpy.mockRestore();
    hasHydratedSpy.mockRestore();
    rehydrateSpy.mockRestore();
  });
});

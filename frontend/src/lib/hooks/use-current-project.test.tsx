import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCurrentProjectHydration } from './use-current-project';
import { useCurrentProjectStore } from '@/stores/current-project';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCurrentProjectHydration', () => {
  beforeEach(() => {
    localStorage.clear();
    useCurrentProjectStore.setState({ currentProjectId: null });
  });

  it('returns hydrated state immediately when persistence is already hydrated', () => {
    const hasHydratedSpy = vi.spyOn(useCurrentProjectStore.persist, 'hasHydrated').mockReturnValue(true);
    const rehydrateSpy = vi.spyOn(useCurrentProjectStore.persist, 'rehydrate').mockResolvedValue(undefined);
    useCurrentProjectStore.setState({ currentProjectId: 'project-1' });

    const { result } = renderHook(() => useCurrentProjectHydration(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isHydrated).toBe(true);
    expect(rehydrateSpy).not.toHaveBeenCalled();
    return waitFor(() => {
      expect(result.current.currentProject?.id).toBe('project-1');
    }).finally(() => {
      hasHydratedSpy.mockRestore();
      rehydrateSpy.mockRestore();
    });
  });

  it('rehydrates persisted state when hydration has not completed', async () => {
    const hasHydratedSpy = vi.spyOn(useCurrentProjectStore.persist, 'hasHydrated').mockReturnValue(false);
    const rehydrateSpy = vi.spyOn(useCurrentProjectStore.persist, 'rehydrate').mockResolvedValue(undefined);

    renderHook(() => useCurrentProjectHydration(), {
      wrapper: createWrapper(),
    });

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
      const { result } = renderHook(() => useCurrentProjectHydration(), {
        wrapper: createWrapper(),
      });
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

    const { result } = renderHook(() => useCurrentProjectHydration(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(rehydrateSpy).toHaveBeenCalled();

    onFinishHydrationSpy.mockRestore();
    hasHydratedSpy.mockRestore();
    rehydrateSpy.mockRestore();
  });
});

'use client';

import { useEffect, useState } from 'react';

import { useCurrentProjectStore } from '@/stores/current-project';

export function useCurrentProjectHydration() {
  const currentProject = useCurrentProjectStore((state) => state.currentProject);
  const setCurrentProject = useCurrentProjectStore((state) => state.setCurrentProject);
  const [isHydrated, setIsHydrated] = useState(useCurrentProjectStore.persist.hasHydrated());

  useEffect(() => {
    const persistApi = useCurrentProjectStore.persist;
    const unsubscribe = persistApi.onFinishHydration(() => {
      setIsHydrated(true);
    });

    if (!persistApi.hasHydrated()) {
      void persistApi.rehydrate();
    }

    return () => unsubscribe();
  }, []);

  return {
    currentProject,
    isHydrated,
    setCurrentProject,
  };
}

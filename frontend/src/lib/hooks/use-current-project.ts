'use client';

import { useEffect, useMemo, useState } from 'react';

import { useProjects } from '@/lib/hooks/use-projects';
import { useCurrentProjectStore } from '@/stores/current-project';
import type { components } from '@/types/api';

type Project = components['schemas']['Project'];

export function useCurrentProjectHydration() {
  const legacyCurrentProject = useCurrentProjectStore((state) => state.currentProject);
  const currentProjectId = useCurrentProjectStore((state) => state.currentProjectId);
  const setCurrentProjectId = useCurrentProjectStore((state) => state.setCurrentProjectId);
  const clearCurrentProject = useCurrentProjectStore((state) => state.clearCurrentProject);
  const { data: projectsData } = useProjects();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const persistApi = useCurrentProjectStore.persist;
    if (!persistApi) {
      setIsHydrated(true);
      return undefined;
    }

    const unsubscribe = persistApi.onFinishHydration(() => {
      setIsHydrated(true);
    });

    if (persistApi.hasHydrated()) {
      setIsHydrated(true);
    } else {
      void persistApi.rehydrate();
    }

    return () => unsubscribe();
  }, []);

  const currentProject = useMemo(
    () =>
      (projectsData?.items ?? []).find(
        (project) => project.id === currentProjectId || project.id === legacyCurrentProject?.id
      ) ??
      (legacyCurrentProject
        ? ({ ...(legacyCurrentProject.name ? { name: legacyCurrentProject.name } : {}), id: legacyCurrentProject.id } as Project)
        : currentProjectId
          ? ({ id: currentProjectId } as Project)
          : null),
    [currentProjectId, legacyCurrentProject, projectsData?.items]
  );

  const setCurrentProject = (project: (Pick<Project, 'id'> & Partial<Pick<Project, 'name'>>) | null) => {
    useCurrentProjectStore.setState({
      currentProject: project,
      currentProjectId: project?.id ?? null,
    });
  };

  return {
    currentProjectId,
    currentProject,
    isHydrated,
    setCurrentProjectId,
    clearCurrentProject,
    setCurrentProject,
  };
}

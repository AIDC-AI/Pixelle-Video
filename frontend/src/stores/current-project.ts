import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CurrentProjectStore {
  currentProject: { id: string; name?: string } | null;
  currentProjectId: string | null;
  setCurrentProjectId: (projectId: string | null) => void;
  clearCurrentProject: () => void;
  reset: () => void;
}

export const useCurrentProjectStore = create<CurrentProjectStore>()(
  persist(
    (set) => ({
      currentProject: null,
      currentProjectId: null,
      setCurrentProjectId: (projectId) => set((state) => ({
        currentProjectId: projectId,
        currentProject:
          projectId && state.currentProject?.id === projectId
            ? state.currentProject
            : projectId
              ? { id: projectId, name: state.currentProject?.name }
              : null,
      })),
      clearCurrentProject: () => set({ currentProject: null, currentProjectId: null }),
      reset: () => set({ currentProject: null, currentProjectId: null }),
    }),
    {
      name: 'current-project-storage',
      skipHydration: true,
    }
  )
);

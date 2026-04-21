import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Project {
  id: string;
  name: string;
}

interface CurrentProjectStore {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  reset: () => void;
}

export const useCurrentProjectStore = create<CurrentProjectStore>()(
  persist(
    (set) => ({
      currentProject: null,
      setCurrentProject: (project) => set({ currentProject: project }),
      reset: () => set({ currentProject: null }),
    }),
    {
      name: 'current-project-storage',
      skipHydration: true,
    }
  )
);

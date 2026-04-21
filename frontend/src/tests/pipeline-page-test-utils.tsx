import React from 'react';
import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useCurrentProjectStore } from '@/stores/current-project';

type PersistedProject = ReturnType<typeof useCurrentProjectStore.getState>['currentProject'];

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function renderWithQueryClient(element: React.ReactElement) {
  return render(<QueryClientProvider client={createQueryClient()}>{element}</QueryClientProvider>);
}

export async function seedCurrentProject(project: PersistedProject): Promise<void> {
  if (project) {
    localStorage.setItem(
      'current-project-storage',
      JSON.stringify({
        state: { currentProject: project },
        version: 0,
      })
    );
  } else {
    localStorage.removeItem('current-project-storage');
  }

  useCurrentProjectStore.setState({ currentProject: project });

  await act(async () => {
    await useCurrentProjectStore.persist.rehydrate();
  });
}

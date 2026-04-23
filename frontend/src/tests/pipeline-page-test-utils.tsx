import React from 'react';
import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppIntlProvider } from '@/lib/i18n';
import { useCurrentProjectStore } from '@/stores/current-project';

type PersistedProject = { id: string; name?: string } | null;

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
  return render(
    <AppIntlProvider>
      <QueryClientProvider client={createQueryClient()}>{element}</QueryClientProvider>
    </AppIntlProvider>
  );
}

export async function seedCurrentProject(project: PersistedProject): Promise<void> {
  if (project) {
    localStorage.setItem(
      'current-project-storage',
      JSON.stringify({
        state: { currentProjectId: project.id },
        version: 0,
      })
    );
  } else {
    localStorage.removeItem('current-project-storage');
  }

  useCurrentProjectStore.setState({ currentProjectId: project?.id ?? null });

  await act(async () => {
    await useCurrentProjectStore.persist.rehydrate();
  });
}

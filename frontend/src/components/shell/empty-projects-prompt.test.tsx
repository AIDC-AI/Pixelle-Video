import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmptyProjectsPrompt } from './empty-projects-prompt';
import { setProjects } from '@/tests/msw/handlers';
import { server } from '@/tests/msw/server';
import type { components } from '@/types/api';

type Project = components['schemas']['Project'];

interface MockCurrentProjectState {
  currentProject: { id: string; name: string } | null;
  setCurrentProject: ReturnType<typeof vi.fn>;
}

const mockState: MockCurrentProjectState = {
  currentProject: null,
  setCurrentProject: vi.fn(),
};

vi.mock('@/lib/hooks/use-current-project', () => ({
  useCurrentProjectHydration: () => ({
    currentProject: mockState.currentProject,
    isHydrated: true,
    setCurrentProject: mockState.setCurrentProject,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function buildProject(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name: `Project ${id}`,
    created_at: '2026-04-19T00:00:00Z',
    updated_at: '2026-04-19T00:00:00Z',
    cover_url: null,
    pipeline_hint: null,
    task_count: 0,
    last_task_id: null,
    deleted_at: null,
    ...overrides,
  };
}

function renderPrompt() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EmptyProjectsPrompt />
    </QueryClientProvider>
  );
}

describe('EmptyProjectsPrompt', () => {
  beforeEach(() => {
    mockState.currentProject = { id: 'project-current', name: 'Current Project' };
    mockState.setCurrentProject = vi.fn();
  });

  it('renders stale empty projects and allows dismissal', async () => {
    const user = userEvent.setup();

    setProjects([
      buildProject('project-current'),
      buildProject('project-stale-1'),
      buildProject('project-stale-2'),
    ]);

    renderPrompt();

    expect(await screen.findByText('2 empty projects can be cleaned up.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Maybe Later' }));

    await waitFor(() => {
      expect(screen.queryByText('2 empty projects can be cleaned up.')).not.toBeInTheDocument();
    });

    expect(window.sessionStorage.getItem('empty-project-cleanup-dismissed')).toBe(
      JSON.stringify(['project-stale-1', 'project-stale-2'])
    );
  });

  it('cleans up stale empty projects through the backend and refreshes the query', async () => {
    const user = userEvent.setup();

    setProjects([buildProject('project-stale')]);

    renderPrompt();

    expect(await screen.findByText('1 empty project can be cleaned up.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clean Up' }));

    await waitFor(() => {
      expect(screen.queryByText('1 empty project can be cleaned up.')).not.toBeInTheDocument();
    });

    expect(mockState.setCurrentProject).not.toHaveBeenCalled();
  });

  it('recovers from malformed session storage state', async () => {
    window.sessionStorage.setItem('empty-project-cleanup-dismissed', '{bad json');
    setProjects([buildProject('project-stale')]);

    renderPrompt();

    expect(await screen.findByText('1 empty project can be cleaned up.')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('empty-project-cleanup-dismissed')).toBeNull();
  });

  it('stays hidden when projects are not stale or already selected', async () => {
    mockState.currentProject = { id: 'project-current', name: 'Current Project' };
    setProjects([
      buildProject('project-current'),
      buildProject('project-active', { task_count: 2 }),
      buildProject('project-recent', { created_at: '2026-04-22T00:00:00Z' }),
      buildProject('project-invalid-date', { created_at: 'not-a-date' }),
    ]);

    renderPrompt();

    await waitFor(() => {
      expect(screen.queryByText(/empty project/)).not.toBeInTheDocument();
    });
  });

  it('shows an error toast when cleanup fails', async () => {
    const user = userEvent.setup();

    setProjects([buildProject('project-stale')]);
    server.use(
      http.delete('http://localhost:8000/api/projects/:projectId', () =>
        HttpResponse.json(
          { detail: { code: 'DELETE_FAILED', message: 'Cleanup failed.' } },
          { status: 500 }
        )
      )
    );

    const { toast } = await import('sonner');

    renderPrompt();

    expect(await screen.findByText('1 empty project can be cleaned up.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clean Up' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Cleanup failed.');
    });
  });
});

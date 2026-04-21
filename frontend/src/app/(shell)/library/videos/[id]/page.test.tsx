import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './page';
import { useCurrentProjectStore } from '@/stores/current-project';
import { buildTask, setLibraryVideoDetail, setTaskScenario } from '@/tests/msw/handlers';

let mockVideoId = 'task-library-video-1';
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: mockVideoId }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

async function seedCurrentProject(project: { id: string; name: string } | null) {
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

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Page />
    </QueryClientProvider>
  );
}

describe('Library Video Detail Page', () => {
  beforeEach(async () => {
    mockVideoId = 'task-library-video-1';
    mockPush.mockReset();
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders the detail view with metadata and snapshot', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Library Video' })).toBeInTheDocument();
    expect(screen.getByText('Generation Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerate From This' })).toBeInTheDocument();
  });

  it('builds the regenerate URL from the task snapshot', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: 'Library Video' });
    await user.click(screen.getByRole('button', { name: 'Regenerate From This' }));

    expect(mockPush).toHaveBeenCalledWith(
      '/create/quick?title=Library+Video&topic=A+generated+library+video&tts_workflow=selfhost%2Ftts_edge.json&media_workflow=selfhost%2Fmedia_default.json'
    );
  });

  it('falls back to task detail on 501 and opens the cancel confirmation flow', async () => {
    mockVideoId = 'task-detail-running';
    setLibraryVideoDetail('task-detail-running', { kind: 'not-implemented' });
    setTaskScenario('task-detail-running', [
      buildTask('task-detail-running', 'running', {
        project_id: 'project-1',
        request_params: {
          media_workflow: 'selfhost/media_default.json',
          mode: 'generate',
          project_id: 'project-1',
          text: 'A running task',
          title: 'Active Task',
          tts_workflow: 'selfhost/tts_edge.json',
        },
      }),
    ]);

    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderPage();

    expect(await screen.findByText(/Detailed library metadata is not available yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText('Cancel task?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Cancel task?')).not.toBeInTheDocument();
    });
  });

  it('shows the non-destructive deletion fallback for completed videos', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: 'Library Video' });
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText('Deletion unavailable')).toBeInTheDocument();
    expect(screen.getByText(/does not expose completed-history deletion yet/i)).toBeInTheDocument();
  });

  it('shows the missing-detail empty state when both detail and task are absent', async () => {
    mockVideoId = 'task-missing';
    setLibraryVideoDetail('task-missing', { kind: 'not-found' });

    renderPage();

    expect(await screen.findByText('Video detail unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Library' })).toHaveAttribute('href', '/library/videos');
  });
});

import { act, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './page';
import { useCurrentProjectStore } from '@/stores/current-project';
import { buildTask, setTaskScenario } from '@/tests/msw/handlers';

let mockSearchParams = new URLSearchParams('');
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/batch/queue',
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
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

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Page />
    </QueryClientProvider>
  );
}

describe('Batch Queue Page', () => {
  beforeEach(async () => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockSearchParams = new URLSearchParams('');
    mockPush.mockReset();
    mockReplace.mockReset();
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders queue rows from the tasks endpoint', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '任务队列' })).toBeInTheDocument();
    expect(await screen.findByText('task-library-video-1')).toBeInTheDocument();
    expect(screen.getAllByText('快速创作').length).toBeGreaterThan(0);
  });

  it('applies the running status filter from URL state', async () => {
    setTaskScenario(
      'task-running-queue',
      [
        buildTask('task-running-queue', 'running', {
          project_id: 'project-1',
          request_params: {
            media_workflow: 'selfhost/media_default.json',
            mode: 'generate',
            text: 'A running task',
            title: 'Running Task',
            tts_workflow: 'selfhost/tts_edge.json',
          },
        }),
      ]
    );
    mockSearchParams = new URLSearchParams('status=running&project_id=project-1');

    renderPage();

    expect(await screen.findByText('task-running-queue')).toBeInTheDocument();
    expect(screen.queryByText('task-library-video-1')).not.toBeInTheDocument();
  });

  it('cancels a running task from the queue', async () => {
    setTaskScenario(
      'task-running-cancel',
      [
        buildTask('task-running-cancel', 'running', {
          project_id: 'project-1',
          request_params: {
            media_workflow: 'selfhost/media_default.json',
            mode: 'generate',
            text: 'A running task',
            title: 'Running Task',
            tts_workflow: 'selfhost/tts_edge.json',
          },
        }),
      ],
      buildTask('task-running-cancel', 'cancelled', {
        project_id: 'project-1',
        request_params: {
          media_workflow: 'selfhost/media_default.json',
          mode: 'generate',
          text: 'A running task',
          title: 'Running Task',
          tts_workflow: 'selfhost/tts_edge.json',
        },
      })
    );
    mockSearchParams = new URLSearchParams('status=running&project_id=project-1');
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    expect(await screen.findByText('task-running-cancel')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));

    await waitFor(() => {
      expect(screen.queryByText('task-running-cancel')).not.toBeInTheDocument();
    });
  });

  it('pushes active tasks back to the create flow for live progress', async () => {
    setTaskScenario(
      'task-running-view',
      [
        buildTask('task-running-view', 'running', {
          project_id: 'project-1',
          request_params: {
            media_workflow: 'selfhost/media_default.json',
            mode: 'generate',
            text: 'A running task',
            title: 'Running Task',
            tts_workflow: 'selfhost/tts_edge.json',
          },
        }),
      ]
    );
    mockSearchParams = new URLSearchParams('status=running&project_id=project-1');
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    expect(await screen.findByText('task-running-view')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '查看' })[0]);

    expect(mockPush).toHaveBeenCalledWith('/create/quick?task_id=task-running-view');
  });

  it('shows the empty state when filters return no tasks', async () => {
    mockSearchParams = new URLSearchParams('status=cancelled&project_id=project-2');

    renderPage();

    expect(await screen.findByText('没有匹配的任务')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前往创作' })).toHaveAttribute('href', '/create');
  });

  it('routes completed tasks to the library detail page', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    expect(await screen.findByText('task-library-video-1')).toBeInTheDocument();

    const taskCell = screen.getByText('task-library-video-1').closest('div');
    expect(taskCell).not.toBeNull();
    const row = taskCell?.closest('.grid');
    expect(row).not.toBeNull();

    await user.click(within(row as HTMLElement).getByRole('button', { name: '查看' }));

    expect(mockPush).toHaveBeenCalledWith('/library/videos/task-library-video-1');
  });

  it('updates URL state when filters change through the controls', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: '任务队列' });

    await user.click(screen.getByRole('combobox', { name: '状态' }));
    await user.click(screen.getByText('已取消'));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/batch/queue?status=cancelled', { scroll: false });
    });
  });
});

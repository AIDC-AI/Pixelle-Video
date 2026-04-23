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

describe('Library Video Detail Page', () => {
  beforeEach(async () => {
    mockVideoId = 'task-library-video-1';
    mockPush.mockReset();
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders the detail view with metadata and snapshot', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Library Video' })).toBeInTheDocument();
    expect(screen.getByText('创作摘要')).toBeInTheDocument();
    expect(screen.getByText('基本信息')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新生成' })).toBeInTheDocument();
    expect(screen.getByText('分镜详情')).toBeInTheDocument();
    expect(screen.queryByText('media workflow')).not.toBeInTheDocument();
  });

  it('builds the regenerate URL from the task snapshot', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: 'Library Video' });
    await user.click(screen.getByRole('button', { name: '重新生成' }));

    expect(mockPush).toHaveBeenCalledWith(
      '/create/quick?title=Library+Video&topic=A+generated+library+video&tts_workflow=selfhost%2Ftts_edge.json&media_workflow=selfhost%2Fmedia_default.json'
    );
  });

  it('uses task fallback on 501 and opens the cancel confirmation flow', async () => {
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

    expect(await screen.findByRole('heading', { name: 'Active Task' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '取消任务？' }));

    expect(screen.getAllByText('取消任务？').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: '确认取消' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '确认取消' })).not.toBeInTheDocument();
    });
  });

  it('deletes completed videos through the library endpoint', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: 'Library Video' });
    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(screen.getByText('删除这个视频？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/library/videos');
    });
  });

  it('shows the missing-detail empty state when both detail and task are absent', async () => {
    mockVideoId = 'task-missing';
    setLibraryVideoDetail('task-missing', { kind: 'not-found' });

    renderPage();

    expect(await screen.findByText('无法读取视频详情')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回视频库' })).toHaveAttribute('href', '/library/videos');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecentTasksPanel } from './recent-tasks-panel';
import { AppIntlProvider } from '@/lib/i18n';
import type { components } from '@/types/api';

type Task = components['schemas']['Task'];

const push = vi.fn();
const useTaskList = vi.fn();

let currentProjectId: string | null = 'project-1';

const tasks: Task[] = [
  {
    task_id: 'task-1234567890',
    task_type: 'video_generation',
    project_id: 'project-1',
    status: 'completed',
    created_at: '2026-04-22T10:00:00Z',
  },
];

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        push(href);
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock('@/lib/hooks/use-current-project', () => ({
  useCurrentProjectHydration: () => ({
    currentProjectId,
    currentProject: currentProjectId ? { id: currentProjectId, name: 'Launch Campaign' } : null,
    isHydrated: true,
  }),
}));

vi.mock('@/lib/hooks/use-task-list', () => ({
  useTaskList: (options: { limit?: number; projectFilter: string }) => useTaskList(options),
}));

function renderRecentTasksPanel() {
  return render(
    <AppIntlProvider>
      <RecentTasksPanel />
    </AppIntlProvider>
  );
}

describe('RecentTasksPanel', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    currentProjectId = 'project-1';
    push.mockClear();
    useTaskList.mockReset();
    useTaskList.mockReturnValue({ data: tasks, isLoading: false, isError: false, error: null });
  });

  it('renders loading skeletons', () => {
    useTaskList.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null });

    const { container } = renderRecentTasksPanel();

    expect(screen.getByText('加载中…')).toBeInTheDocument();
    expect(container.querySelectorAll('.skeleton-shimmer')).toHaveLength(6);
    expect(useTaskList).toHaveBeenCalledWith({ limit: 5, projectFilter: 'project-1' });
  });

  it('renders an empty state', () => {
    useTaskList.mockReturnValue({ data: [], isLoading: false, isError: false, error: null });

    renderRecentTasksPanel();

    expect(screen.getByText('暂无最近任务')).toBeInTheDocument();
  });

  it('renders tasks and navigates to the video detail route', () => {
    renderRecentTasksPanel();

    expect(screen.getByText('task-123')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /task-123/i }));

    expect(push).toHaveBeenCalledWith('/library/videos/task-1234567890');
  });

  it('renders no-project copy without calling the task hook', () => {
    currentProjectId = null;

    renderRecentTasksPanel();

    expect(screen.getByText('选择项目后可查看最近任务')).toBeInTheDocument();
    expect(useTaskList).not.toHaveBeenCalled();
  });

  it('renders inline error state', () => {
    useTaskList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'Network failed' },
    });

    renderRecentTasksPanel();

    expect(screen.getByText('Network failed')).toBeInTheDocument();
  });
});

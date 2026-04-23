import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import CreateHeroPage from './page';
import { AppIntlProvider } from '@/lib/i18n';
import type { components } from '@/types/api';

type Project = components['schemas']['Project'];
type Task = components['schemas']['Task'];

const project: Project = {
  id: 'project-1',
  name: 'Launch Campaign',
  created_at: '2026-04-20T10:00:00Z',
  updated_at: '2026-04-22T10:00:00Z',
  task_count: 4,
};

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
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className, 'aria-label': ariaLabel }: { children: ReactNode; href: string; className?: string; 'aria-label'?: string }) => (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/hooks/use-current-project', () => ({
  useCurrentProjectHydration: () => ({
    currentProjectId: project.id,
    currentProject: project,
    isHydrated: true,
    setCurrentProject: vi.fn(),
  }),
}));

vi.mock('@/lib/hooks/use-projects', () => ({
  useProjects: () => ({
    data: {
      items: [project],
    },
  }),
}));

vi.mock('@/lib/hooks/use-task-list', () => ({
  useTaskList: () => ({
    data: tasks,
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

function renderCreatePage() {
  return render(
    <AppIntlProvider>
      <CreateHeroPage />
    </AppIntlProvider>
  );
}

describe('Create Workbench Page', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
  });

  it('renders quick intent input', () => {
    renderCreatePage();
    expect(screen.getByPlaceholderText(/描述你的创意/i)).toBeInTheDocument();
  });

  it('renders the project bar', () => {
    renderCreatePage();

    expect(screen.getByLabelText('当前项目')).toBeInTheDocument();
    expect(screen.getByText('Launch Campaign')).toBeInTheDocument();
  });

  it('renders 5 compact pipeline tiles in a two-column workbench grid', () => {
    renderCreatePage();

    expect(screen.getByTestId('pipeline-grid')).toHaveClass('md:grid-cols-2');
    expect(screen.getAllByRole('link').filter((link) => link.querySelector('[data-variant="compact"]'))).toHaveLength(5);
    expect(screen.getByText('快速创作')).toBeInTheDocument();
    expect(screen.getByText('数字人')).toBeInTheDocument();
    expect(screen.getByText('图片转视频')).toBeInTheDocument();
    expect(screen.getByText('动作迁移')).toBeInTheDocument();
    expect(screen.getByText('自定义资产')).toBeInTheDocument();
  });

  it('renders the recent tasks panel', () => {
    renderCreatePage();

    expect(screen.getByRole('heading', { name: '最近任务' })).toBeInTheDocument();
    expect(screen.getByText('task-123')).toBeInTheDocument();
  });
});

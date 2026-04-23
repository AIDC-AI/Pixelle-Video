import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectBar } from './project-bar';
import { AppIntlProvider } from '@/lib/i18n';
import type { components } from '@/types/api';

type Project = components['schemas']['Project'];

const setCurrentProject = vi.fn();

const projects: Project[] = [
  {
    id: 'project-1',
    name: 'Launch Campaign',
    created_at: '2026-04-20T10:00:00Z',
    updated_at: '2026-04-22T10:00:00Z',
    task_count: 4,
  },
  {
    id: 'project-2',
    name: 'Motion Lab',
    created_at: '2026-04-19T10:00:00Z',
    updated_at: '2026-04-21T10:00:00Z',
    task_count: 2,
  },
];

let currentProject: Project | null = projects[0];

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/hooks/use-current-project', () => ({
  useCurrentProjectHydration: () => ({
    currentProjectId: currentProject?.id ?? null,
    currentProject,
    isHydrated: true,
    setCurrentProject,
  }),
}));

vi.mock('@/lib/hooks/use-projects', () => ({
  useProjects: () => ({
    data: {
      items: projects,
    },
  }),
}));

function renderProjectBar() {
  return render(
    <AppIntlProvider>
      <ProjectBar />
    </AppIntlProvider>
  );
}

describe('ProjectBar', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    currentProject = projects[0];
    setCurrentProject.mockClear();
  });

  it('renders the current project name', () => {
    renderProjectBar();

    expect(screen.getByText('当前项目')).toBeInTheDocument();
    expect(screen.getByText('Launch Campaign')).toBeInTheDocument();
  });

  it('renders the no-project empty state', () => {
    currentProject = null;
    renderProjectBar();

    expect(screen.getByText('还没有项目，先创建一个')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '新建项目' })).toHaveAttribute('href', '/projects?create=1');
  });

  it('shows recent projects in the switch dropdown', () => {
    renderProjectBar();

    fireEvent.click(screen.getByRole('button', { name: '切换项目' }));

    expect(screen.getByRole('menuitem', { name: 'Launch Campaign' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Motion Lab' })).toBeInTheDocument();
  });

  it('switches projects and exposes project routes', () => {
    renderProjectBar();

    expect(screen.getByRole('link', { name: '新建项目' })).toHaveAttribute('href', '/projects?create=1');
    expect(screen.getByRole('link', { name: '打开项目列表' })).toHaveAttribute('href', '/projects');

    fireEvent.click(screen.getByRole('button', { name: '切换项目' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Motion Lab' }));

    expect(setCurrentProject).toHaveBeenCalledWith(projects[1]);
  });
});

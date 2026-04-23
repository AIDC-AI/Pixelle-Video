import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { Sidebar } from './sidebar';
import { AppIntlProvider } from '@/lib/i18n';
import { buildProject } from '@/tests/msw/handlers';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className, title }: { children: ReactNode; href: string; className?: string; title?: string }) => (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  ),
}));

const mockCurrentProjectState = {
  currentProjectId: 'project-1',
  currentProject: buildProject('project-1', 'Launch Campaign', { pipeline_hint: 'quick' }),
  isHydrated: true,
};

const mockProjects = [
  buildProject('project-1', 'Launch Campaign', {
    pipeline_hint: 'quick',
    updated_at: '2026-04-22T12:00:00Z',
    preview_url: 'http://localhost:8000/api/files/output/project-1/thumb.jpg',
    preview_kind: 'image',
  }),
  buildProject('project-2', 'Motion Lab', {
    pipeline_hint: 'action-transfer',
    updated_at: '2026-04-21T12:00:00Z',
  }),
];

vi.mock('@/lib/hooks/use-current-project', () => ({
  useCurrentProjectHydration: () => mockCurrentProjectState,
}));

vi.mock('@/lib/hooks/use-projects', () => ({
  useProjects: () => ({
    data: {
      items: mockProjects,
    },
  }),
  useCreateProject: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProject: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

function renderSidebar() {
  return render(
    <AppIntlProvider>
      <Sidebar />
    </AppIntlProvider>
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    localStorage.setItem('sidebar-collapsed', 'false');
    localStorage.removeItem('sidebar-expanded-group');
    vi.mocked(usePathname).mockReturnValue('/');
  });

  it('renders the projects group first and expands it by default', () => {
    const { container } = renderSidebar();

    expect(screen.getByRole('button', { name: '收起项目分组' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '展开创作分组' })).toBeInTheDocument();
    expect(screen.getByText('全部项目')).toBeInTheDocument();
    expect(screen.getByText('最近项目')).toBeInTheDocument();
    expect(screen.getAllByText('Launch Campaign').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '新建项目' })).toHaveAttribute('href', '/projects?create=1');
    expect(container.querySelector('.rounded-2xl')).not.toBeInTheDocument();
  });

  it('separates groups with headings and spacing instead of card borders', () => {
    const { container } = renderSidebar();

    const createGroupButton = screen.getByRole('button', { name: '展开创作分组' });
    const createGroup = createGroupButton.parentElement;

    expect(createGroup?.className).toContain('mt-6');
    expect(createGroup?.className).not.toContain('border');
    expect(createGroup?.className).not.toContain('bg-background');
    expect(createGroupButton).toHaveTextContent('创作');
    expect(container.querySelector('[class*="backdrop-blur-sm"] [class*="rounded-2xl"]')).not.toBeInTheDocument();
  });

  it('highlights the projects overview route when browsing project center', () => {
    vi.mocked(usePathname).mockReturnValue('/projects');
    renderSidebar();

    const activeLink = screen.getByText('全部项目').closest('a');
    expect(activeLink?.className).toContain('bg-primary/10');
  });

  it('keeps stored groups open and shows recent projects plus continue create', () => {
    localStorage.setItem('sidebar-expanded-group', JSON.stringify(['projects', 'library']));
    renderSidebar();

    expect(screen.getByRole('button', { name: '收起项目分组' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起资源库分组' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '继续创作' })).toHaveAttribute('href', '/create/quick');
  });

  it('can collapse the entire sidebar', () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: '收起侧边栏' }));

    expect(screen.queryByText('项目')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '展开侧边栏' })).toBeInTheDocument();
  });
});

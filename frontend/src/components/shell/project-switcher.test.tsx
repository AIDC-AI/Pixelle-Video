import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectSwitcher } from './project-switcher';

vi.mock('@/lib/hooks/use-current-project', () => ({
  useCurrentProjectHydration: vi.fn(() => ({
    currentProject: null,
    currentProjectId: null,
    isHydrated: true,
    setCurrentProject: vi.fn(),
    setCurrentProjectId: vi.fn(),
    clearCurrentProject: vi.fn(),
  })),
}));

vi.mock('@/lib/hooks/use-projects', () => ({
  useProjects: vi.fn(() => ({ data: { items: [] }, isLoading: false })),
  useCreateProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

describe('ProjectSwitcher', () => {
  it('renders select project text when no project is selected', () => {
    render(<ProjectSwitcher isCollapsed={false} />);
    expect(screen.getByTestId('project-switcher-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('project-switcher')).toHaveTextContent('选择项目');
  });

  it('renders trigger button when collapsed', () => {
    render(<ProjectSwitcher isCollapsed={true} />);
    expect(screen.getByTestId('project-switcher-trigger')).toBeInTheDocument();
  });

  it('does not show project name text when collapsed', () => {
    render(<ProjectSwitcher isCollapsed={true} />);
    expect(screen.queryByText('选择项目')).not.toBeInTheDocument();
  });
});

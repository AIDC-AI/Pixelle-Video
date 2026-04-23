import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { axe } from '@/tests/setup-axe';
import { buildProject, setProjects } from '@/tests/msw/handlers';
import { useCurrentProjectStore } from '@/stores/current-project';
import { ProjectSettingsTab } from './project-settings-tab';

const { toastSuccess } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ProjectSettingsTab', () => {
  it('saves project metadata updates', async () => {
    const user = userEvent.setup();
    const project = buildProject('project-1', 'Launch Campaign', {
      cover_url: 'https://example.com/original.png',
    });
    setProjects([project]);

    const { container } = render(<ProjectSettingsTab project={project} />, { wrapper: createWrapper() });

    await user.clear(screen.getByLabelText('项目名称'));
    await user.type(screen.getByLabelText('项目名称'), 'Launch Rebrand');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('项目设置已保存');
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('deletes the project and clears the current project selection', async () => {
    const user = userEvent.setup();
    const project = buildProject('project-1', 'Launch Campaign');
    const onDeleted = vi.fn();
    setProjects([project]);
    useCurrentProjectStore.getState().setCurrentProjectId('project-1');

    render(<ProjectSettingsTab project={project} onDeleted={onDeleted} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1);
    });
    expect(useCurrentProjectStore.getState().currentProjectId).toBeNull();
  });
});

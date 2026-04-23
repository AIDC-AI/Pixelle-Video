import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProjectsPage from './page';
import { AppIntlProvider } from '@/lib/i18n';
import { buildProject, setProjects } from '@/tests/msw/handlers';
import { seedCurrentProject } from '@/tests/pipeline-page-test-utils';
import { useCurrentProjectStore } from '@/stores/current-project';

let mockSearchParams = new URLSearchParams('');
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
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
    return (
      <AppIntlProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AppIntlProvider>
    );
  };
}

function renderPage() {
  return render(<ProjectsPage />, { wrapper: createWrapper() });
}

describe('ProjectsPage', () => {
  beforeEach(async () => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockSearchParams = new URLSearchParams('');
    mockReplace.mockReset();
    vi.stubGlobal('confirm', vi.fn(() => true));

    const now = new Date().toISOString();
    setProjects([
      buildProject('project-1', 'Launch Campaign', {
        created_at: now,
        updated_at: now,
        pipeline_hint: 'quick',
        task_count: 3,
      }),
      buildProject('project-2', 'Motion Lab', {
        created_at: now,
        updated_at: now,
        pipeline_hint: 'action-transfer',
        task_count: 1,
      }),
    ]);

    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders project cards and filters them by search', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('heading', { name: '项目中心' })).toBeInTheDocument();
    expect(await screen.findByText('Launch Campaign')).toBeInTheDocument();
    expect(await screen.findByText('Motion Lab')).toBeInTheDocument();
    expect(screen.getByText('当前项目')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('搜索项目名称、ID 或工作流'), 'Motion');

    await waitFor(() => {
      expect(screen.queryByText('Launch Campaign')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Motion Lab')).toBeInTheDocument();
  });

  it('creates, renames, and deletes projects while syncing currentProjectId', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: '项目中心' });

    await user.click(screen.getByRole('button', { name: '创建' }));
    const createDialog = await screen.findByRole('dialog');
    await user.type(within(createDialog).getByRole('textbox'), 'Fresh Project');
    await user.click(within(createDialog).getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(screen.getByText('Fresh Project')).toBeInTheDocument();
    });
    expect(useCurrentProjectStore.getState().currentProjectId).toMatch(/^project-/);

    await user.click(screen.getAllByRole('button', { name: '编辑' })[0]);
    const renameDialog = await screen.findByRole('dialog');
    const renameInput = within(renameDialog).getByRole('textbox');
    await user.clear(renameInput);
    await user.type(renameInput, 'Launch Rebrand');
    await user.click(within(renameDialog).getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('Launch Rebrand')).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('button', { name: '删除' })[0]);

    await waitFor(() => {
      expect(screen.queryByText('Launch Rebrand')).not.toBeInTheDocument();
    });
    expect(useCurrentProjectStore.getState().currentProjectId).toBeNull();
  });
});

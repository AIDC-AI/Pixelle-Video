import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProjectWorkbenchPage from './page';
import { AppIntlProvider } from '@/lib/i18n';
import { buildProject, setProjects } from '@/tests/msw/handlers';
import { seedCurrentProject } from '@/tests/pipeline-page-test-utils';
import { useCurrentProjectStore } from '@/stores/current-project';

let mockProjectId = 'project-1';
let mockSearchParams = new URLSearchParams('');
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: mockProjectId }),
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
  return render(<ProjectWorkbenchPage />, { wrapper: createWrapper() });
}

describe('ProjectWorkbenchPage', () => {
  beforeEach(async () => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockProjectId = 'project-1';
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

  it('renders the overview with project metadata and recent sections', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Launch Campaign' })).toBeInTheDocument();
    expect(screen.getByText('最近批处理')).toBeInTheDocument();
    expect(screen.getByText('最近任务')).toBeInTheDocument();
    expect(screen.getByText('最近视频')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '继续创作' })).toHaveAttribute('href', '/create/quick');
  });

  it('renders the videos tab when selected through query params', async () => {
    mockSearchParams = new URLSearchParams('tab=videos');

    renderPage();

    const videoLink = await screen.findByRole('link', { name: /Library Video/i });
    expect(videoLink).toHaveAttribute('href', '/library/videos/task-library-video-1');
  });

  it('deletes the current project and redirects back to /projects', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: 'Launch Campaign' });
    await user.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/projects');
    });
    expect(useCurrentProjectStore.getState().currentProjectId).toBeNull();
  });
});

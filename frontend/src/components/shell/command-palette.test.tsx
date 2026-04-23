import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppIntlProvider } from '@/lib/i18n';
import { addRecentCommand } from '@/lib/recent-commands';
import { useCurrentProjectStore } from '@/stores/current-project';
import { CommandPalette } from './command-palette';

const mockPush = vi.fn();
const mockSetTheme = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/create',
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    setTheme: mockSetTheme,
    theme: 'dark',
  }),
}));

vi.mock('@/lib/hooks/use-projects', () => ({
  useProjects: () => ({
    data: {
      items: [
        {
          id: 'project-1',
          name: 'Alpha Project',
          task_count: 2,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
        },
        {
          id: 'project-2',
          name: 'Beta Project',
          task_count: 0,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-03T00:00:00Z',
        },
      ],
    },
  }),
}));

function renderPalette(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <AppIntlProvider>
      <QueryClientProvider client={queryClient}>
        <CommandPalette open onOpenChange={onOpenChange} />
      </QueryClientProvider>
    </AppIntlProvider>
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    document.documentElement.lang = 'zh-CN';
    mockPush.mockReset();
    mockSetTheme.mockReset();
    useCurrentProjectStore.getState().reset();
  });

  it('renders page routes from the sidebar and navigates when selected', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPalette(onOpenChange);

    expect(screen.getByText('创作')).toBeInTheDocument();

    await user.click(screen.getByText('快速创作'));

    expect(mockPush).toHaveBeenCalledWith('/create/quick');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('switches to command mode with > and runs shell commands', async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.type(screen.getByPlaceholderText('搜索页面，输入 > 执行命令，@ 切换项目...'), '>');
    await user.click(screen.getByText('切换到浅色主题'));

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('switches to project mode with @ and updates the current project', async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.type(screen.getByPlaceholderText('搜索页面，输入 > 执行命令，@ 切换项目...'), '@');
    await user.click(screen.getByText('Alpha Project'));

    expect(useCurrentProjectStore.getState().currentProjectId).toBe('project-1');
  });

  it('shows recent commands scoped to the current project', async () => {
    const user = userEvent.setup();
    useCurrentProjectStore.getState().setCurrentProjectId('project-1');
    addRecentCommand('project-1', {
      label: 'Stored Create',
      timestamp: 200,
      type: 'page',
      value: '/create',
    });
    addRecentCommand('project-2', {
      label: 'Hidden Batch',
      timestamp: 300,
      type: 'page',
      value: '/batch',
    });
    renderPalette();

    expect(screen.getByText('Stored Create')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Batch')).not.toBeInTheDocument();

    await user.click(screen.getByText('Stored Create'));

    expect(mockPush).toHaveBeenCalledWith('/create');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Topbar } from './topbar';
import { useCurrentProjectStore } from '@/stores/current-project';
import { useTheme } from 'next-themes';
import { useProjects, useCreateProject } from '@/lib/hooks/use-projects';
import { toast } from 'sonner';
import type { components } from '@/types/api';

vi.mock('@/stores/current-project');
vi.mock('next-themes');
vi.mock('@/lib/hooks/use-projects');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
    }
  }

  Object.defineProperty(window, 'PointerEvent', {
    value: PointerEventPolyfill,
    configurable: true,
    writable: true,
  });
}

type PersistApi = typeof useCurrentProjectStore.persist;
type ThemeValue = ReturnType<typeof useTheme>;
type ProjectsQuery = ReturnType<typeof useProjects>;
type CreateProjectMutation = ReturnType<typeof useCreateProject>;
type CreateProjectOptions = Parameters<CreateProjectMutation['mutate']>[1];
type CreateProjectMutateOptions = NonNullable<CreateProjectOptions>;
type CreateProjectSuccess = NonNullable<CreateProjectMutateOptions['onSuccess']>;
type CreateProjectError = NonNullable<CreateProjectMutateOptions['onError']>;
type CreateProjectSuccessArgs = Parameters<CreateProjectSuccess>;
type CreateProjectErrorArgs = Parameters<CreateProjectError>;
type Project = components['schemas']['Project'];

interface MockCurrentProjectStore {
  currentProject: { id: string; name: string } | null;
  setCurrentProject: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
}

function setPersistApi(persistApi: PersistApi): void {
  Object.defineProperty(useCurrentProjectStore, 'persist', {
    value: persistApi,
    configurable: true,
    writable: true,
  });
}

describe('Topbar', () => {
  let queryClient: QueryClient;
  let mockMutate: ReturnType<typeof vi.fn>;
  let baseStore: MockCurrentProjectStore;

  beforeEach(() => {
    queryClient = new QueryClient();
    mockMutate = vi.fn();

    const persistApi = {
      rehydrate: vi.fn(),
      hasHydrated: vi.fn().mockReturnValue(true),
      onFinishHydration: vi.fn().mockReturnValue(vi.fn()),
      clearStorage: vi.fn(),
      setOptions: vi.fn(),
      getOptions: vi.fn(),
    } as unknown as PersistApi;

    baseStore = {
      currentProject: { id: '1', name: 'My Project' },
      setCurrentProject: vi.fn(),
      reset: vi.fn(),
    };

    vi.mocked(useCurrentProjectStore).mockReturnValue(
      baseStore as unknown as ReturnType<typeof useCurrentProjectStore>
    );
    setPersistApi(persistApi);

    vi.mocked(useTheme).mockReturnValue({
      theme: 'dark',
      themes: ['light', 'dark'],
      resolvedTheme: 'dark',
      systemTheme: 'dark',
      forcedTheme: undefined,
      setTheme: vi.fn(),
    } as unknown as ThemeValue);

    vi.mocked(useProjects).mockReturnValue({
      data: { items: [{ id: '1', name: 'My Project' }, { id: '2', name: 'Another' }] },
    } as unknown as ProjectsQuery);

    vi.mocked(useCreateProject).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as CreateProjectMutation);
  });

  it('renders project switcher and toggles theme', async () => {
    const user = userEvent.setup();
    const theme = useTheme();

    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );

    expect(screen.getByText('My Project')).toBeInTheDocument();

    const themeBtn = screen.getByRole('button', { name: /Toggle theme/i });
    await user.click(themeBtn);
    expect(theme.setTheme).toHaveBeenCalledWith('light');
  });

  it('handles project creation success', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: /My Project/i }));
    await user.click(await screen.findByText('New Project'));
    await user.type(await screen.findByPlaceholderText('Project Name'), 'New Test Project');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0]?.[0]).toEqual({ name: 'New Test Project' });
    expect(mockMutate.mock.calls[0]?.[1]).toBeDefined();

    const options = mockMutate.mock.calls[0]?.[1] as CreateProjectOptions;
    const newProject: Project = {
      id: '99',
      name: 'New Test Project',
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
      cover_url: null,
      pipeline_hint: null,
      task_count: 0,
      last_task_id: null,
      deleted_at: null,
    };
    const successArgs = [
      newProject,
      { name: 'New Test Project' },
      undefined,
      {} as CreateProjectSuccessArgs[3],
    ] satisfies CreateProjectSuccessArgs;
    const onSuccess = options?.onSuccess as CreateProjectSuccess | undefined;
    onSuccess?.(successArgs[0], successArgs[1], successArgs[2], successArgs[3]);

    expect(baseStore.setCurrentProject).toHaveBeenCalledWith({ id: '99', name: 'New Test Project' });
    expect(toast.success).toHaveBeenCalledWith('Project created successfully');
  });

  it('renders skeleton initially and hydrates', () => {
    const persistApi = {
      rehydrate: vi.fn(),
      hasHydrated: vi.fn().mockReturnValue(false),
      onFinishHydration: vi.fn().mockReturnValue(vi.fn()),
      clearStorage: vi.fn(),
      setOptions: vi.fn(),
      getOptions: vi.fn(),
    } as unknown as PersistApi;

    vi.mocked(useCurrentProjectStore).mockReturnValue(
      {
        currentProject: null,
        setCurrentProject: vi.fn(),
        reset: vi.fn(),
      } as unknown as ReturnType<typeof useCurrentProjectStore>
    );
    setPersistApi(persistApi);

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('can cancel dialog', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: /My Project/i }));
    await user.click(await screen.findByText('New Project'));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Project Name')).not.toBeInTheDocument();
    });
  });

  it('handles empty input when creating project', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: /My Project/i }));
    await user.click(await screen.findByText('New Project'));
    await user.click(await screen.findByRole('button', { name: 'Create' }));

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('handles project creation error', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: /My Project/i }));
    await user.click(await screen.findByText('New Project'));
    await user.type(await screen.findByPlaceholderText('Project Name'), 'Error Project');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0]?.[0]).toEqual({ name: 'Error Project' });
    expect(mockMutate.mock.calls[0]?.[1]).toBeDefined();

    const options = mockMutate.mock.calls[0]?.[1] as CreateProjectOptions;
    const errorArgs = [
      new Error('API failed'),
      { name: 'Error Project' },
      undefined,
      {} as CreateProjectErrorArgs[3],
    ] satisfies CreateProjectErrorArgs;
    const onError = options?.onError as CreateProjectError | undefined;
    onError?.(errorArgs[0], errorArgs[1], errorArgs[2], errorArgs[3]);

    expect(baseStore.setCurrentProject).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('API failed');
  });

  it('can select another project', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: /My Project/i }));
    await user.click(await screen.findByText('Another'));

    expect(baseStore.setCurrentProject).toHaveBeenCalledWith({ id: '2', name: 'Another' });
  });

  it('renders correctly with no project', () => {
    vi.mocked(useCurrentProjectStore).mockReturnValue(
      {
        currentProject: null,
        setCurrentProject: vi.fn(),
        reset: vi.fn(),
      } as unknown as ReturnType<typeof useCurrentProjectStore>
    );

    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );

    expect(screen.getByText('Select Project')).toBeInTheDocument();
  });
});

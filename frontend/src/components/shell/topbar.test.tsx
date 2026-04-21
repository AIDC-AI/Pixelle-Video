/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Topbar } from './topbar';
import { useCurrentProjectStore } from '@/stores/current-project';
import { useTheme } from 'next-themes';
import { useProjects, useCreateProject } from '@/lib/hooks/use-projects';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';

vi.mock('@/stores/current-project');
vi.mock('next-themes');
vi.mock('@/lib/hooks/use-projects');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Polyfill PointerEvent for Radix UI
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, params: any = {}) {
      super(type, params);
      this.pointerId = params.pointerId || 1;
      this.pointerType = params.pointerType || 'mouse';
      this.isPrimary = params.isPrimary !== false;
    }
  }
  (window as any).PointerEvent = PointerEvent as any;
}

describe('Topbar', () => {
  let queryClient: QueryClient;
  let mockMutate: any;

  beforeEach(() => {
    queryClient = new QueryClient();
    const mockStore: any = {
      currentProject: { id: '1', name: 'My Project' },
      setCurrentProject: vi.fn(),
      reset: vi.fn(),
    };
    mockStore.persist = {
      rehydrate: vi.fn(),
      hasHydrated: vi.fn().mockReturnValue(true),
      onFinishHydration: vi.fn().mockReturnValue(vi.fn()),
    };
    
    vi.mocked(useCurrentProjectStore).mockReturnValue(mockStore);
    (useCurrentProjectStore as any).persist = mockStore.persist;

    vi.mocked(useTheme).mockReturnValue({
      theme: 'dark',
      setTheme: vi.fn(),
    } as any);

    vi.mocked(useProjects).mockReturnValue({
      data: { items: [{ id: '1', name: 'My Project' }, { id: '2', name: 'Another' }] },
    } as any);

    mockMutate = vi.fn();
    vi.mocked(useCreateProject).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
  });

  it('renders project switcher and toggles theme', async () => {
    const user = userEvent.setup();
    const { setTheme } = useTheme();
    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );

    expect(screen.getByText('My Project')).toBeInTheDocument();
    
    const themeBtn = screen.getByRole('button', { name: /Toggle theme/i });
    await user.click(themeBtn);
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('handles project creation success', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );
    
    const trigger = screen.getByRole('button', { name: /My Project/i });
    await user.click(trigger);
    
    const newProjectBtn = await screen.findByText('New Project');
    await user.click(newProjectBtn);
    
    const input = await screen.findByPlaceholderText('Project Name');
    await user.type(input, 'New Test Project');
    
    const createBtn = screen.getByRole('button', { name: 'Create' });
    await user.click(createBtn);
    
    expect(mockMutate).toHaveBeenCalledWith(
      { name: 'New Test Project' },
      expect.any(Object)
    );
    
    const { onSuccess } = mockMutate.mock.calls[0][1];
    onSuccess({ id: '99', name: 'New Test Project' });
    
    expect(useCurrentProjectStore().setCurrentProject).toHaveBeenCalledWith({ id: '99', name: 'New Test Project' });
    expect(toast.success).toHaveBeenCalledWith('Project created successfully');
  });

  it('renders skeleton initially and hydrates', () => {
    const mockStoreEmpty: any = {
      currentProject: null,
      setCurrentProject: vi.fn(),
      reset: vi.fn(),
    };
    mockStoreEmpty.persist = {
      rehydrate: vi.fn(),
      hasHydrated: vi.fn().mockReturnValue(false),
      onFinishHydration: vi.fn().mockReturnValue(vi.fn()),
    };
    vi.mocked(useCurrentProjectStore).mockReturnValue(mockStoreEmpty);
    (useCurrentProjectStore as any).persist = mockStoreEmpty.persist;

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
    
    const trigger = screen.getByRole('button', { name: /My Project/i });
    await user.click(trigger);
    
    const newProjectBtn = await screen.findByText('New Project');
    await user.click(newProjectBtn);
    
    const createBtn = await screen.findByRole('button', { name: 'Create' });
    await user.click(createBtn);
    
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('handles project creation error', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );
    
    const trigger = screen.getByRole('button', { name: /My Project/i });
    await user.click(trigger);
    
    const newProjectBtn = await screen.findByText('New Project');
    await user.click(newProjectBtn);
    
    const input = await screen.findByPlaceholderText('Project Name');
    await user.type(input, 'Error Project');
    
    const createBtn = screen.getByRole('button', { name: 'Create' });
    await user.click(createBtn);
    
    expect(mockMutate).toHaveBeenCalledWith(
      { name: 'Error Project' },
      expect.any(Object)
    );
    
    const { onError } = mockMutate.mock.calls[0][1];
    onError({ message: 'API failed' });
    
    expect(useCurrentProjectStore().setCurrentProject).not.toHaveBeenCalledWith({ id: expect.any(String), name: 'Error Project' });
    expect(toast.error).toHaveBeenCalledWith('API failed');
  });

  it('can select another project', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );
    
    const trigger = screen.getByRole('button', { name: /My Project/i });
    await user.click(trigger);
    
    const another = await screen.findByText('Another');
    await user.click(another);
    expect(useCurrentProjectStore().setCurrentProject).toHaveBeenCalledWith({ id: '2', name: 'Another' });
  });

  it('renders correctly with no project', () => {
    vi.mocked(useCurrentProjectStore).mockReturnValue({
      currentProject: null,
      setCurrentProject: vi.fn(),
      reset: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );
    expect(screen.getByText('Select Project')).toBeInTheDocument();
  });
});

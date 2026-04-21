/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Topbar } from './topbar';
import { useCurrentProjectStore } from '@/stores/current-project';
import { useTheme } from 'next-themes';
import { useProjects, useCreateProject } from '@/lib/hooks/use-projects';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/stores/current-project');
vi.mock('next-themes');
vi.mock('@/lib/hooks/use-projects');

describe('Topbar', () => {
  let queryClient: QueryClient;
  let mockMutate: any;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.mocked(useCurrentProjectStore).mockReturnValue({
      currentProject: { id: '1', name: 'My Project' },
      setCurrentProject: vi.fn(),
      reset: vi.fn(),
    } as any);

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

  it('renders project switcher and toggles theme', () => {
    const { setTheme } = useTheme();
    render(
      <QueryClientProvider client={queryClient}>
        <Topbar />
      </QueryClientProvider>
    );

    expect(screen.getByText('My Project')).toBeInTheDocument();
    
    const themeBtn = screen.getByRole('button', { name: /Toggle theme/i });
    fireEvent.click(themeBtn);
    expect(setTheme).toHaveBeenCalledWith('light');
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

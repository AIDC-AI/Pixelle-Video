import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { usePipelineTask } from './use-pipeline-task';
import type { components } from '@/types/api';

const mockUseTaskPolling = vi.fn();
const mockCancelMutateAsync = vi.fn();

vi.mock('@/lib/hooks/use-create-video', () => ({
  useCancelTask: () => ({ mutateAsync: mockCancelMutateAsync }),
  useTaskPolling: (taskId: string | undefined, enabled: boolean) => mockUseTaskPolling(taskId, enabled),
}));

const mockCurrentProjectState: {
  currentProject: { id: string; name: string } | null;
  currentProjectId: string | null;
  isHydrated: boolean;
} = {
  currentProject: { id: 'project-1', name: 'Test Project' },
  currentProjectId: 'project-1',
  isHydrated: true,
};

vi.mock('@/lib/hooks/use-current-project', () => ({
  useCurrentProjectHydration: () => mockCurrentProjectState,
}));

type Task = components['schemas']['Task'];

function buildTask(status: components['schemas']['TaskStatus'], overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-1',
    task_type: 'video_generation',
    project_id: 'project-1',
    status,
    progress: {
      current: 25,
      total: 100,
      percentage: 25,
      message: 'Working',
    },
    result: null,
    error: null,
    created_at: '2026-04-22T00:00:00Z',
    started_at: '2026-04-22T00:00:00Z',
    completed_at: null,
    request_params: null,
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('usePipelineTask', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseTaskPolling.mockReturnValue({ data: undefined });
    mockCancelMutateAsync.mockReset();
    mockCurrentProjectState.currentProject = { id: 'project-1', name: 'Test Project' };
    mockCurrentProjectState.currentProjectId = 'project-1';
    mockCurrentProjectState.isHydrated = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks submit and opens the project dialog when no project is selected', async () => {
    mockCurrentProjectState.currentProject = null;
    mockCurrentProjectState.currentProjectId = null;
    const mutateAsync = vi.fn<(request: { prompt: string }) => Promise<{ task_id: string }>>();

    const { result } = renderHook(
      () =>
        usePipelineTask({
          isPending: false,
          mutateAsync,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      expect(await result.current.submit({ prompt: 'No project yet' })).toBe(false);
    });

    expect(result.current.showProjectDialog).toBe(true);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('submits successfully and exposes pending task state before polling resolves', async () => {
    const mutateAsync = vi.fn(async () => ({ task_id: 'task-success' }));

    const { result } = renderHook(
      () =>
        usePipelineTask({
          isPending: false,
          mutateAsync,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      expect(await result.current.submit({ prompt: 'Generate this' })).toBe(true);
    });

    expect(mutateAsync).toHaveBeenCalledWith({ prompt: 'Generate this' });
    expect(result.current.taskId).toBe('task-success');
    expect(result.current.viewState).toBe('pending');
    expect(result.current.progress).toBe(0);
  });

  it('maps remote completed task data into result panel state', async () => {
    const mutateAsync = vi.fn(async () => ({ task_id: 'task-completed' }));
    const taskDataRef: { current: Task | undefined } = { current: undefined };

    mockUseTaskPolling.mockImplementation(() => ({ data: taskDataRef.current }));

    const { result, rerender } = renderHook(
      () =>
        usePipelineTask({
          isPending: false,
          mutateAsync,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.submit({ prompt: 'Generate this' });
    });

    taskDataRef.current = buildTask('completed', {
      progress: {
        current: 100,
        total: 100,
        percentage: 100,
        message: 'Completed',
      },
      result: {
        video_url: 'http://localhost:8000/api/files/output/video.mp4',
        duration: 12.5,
        file_size: 1024,
      },
    });
    rerender();

    expect(result.current.viewState).toBe('completed');
    expect(result.current.progress).toBe(100);
    expect(result.current.currentStep).toBe('Completed');
    expect(result.current.taskResult?.video_url).toContain('video.mp4');
  });

  it('handles submit and cancel errors without leaving the hook in a running state', async () => {
    const mutateAsync = vi.fn(async () => {
      throw { message: 'Submit failed' };
    });
    mockCancelMutateAsync.mockRejectedValueOnce({ message: 'Cancel failed' });

    const { result } = renderHook(
      () =>
        usePipelineTask({
          isPending: false,
          mutateAsync,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      expect(await result.current.submit({ prompt: 'Generate this' })).toBe(false);
    });

    expect(result.current.viewState).toBe('failed');
    expect(result.current.statusMessage).toBe('Submit failed');

    const successMutation = vi.fn(async () => ({ task_id: 'task-cancel' }));
    const { result: cancelResult } = renderHook(
      () =>
        usePipelineTask({
          isPending: false,
          mutateAsync: successMutation,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await cancelResult.current.submit({ prompt: 'Cancelable task' });
    });

    await act(async () => {
      await cancelResult.current.cancel();
    });

    expect(cancelResult.current.viewState).toBe('failed');
    expect(cancelResult.current.statusMessage).toBe('Cancel failed');
  });

  it('surfaces hydration state from the current-project hook', () => {
    const mutateAsync = vi.fn(async () => ({ task_id: 'task-hydrate' }));
    mockCurrentProjectState.isHydrated = false;

    const { result } = renderHook(
      () =>
        usePipelineTask({
          isPending: false,
          mutateAsync,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isHydrated).toBe(false);
  });

  it('resets local task state after a cancelled task', async () => {
    const mutateAsync = vi.fn(async () => ({ task_id: 'task-reset' }));
    const { result } = renderHook(
      () =>
        usePipelineTask({
          isPending: false,
          mutateAsync,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.submit({ prompt: 'Resettable task' });
    });

    await act(async () => {
      await result.current.cancel();
    });

    expect(result.current.viewState).toBe('cancelled');

    act(() => {
      result.current.reset();
    });

    expect(result.current.viewState).toBe('idle');
    expect(result.current.taskId).toBeUndefined();
    expect(result.current.statusMessage).toBe('');
  });

  it('resumes polling from an initial task id', async () => {
    vi.useFakeTimers();
    mockUseTaskPolling.mockReturnValue({ data: buildTask('running') });

    const { result } = renderHook(
      () =>
        usePipelineTask(
          {
            isPending: false,
            mutateAsync: vi.fn(async () => ({ task_id: 'task-ignored' })),
          },
          { initialTaskId: 'task-resume' }
        ),
      { wrapper: createWrapper() }
    );

    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(result.current.taskId).toBe('task-resume');
    expect(result.current.viewState).toBe('running');
  });

  it('keeps the local cancelled state even when the remote task data is still running', async () => {
    const runningTask = buildTask('running');
    mockUseTaskPolling.mockReturnValue({ data: runningTask });
    const mutateAsync = vi.fn(async () => ({ task_id: 'task-running' }));

    const { result } = renderHook(
      () =>
        usePipelineTask({
          isPending: false,
          mutateAsync,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.submit({ prompt: 'Cancelable task' });
    });

    await act(async () => {
      await result.current.cancel();
    });

    expect(result.current.viewState).toBe('cancelled');
    expect(result.current.statusMessage).toBe('Task cancelled');
  });
});

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePipelineTask } from './use-pipeline-task';
import { seedCurrentProject } from '@/tests/pipeline-page-test-utils';
import { useCurrentProjectStore } from '@/stores/current-project';
import type { components } from '@/types/api';

const mockUseTaskPolling = vi.fn();
const mockCancelMutateAsync = vi.fn();

vi.mock('@/lib/hooks/use-create-video', () => ({
  useCancelTask: () => ({ mutateAsync: mockCancelMutateAsync }),
  useTaskPolling: (taskId: string | undefined, enabled: boolean) => mockUseTaskPolling(taskId, enabled),
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

describe('usePipelineTask', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    mockUseTaskPolling.mockReturnValue({ data: undefined });
    mockCancelMutateAsync.mockReset();
    await seedCurrentProject({ id: 'project-1', name: 'Test Project' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks submit and opens the project dialog when no project is selected', async () => {
    await seedCurrentProject(null);
    const mutateAsync = vi.fn<(request: { prompt: string }) => Promise<{ task_id: string }>>();

    const { result } = renderHook(() =>
      usePipelineTask({
        isPending: false,
        mutateAsync,
      })
    );

    await act(async () => {
      expect(await result.current.submit({ prompt: 'No project yet' })).toBe(false);
    });

    expect(result.current.showProjectDialog).toBe(true);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('submits successfully and exposes pending task state before polling resolves', async () => {
    const mutateAsync = vi.fn(async () => ({ task_id: 'task-success' }));

    const { result } = renderHook(() =>
      usePipelineTask({
        isPending: false,
        mutateAsync,
      })
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

    const { result, rerender } = renderHook(() =>
      usePipelineTask({
        isPending: false,
        mutateAsync,
      })
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

    const { result } = renderHook(() =>
      usePipelineTask({
        isPending: false,
        mutateAsync,
      })
    );

    await act(async () => {
      expect(await result.current.submit({ prompt: 'Generate this' })).toBe(false);
    });

    expect(result.current.viewState).toBe('failed');
    expect(result.current.statusMessage).toBe('Submit failed');

    const successMutation = vi.fn(async () => ({ task_id: 'task-cancel' }));
    const { result: cancelResult } = renderHook(() =>
      usePipelineTask({
        isPending: false,
        mutateAsync: successMutation,
      })
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

  it('rehydrates the persisted project store when hydration has not completed yet', async () => {
    const mutateAsync = vi.fn(async () => ({ task_id: 'task-hydrate' }));
    const hasHydratedSpy = vi.spyOn(useCurrentProjectStore.persist, 'hasHydrated').mockReturnValue(false);
    const rehydrateSpy = vi.spyOn(useCurrentProjectStore.persist, 'rehydrate').mockResolvedValue(undefined);

    renderHook(() =>
      usePipelineTask({
        isPending: false,
        mutateAsync,
      })
    );

    await waitFor(() => {
      expect(rehydrateSpy).toHaveBeenCalled();
    });

    hasHydratedSpy.mockRestore();
    rehydrateSpy.mockRestore();
  });

  it('resets local task state after a cancelled task', async () => {
    const mutateAsync = vi.fn(async () => ({ task_id: 'task-reset' }));
    const { result } = renderHook(() =>
      usePipelineTask({
        isPending: false,
        mutateAsync,
      })
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

    const { result } = renderHook(() =>
      usePipelineTask(
        {
          isPending: false,
          mutateAsync: vi.fn(async () => ({ task_id: 'task-ignored' })),
        },
        { initialTaskId: 'task-resume' }
      )
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

    const { result } = renderHook(() =>
      usePipelineTask({
        isPending: false,
        mutateAsync,
      })
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

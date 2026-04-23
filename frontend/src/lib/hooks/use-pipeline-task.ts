'use client';

import { useEffect, useState } from 'react';

import { useCancelTask, useTaskPolling } from '@/lib/hooks/use-create-video';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useCurrentProjectStore } from '@/stores/current-project';
import type { components } from '@/types/api';

type Task = components['schemas']['Task'];
type TaskStatus = components['schemas']['TaskStatus'];

type PipelineViewState = 'idle' | TaskStatus;

type VideoTaskResult = {
  video_url: string;
  video_path?: string;
  duration?: number;
  file_size?: number;
};

type SubmitResponse = {
  task_id: string;
};

interface PipelineSubmitMutation<TRequest, TResponse extends SubmitResponse> {
  isPending: boolean;
  mutateAsync: (request: TRequest) => Promise<TResponse>;
}

interface UsePipelineTaskOptions {
  initialTaskId?: string | null;
}

interface PipelineTaskResult<TRequest> {
  activeTaskStatus: Extract<TaskStatus, 'pending' | 'running' | 'completed' | 'failed'>;
  cancel: () => Promise<void>;
  currentProject: ReturnType<typeof useCurrentProjectHydration>['currentProject'];
  currentStep: string;
  isHydrated: boolean;
  isSubmitting: boolean;
  progress: number;
  reset: () => void;
  showProjectDialog: boolean;
  setShowProjectDialog: (open: boolean) => void;
  statusMessage: string;
  submit: (request: TRequest) => Promise<boolean>;
  task: Task | undefined;
  taskId: string | undefined;
  taskResult: VideoTaskResult | undefined;
  viewState: PipelineViewState;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return 'Request failed. Please try again.';
}

function isVideoTaskResult(result: Task['result']): result is VideoTaskResult {
  if (!result || typeof result !== 'object') {
    return false;
  }

  const candidate = result as Record<string, unknown>;
  return typeof candidate.video_url === 'string';
}

export function usePipelineTask<TRequest, TResponse extends SubmitResponse>(
  submitMutation: PipelineSubmitMutation<TRequest, TResponse>,
  options: UsePipelineTaskOptions = {}
): PipelineTaskResult<TRequest> {
  const [taskId, setTaskId] = useState<string>();
  const [localState, setLocalState] = useState<'idle' | 'failed' | 'cancelled'>('idle');
  const [localMessage, setLocalMessage] = useState('');
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [isPollingEnabled, setIsPollingEnabled] = useState(false);
  const [consumedInitialTaskId, setConsumedInitialTaskId] = useState<string | null>(null);

  const { currentProject, isHydrated } = useCurrentProjectHydration();
  const cancelTask = useCancelTask();
  const polling = useTaskPolling(taskId, isPollingEnabled && localState === 'idle');
  const task = polling.data;
  const taskResult = isVideoTaskResult(task?.result) ? task.result : undefined;

  const remoteState = task?.status;
  const viewState: PipelineViewState = (() => {
    if (localState !== 'idle') {
      return localState;
    }

    if (remoteState) {
      return remoteState;
    }

    if (taskId) {
      return 'pending';
    }

    return 'idle';
  })();

  const statusMessage =
    localState === 'failed'
      ? localMessage
      : localState === 'cancelled'
        ? localMessage
        : remoteState === 'failed'
          ? task?.error ?? 'Generation failed'
          : remoteState === 'cancelled'
            ? 'Task cancelled'
            : task?.progress?.message ?? '';

  useEffect(() => {
    if (!options.initialTaskId) {
      return;
    }

    if (consumedInitialTaskId === options.initialTaskId || taskId === options.initialTaskId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setTaskId(options.initialTaskId ?? undefined);
      setLocalState('idle');
      setLocalMessage('');
      setIsPollingEnabled(true);
      setConsumedInitialTaskId(options.initialTaskId ?? null);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [consumedInitialTaskId, options.initialTaskId, taskId]);

  const submit = async (request: TRequest): Promise<boolean> => {
    if (!currentProject) {
      setShowProjectDialog(true);
      return false;
    }

    setLocalState('idle');
    setLocalMessage('');
    setTaskId(undefined);
    setIsPollingEnabled(true);

    try {
      const response = await submitMutation.mutateAsync(request);
      setTaskId(response.task_id);
      return true;
    } catch (error: unknown) {
      setLocalState('failed');
      setLocalMessage(getErrorMessage(error));
      setIsPollingEnabled(false);
      return false;
    }
  };

  const cancel = async (): Promise<void> => {
    if (!taskId) {
      return;
    }

    setLocalState('cancelled');
    setLocalMessage('Task cancelled');
    setIsPollingEnabled(false);

    try {
      await cancelTask.mutateAsync(taskId);
    } catch (error: unknown) {
      setLocalState('failed');
      setLocalMessage(getErrorMessage(error));
    }
  };

  const reset = () => {
    setTaskId(undefined);
    setLocalState('idle');
    setLocalMessage('');
    setIsPollingEnabled(false);
  };

  return {
    activeTaskStatus:
      viewState === 'pending' || viewState === 'running' || viewState === 'completed' || viewState === 'failed'
        ? viewState
        : 'pending',
    cancel,
    currentProject,
    currentStep: task?.progress?.message ?? '',
    isHydrated,
    isSubmitting: submitMutation.isPending,
    progress: task?.progress?.percentage ?? 0,
    reset,
    showProjectDialog,
    setShowProjectDialog,
    statusMessage,
    submit,
    task,
    taskId,
    taskResult,
    viewState,
  };
}

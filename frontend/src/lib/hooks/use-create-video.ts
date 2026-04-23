import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ApiError } from '../api-client';
import { useCurrentProjectStore } from '@/stores/current-project';
import type { components, paths } from '@/types/api';

type AsyncVideoPath =
  | '/api/video/generate/async'
  | '/api/video/digital-human/async'
  | '/api/video/i2v/async'
  | '/api/video/action-transfer/async'
  | '/api/video/custom/async';

type AsyncVideoRequest<Path extends AsyncVideoPath> =
  Omit<paths[Path]['post']['requestBody']['content']['application/json'], 'project_id'>;
type AsyncVideoResponse<Path extends AsyncVideoPath> =
  paths[Path]['post']['responses'][200]['content']['application/json'];

type VideoGenerateRequest =
  paths['/api/video/generate/async']['post']['requestBody']['content']['application/json'];
type Task = paths['/api/tasks/{task_id}']['get']['responses'][200]['content']['application/json'];
type CancelTaskResponse =
  paths['/api/tasks/{task_id}']['delete']['responses'][200]['content']['application/json'];
type TaskStatus = components['schemas']['TaskStatus'];
export type QuickSubmitRequest = Omit<VideoGenerateRequest, 'project_id'>;
type MediaPreviewRequest =
  paths['/api/media/generate']['post']['requestBody']['content']['application/json'];
type MediaPreviewResponse =
  paths['/api/media/generate']['post']['responses'][200]['content']['application/json'];
type TtsPreviewRequest =
  paths['/api/tts/synthesize']['post']['requestBody']['content']['application/json'];
type TtsPreviewResponse =
  paths['/api/tts/synthesize']['post']['responses'][200]['content']['application/json'];

const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ['completed', 'failed', 'cancelled'];
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const MAX_ERROR_POLL_INTERVAL_MS = 10_000;

function getBasePollIntervalMs(): number {
  const rawValue = process.env.NEXT_PUBLIC_TASK_POLL_INTERVAL_MS;
  const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_POLL_INTERVAL_MS;
}

function useSubmitAsyncVideo<Path extends AsyncVideoPath>(endpoint: Path) {
  const currentProjectId = useCurrentProjectStore((state) => state.currentProjectId);

  return useMutation<AsyncVideoResponse<Path>, ApiError, AsyncVideoRequest<Path>>({
    mutationFn: async (data) => {
      if (!currentProjectId) {
        throw new Error('Project ID is required');
      }
      return apiClient<AsyncVideoResponse<Path>>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ ...data, project_id: currentProjectId }),
      });
    },
  });
}

export function useSubmitQuick() {
  return useSubmitAsyncVideo('/api/video/generate/async');
}

export function useSubmitDigitalHuman() {
  return useSubmitAsyncVideo('/api/video/digital-human/async');
}

export function useSubmitI2V() {
  return useSubmitAsyncVideo('/api/video/i2v/async');
}

export function useSubmitActionTransfer() {
  return useSubmitAsyncVideo('/api/video/action-transfer/async');
}

export function useSubmitCustom() {
  return useSubmitAsyncVideo('/api/video/custom/async');
}

export function useTaskPolling(taskId: string | undefined, isEnabled = true) {
  const queryClient = useQueryClient();

  return useQuery<Task, ApiError>({
    queryKey: ['task', taskId],
    queryFn: () => apiClient<Task>(`/api/tasks/${taskId ?? ''}`),
    enabled: Boolean(taskId) && isEnabled,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_TASK_STATUSES.includes(status)) {
        if (status === 'completed') {
          queryClient.invalidateQueries({ queryKey: ['library', 'videos'] });
        }
        return false;
      }
      if (query.state.error) {
        const attempts = Math.max(query.state.fetchFailureCount, 1);
        return Math.min(getBasePollIntervalMs() * 2 ** attempts, MAX_ERROR_POLL_INTERVAL_MS);
      }
      return getBasePollIntervalMs();
    },
  });
}

export function useCancelTask() {
  return useMutation<CancelTaskResponse, ApiError, string>({
    mutationFn: (taskId) => apiClient<CancelTaskResponse>(`/api/tasks/${taskId}`, { method: 'DELETE' }),
  });
}

export function usePreviewMedia() {
  return useMutation<MediaPreviewResponse, ApiError, MediaPreviewRequest>({
    mutationFn: (payload) =>
      apiClient<MediaPreviewResponse>('/api/media/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

export function usePreviewTts() {
  return useMutation<TtsPreviewResponse, ApiError, TtsPreviewRequest>({
    mutationFn: (payload) =>
      apiClient<TtsPreviewResponse>('/api/tts/synthesize', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

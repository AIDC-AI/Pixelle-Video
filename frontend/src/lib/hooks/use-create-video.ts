import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ApiError } from '../api-client';
import { useCurrentProjectStore } from '@/stores/current-project';
import type { components, paths } from '@/types/api';

type VideoGenerateRequest =
  paths['/api/video/generate/async']['post']['requestBody']['content']['application/json'];
type VideoGenerateAsyncResponse =
  paths['/api/video/generate/async']['post']['responses'][200]['content']['application/json'];
type Task = paths['/api/tasks/{task_id}']['get']['responses'][200]['content']['application/json'];
type CancelTaskResponse =
  paths['/api/tasks/{task_id}']['delete']['responses'][200]['content']['application/json'];
type TaskStatus = components['schemas']['TaskStatus'];
export type QuickSubmitRequest = Omit<VideoGenerateRequest, 'project_id'>;

const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ['completed', 'failed', 'cancelled'];
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const MAX_ERROR_POLL_INTERVAL_MS = 10_000;

function getBasePollIntervalMs(): number {
  const rawValue = process.env.NEXT_PUBLIC_TASK_POLL_INTERVAL_MS;
  const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_POLL_INTERVAL_MS;
}

export function useSubmitQuick() {
  const currentProject = useCurrentProjectStore((state) => state.currentProject);

  return useMutation<VideoGenerateAsyncResponse, ApiError, QuickSubmitRequest>({
    mutationFn: async (data) => {
      if (!currentProject?.id) {
        throw new Error('Project ID is required');
      }
      return apiClient<VideoGenerateAsyncResponse>('/api/video/generate/async', {
        method: 'POST',
        body: JSON.stringify({ ...data, project_id: currentProject.id }),
      });
    },
  });
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

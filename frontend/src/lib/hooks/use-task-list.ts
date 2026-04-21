'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient, type ApiError } from '@/lib/api-client';
import { toProjectFilterQuery } from '@/lib/pipeline-utils';
import type { components, paths } from '@/types/api';

type Task = paths['/api/tasks/{task_id}']['get']['responses'][200]['content']['application/json'];
type TaskListResponse = paths['/api/tasks']['get']['responses'][200]['content']['application/json'];
type TaskStatus = components['schemas']['TaskStatus'];

interface UseTaskListOptions {
  limit?: number;
  projectFilter: string;
  refetchInterval?: number | false;
  status?: TaskStatus | 'all';
}

function buildQueryString(params: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim()) {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export function useTaskList({
  limit = 100,
  projectFilter,
  refetchInterval = false,
  status = 'all',
}: UseTaskListOptions) {
  return useQuery<TaskListResponse, ApiError>({
    queryKey: ['tasks', 'list', projectFilter, status, limit],
    queryFn: () => {
      const queryString = buildQueryString({
        limit,
        project_id: toProjectFilterQuery(projectFilter),
        status: status === 'all' ? undefined : status,
      });

      return apiClient<TaskListResponse>(`/api/tasks${queryString}`);
    },
    refetchInterval,
  });
}

export function useTaskDetail(taskId: string | undefined, enabled = true) {
  return useQuery<Task, ApiError>({
    queryKey: ['task', 'detail', taskId],
    queryFn: () => apiClient<Task>(`/api/tasks/${taskId ?? ''}`),
    enabled: Boolean(taskId) && enabled,
    retry: false,
  });
}


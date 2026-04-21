'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiClient, type ApiError } from '@/lib/api-client';
import { toProjectFilterQuery } from '@/lib/pipeline-utils';
import type { paths } from '@/types/api';

type VideoListResponse = paths['/api/library/videos']['get']['responses'][200]['content']['application/json'];
type TaskListResponse = paths['/api/tasks']['get']['responses'][200]['content']['application/json'];

interface UseLibraryVideosOptions {
  initialCursor?: string | null;
  limit?: number;
  projectFilter: string;
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

export function useLibraryVideos({
  initialCursor = null,
  limit = 12,
  projectFilter,
}: UseLibraryVideosOptions) {
  return useInfiniteQuery<VideoListResponse, ApiError>({
    initialPageParam: initialCursor,
    queryKey: ['library', 'videos', projectFilter, limit, initialCursor],
    queryFn: ({ pageParam }) => {
      const queryString = buildQueryString({
        cursor: typeof pageParam === 'string' && pageParam ? pageParam : undefined,
        limit,
        project_id: toProjectFilterQuery(projectFilter),
      });

      return apiClient<VideoListResponse>(`/api/library/videos${queryString}`);
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useTasksForLibrary(projectFilter: string, limit = 1000) {
  return useQuery<TaskListResponse, ApiError>({
    queryKey: ['tasks', 'library', projectFilter, limit],
    queryFn: () => {
      const queryString = buildQueryString({
        limit,
        project_id: toProjectFilterQuery(projectFilter),
      });

      return apiClient<TaskListResponse>(`/api/tasks${queryString}`);
    },
  });
}


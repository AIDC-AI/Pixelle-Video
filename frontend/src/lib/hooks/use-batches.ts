'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, type ApiError } from '@/lib/api-client';
import { toProjectFilterQuery } from '@/lib/pipeline-utils';
import type { paths } from '@/types/api';

type BatchListResponse = paths['/api/batch']['get']['responses'][200]['content']['application/json'];
type BatchCreateRequest = paths['/api/batch']['post']['requestBody']['content']['application/json'];
type BatchCreateResponse = paths['/api/batch']['post']['responses'][201]['content']['application/json'];
type BatchDetailResponse = paths['/api/batch/{batch_id}']['get']['responses'][200]['content']['application/json'];
type BatchDeleteResponse = paths['/api/batch/{batch_id}']['delete']['responses'][200]['content']['application/json'];

interface UseBatchListOptions {
  cursor?: string | null;
  limit?: number;
  projectFilter?: string;
  status?: string;
}

interface UseInfiniteBatchListOptions {
  limit?: number;
  projectFilter?: string;
  status?: string;
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

export function useBatchList({
  cursor,
  limit = 20,
  projectFilter = 'all',
  status = 'all',
}: UseBatchListOptions) {
  return useQuery<BatchListResponse, ApiError>({
    queryKey: ['batches', 'list', cursor ?? null, limit, projectFilter, status],
    queryFn: () => {
      const queryString = buildQueryString({
        cursor,
        limit,
        project_id: toProjectFilterQuery(projectFilter),
        status: status === 'all' ? undefined : status,
      });

      return apiClient<BatchListResponse>(`/api/batch${queryString}`);
    },
  });
}

export function useInfiniteBatchList({
  limit = 20,
  projectFilter = 'all',
  status = 'all',
}: UseInfiniteBatchListOptions) {
  return useInfiniteQuery<BatchListResponse, ApiError>({
    initialPageParam: null as string | null,
    queryKey: ['batches', 'infinite', limit, projectFilter, status],
    queryFn: ({ pageParam }) => {
      const queryString = buildQueryString({
        cursor: (pageParam as string | null | undefined) ?? undefined,
        limit,
        project_id: toProjectFilterQuery(projectFilter),
        status: status === 'all' ? undefined : status,
      });

      return apiClient<BatchListResponse>(`/api/batch${queryString}`);
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useBatchDetail(batchId: string | undefined, refetchInterval: number | false = false) {
  return useQuery<BatchDetailResponse, ApiError>({
    queryKey: ['batches', 'detail', batchId],
    queryFn: () => apiClient<BatchDetailResponse>(`/api/batch/${batchId ?? ''}`),
    enabled: Boolean(batchId),
    refetchInterval,
    retry: false,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();

  return useMutation<BatchCreateResponse, ApiError, BatchCreateRequest>({
    mutationFn: (body) =>
      apiClient<BatchCreateResponse>('/api/batch', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      ]);
    },
  });
}

export function useDeleteBatch() {
  const queryClient = useQueryClient();

  return useMutation<BatchDeleteResponse, ApiError, { batchId: string; cascade?: boolean }>({
    mutationFn: ({ batchId, cascade = false }) => {
      const queryString = buildQueryString({ cascade: cascade ? 'true' : undefined });
      return apiClient<BatchDeleteResponse>(`/api/batch/${batchId}${queryString}`, {
        method: 'DELETE',
      });
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['library', 'videos'] }),
        queryClient.removeQueries({ queryKey: ['batches', 'detail', variables.batchId] }),
      ]);
    },
  });
}

'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import { apiClient, type ApiError } from '@/lib/api-client';
import { toProjectFilterQuery } from '@/lib/pipeline-utils';
import type { paths } from '@/types/api';

type ImageListResponse =
  paths['/api/library/images']['get']['responses'][200]['content']['application/json'];
type VoiceListResponse =
  paths['/api/library/voices']['get']['responses'][200]['content']['application/json'];
type LibraryBGMListResponse =
  paths['/api/library/bgm']['get']['responses'][200]['content']['application/json'];
type ScriptListResponse =
  paths['/api/library/scripts']['get']['responses'][200]['content']['application/json'];

interface UseLibraryCursorOptions {
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

function useLibraryCursorQuery<TResponse extends { next_cursor?: string | null }>(
  key: string,
  endpoint: '/api/library/images' | '/api/library/voices' | '/api/library/bgm' | '/api/library/scripts',
  { initialCursor = null, limit = 12, projectFilter }: UseLibraryCursorOptions
) {
  return useInfiniteQuery<TResponse, ApiError>({
    initialPageParam: initialCursor,
    queryKey: ['library', key, projectFilter, limit, initialCursor],
    queryFn: ({ pageParam }) => {
      const queryString = buildQueryString({
        cursor: typeof pageParam === 'string' && pageParam ? pageParam : undefined,
        limit,
        project_id: toProjectFilterQuery(projectFilter),
      });

      return apiClient<TResponse>(`${endpoint}${queryString}`);
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useLibraryImages(options: UseLibraryCursorOptions) {
  return useLibraryCursorQuery<ImageListResponse>('images', '/api/library/images', options);
}

export function useLibraryVoices(options: UseLibraryCursorOptions) {
  return useLibraryCursorQuery<VoiceListResponse>('voices', '/api/library/voices', options);
}

export function useLibraryBgm(options: UseLibraryCursorOptions) {
  return useLibraryCursorQuery<LibraryBGMListResponse>('bgm', '/api/library/bgm', options);
}

export function useLibraryScripts(options: UseLibraryCursorOptions) {
  return useLibraryCursorQuery<ScriptListResponse>('scripts', '/api/library/scripts', options);
}

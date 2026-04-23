'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, type ApiError } from '@/lib/api-client';
import type { components, paths } from '@/types/api';

type SettingsPayload = components['schemas']['SettingsPayload'];
type SettingsUpdatePayload = components['schemas']['SettingsUpdatePayload'];
type HealthResponse = paths['/health']['get']['responses'][200]['content']['application/json'];
type ComfyUICheckRequest =
  paths['/api/settings/comfyui/check']['post']['requestBody']['content']['application/json'];
type ComfyUICheckResponse =
  paths['/api/settings/comfyui/check']['post']['responses'][200]['content']['application/json'];
type LLMCheckRequest =
  paths['/api/settings/llm/check']['post']['requestBody']['content']['application/json'];
type LLMCheckResponse =
  paths['/api/settings/llm/check']['post']['responses'][200]['content']['application/json'];
type RunningHubCheckRequest =
  paths['/api/settings/runninghub/check']['post']['requestBody']['content']['application/json'];
type RunningHubCheckResponse =
  paths['/api/settings/runninghub/check']['post']['responses'][200]['content']['application/json'];
type StorageStatsResponse =
  paths['/api/settings/storage/stats']['get']['responses'][200]['content']['application/json'];
type StorageCleanupRequest =
  paths['/api/settings/storage/cleanup']['post']['requestBody']['content']['application/json'];
type StorageCleanupResponse =
  paths['/api/settings/storage/cleanup']['post']['responses'][200]['content']['application/json'];

export function useSettings() {
  return useQuery<SettingsPayload, ApiError>({
    queryKey: ['settings'],
    queryFn: () => apiClient<SettingsPayload>('/api/settings'),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation<SettingsPayload, ApiError, SettingsUpdatePayload>({
    mutationFn: (payload) =>
      apiClient<SettingsPayload>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: async (data) => {
      queryClient.setQueryData(['settings'], data);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useHealthStatus() {
  return useQuery<HealthResponse, ApiError>({
    queryKey: ['health'],
    queryFn: () => apiClient<HealthResponse>('/health'),
  });
}

export function useCheckComfyUIConnection() {
  return useMutation<ComfyUICheckResponse, ApiError, ComfyUICheckRequest>({
    mutationFn: (payload) =>
      apiClient<ComfyUICheckResponse>('/api/settings/comfyui/check', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

export function useCheckLlmConnection() {
  return useMutation<LLMCheckResponse, ApiError, LLMCheckRequest>({
    mutationFn: (payload) =>
      apiClient<LLMCheckResponse>('/api/settings/llm/check', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

export function useCheckRunningHubConnection() {
  return useMutation<RunningHubCheckResponse, ApiError, RunningHubCheckRequest>({
    mutationFn: (payload) =>
      apiClient<RunningHubCheckResponse>('/api/settings/runninghub/check', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

export function useStorageStats() {
  return useQuery<StorageStatsResponse, ApiError>({
    queryKey: ['settings', 'storage-stats'],
    queryFn: () => apiClient<StorageStatsResponse>('/api/settings/storage/stats'),
  });
}

export function useCleanupStorage() {
  const queryClient = useQueryClient();

  return useMutation<StorageCleanupResponse, ApiError, StorageCleanupRequest>({
    mutationFn: (payload) =>
      apiClient<StorageCleanupResponse>('/api/settings/storage/cleanup', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'storage-stats'] });
    },
  });
}

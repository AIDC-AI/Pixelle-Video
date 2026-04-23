import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, type ApiError } from '../api-client';
import { components } from '../../types/api';

type Project = components['schemas']['Project'];
type ProjectCreateRequest = components['schemas']['ProjectCreateRequest'];
type ProjectListResponse = components['schemas']['ProjectListResponse'];
type ProjectOverviewResponse = components['schemas']['ProjectOverviewResponse'];
type ProjectUpdateRequest = components['schemas']['ProjectUpdateRequest'];

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient<ProjectListResponse>('/api/projects'),
  });
}

export function useProject(projectId: string | null | undefined) {
  return useQuery<Project, ApiError>({
    queryKey: ['projects', 'detail', projectId],
    queryFn: () => apiClient<Project>(`/api/projects/${projectId ?? ''}`),
    enabled: Boolean(projectId),
  });
}

export function useProjectOverview(projectId: string | null | undefined) {
  return useQuery<ProjectOverviewResponse, ApiError>({
    queryKey: ['projects', 'overview', projectId],
    queryFn: () => apiClient<ProjectOverviewResponse>(`/api/projects/${projectId ?? ''}/overview`),
    enabled: Boolean(projectId),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectCreateRequest) =>
      apiClient<Project>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
      ]);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation<Project, ApiError, { projectId: string; body: ProjectUpdateRequest }>({
    mutationFn: ({ projectId, body }) =>
      apiClient<Project>(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'detail', variables.projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'overview', variables.projectId] }),
      ]);
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation<Project, ApiError, { projectId: string; cascade?: boolean }>({
    mutationFn: ({ projectId, cascade = false }) =>
      apiClient<Project>(`/api/projects/${projectId}${cascade ? '?cascade=true' : ''}`, {
        method: 'DELETE',
      }),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['library'] }),
        queryClient.removeQueries({ queryKey: ['projects', 'detail', variables.projectId] }),
        queryClient.removeQueries({ queryKey: ['projects', 'overview', variables.projectId] }),
      ]);
    },
  });
}

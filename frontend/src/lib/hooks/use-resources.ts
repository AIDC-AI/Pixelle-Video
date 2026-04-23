import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, type ApiError } from '../api-client';
import type { components, paths } from '@/types/api';

type WorkflowListResponse =
  paths['/api/resources/workflows/tts']['get']['responses'][200]['content']['application/json'];
type BgmListResponse =
  paths['/api/resources/bgm']['get']['responses'][200]['content']['application/json'];
type TemplateListResponse =
  paths['/api/resources/templates']['get']['responses'][200]['content']['application/json'];
type PresetListResponse =
  paths['/api/resources/presets']['get']['responses'][200]['content']['application/json'];
type WorkflowDetailResponse =
  paths['/api/resources/workflows/{workflow_id}']['get']['responses'][200]['content']['application/json'];
type StyleListResponse =
  paths['/api/resources/styles']['get']['responses'][200]['content']['application/json'];
type StyleDetailResponse =
  paths['/api/resources/styles/{style_id}']['get']['responses'][200]['content']['application/json'];
type PresetUpsertRequest = components['schemas']['PresetUpsertRequest'];
type StyleUpsertRequest = components['schemas']['StyleUpsertRequest'];
type TemplateParamsResponse =
  paths['/api/frame/template/params']['get']['responses'][200]['content']['application/json'];
type FrameRenderRequest =
  paths['/api/frame/render']['post']['requestBody']['content']['application/json'];
type FrameRenderResponse =
  paths['/api/frame/render']['post']['responses'][200]['content']['application/json'];

const EMPTY_WORKFLOW_LIST: WorkflowListResponse = {
  success: false,
  message: 'Failed to load workflows',
  workflows: [],
};

const EMPTY_BGM_LIST: BgmListResponse = {
  success: false,
  message: 'Failed to load BGM files',
  bgm_files: [],
};

const EMPTY_TEMPLATE_LIST: TemplateListResponse = {
  success: false,
  message: 'Failed to load templates',
  templates: [],
};

const EMPTY_PRESET_LIST: PresetListResponse = {
  success: false,
  message: 'Failed to load presets',
  presets: [],
};

const EMPTY_STYLE_LIST: StyleListResponse = {
  success: false,
  message: 'Failed to load styles',
  styles: [],
};

export function useTtsWorkflows() {
  return useQuery({
    queryKey: ['resources', 'workflows', 'tts'],
    queryFn: () =>
      apiClient<WorkflowListResponse>('/api/resources/workflows/tts').catch(() => EMPTY_WORKFLOW_LIST),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMediaWorkflows() {
  return useQuery({
    queryKey: ['resources', 'workflows', 'media'],
    queryFn: () =>
      apiClient<WorkflowListResponse>('/api/resources/workflows/media').catch(() => EMPTY_WORKFLOW_LIST),
    staleTime: 5 * 60 * 1000,
  });
}

export function useImageWorkflows() {
  return useQuery({
    queryKey: ['resources', 'workflows', 'image'],
    queryFn: () =>
      apiClient<WorkflowListResponse>('/api/resources/workflows/image').catch(() => EMPTY_WORKFLOW_LIST),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBgmList() {
  return useQuery({
    queryKey: ['resources', 'bgm'],
    queryFn: () => apiClient<BgmListResponse>('/api/resources/bgm').catch(() => EMPTY_BGM_LIST),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: ['resources', 'templates'],
    queryFn: () => apiClient<TemplateListResponse>('/api/resources/templates').catch(() => EMPTY_TEMPLATE_LIST),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStyles() {
  return useQuery({
    queryKey: ['resources', 'styles'],
    queryFn: () => apiClient<StyleListResponse>('/api/resources/styles').catch(() => EMPTY_STYLE_LIST),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStyleDetail(styleId: string | null | undefined) {
  return useQuery<StyleDetailResponse, ApiError>({
    queryKey: ['resources', 'style-detail', styleId],
    enabled: Boolean(styleId),
    queryFn: () => apiClient<StyleDetailResponse>(`/api/resources/styles/${encodeURIComponent(styleId ?? '')}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePresets() {
  return useQuery({
    queryKey: ['resources', 'presets'],
    queryFn: () => apiClient<PresetListResponse>('/api/resources/presets').catch(() => EMPTY_PRESET_LIST),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorkflowDetail(workflowId: string | null | undefined) {
  return useQuery<WorkflowDetailResponse, ApiError>({
    queryKey: ['resources', 'workflow-detail', workflowId],
    enabled: Boolean(workflowId),
    queryFn: () =>
      apiClient<WorkflowDetailResponse>(
        `/api/resources/workflows/${encodeURIComponent(workflowId ?? '')}`
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTemplateParams(templateKey: string | null | undefined) {
  return useQuery<TemplateParamsResponse, ApiError>({
    queryKey: ['resources', 'template-params', templateKey],
    enabled: Boolean(templateKey),
    queryFn: () =>
      apiClient<TemplateParamsResponse>(
        `/api/frame/template/params?${new URLSearchParams({ template: templateKey ?? '' }).toString()}`
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRenderTemplatePreview() {
  return useMutation<FrameRenderResponse, ApiError, FrameRenderRequest>({
    mutationFn: (payload) =>
      apiClient<FrameRenderResponse>('/api/frame/render', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

export function useCreatePreset() {
  const queryClient = useQueryClient();

  return useMutation<components['schemas']['PresetItem'], ApiError, PresetUpsertRequest>({
    mutationFn: (payload) =>
      apiClient<components['schemas']['PresetItem']>('/api/resources/presets', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resources', 'presets'] });
    },
  });
}

export function useUpdatePreset() {
  const queryClient = useQueryClient();

  return useMutation<
    components['schemas']['PresetItem'],
    ApiError,
    { name: string; payload: PresetUpsertRequest }
  >({
    mutationFn: ({ name, payload }) =>
      apiClient<components['schemas']['PresetItem']>(`/api/resources/presets/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resources', 'presets'] });
    },
  });
}

export function useDeletePreset() {
  const queryClient = useQueryClient();

  return useMutation<components['schemas']['BaseResponse'], ApiError, string>({
    mutationFn: (name) =>
      apiClient<components['schemas']['BaseResponse']>(`/api/resources/presets/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resources', 'presets'] });
    },
  });
}

export function useCreateStyle() {
  const queryClient = useQueryClient();

  return useMutation<components['schemas']['StyleDetail'], ApiError, StyleUpsertRequest>({
    mutationFn: (payload) =>
      apiClient<components['schemas']['StyleDetail']>('/api/resources/styles', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resources', 'styles'] });
    },
  });
}

export function useUpdateStyle() {
  const queryClient = useQueryClient();

  return useMutation<
    components['schemas']['StyleDetail'],
    ApiError,
    { styleId: string; payload: StyleUpsertRequest }
  >({
    mutationFn: ({ styleId, payload }) =>
      apiClient<components['schemas']['StyleDetail']>(`/api/resources/styles/${encodeURIComponent(styleId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['resources', 'styles'] }),
        queryClient.invalidateQueries({ queryKey: ['resources', 'style-detail', variables.styleId] }),
      ]);
    },
  });
}

export function useDeleteStyle() {
  const queryClient = useQueryClient();

  return useMutation<components['schemas']['BaseResponse'], ApiError, string>({
    mutationFn: (styleId) =>
      apiClient<components['schemas']['BaseResponse']>(`/api/resources/styles/${encodeURIComponent(styleId)}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resources', 'styles'] });
    },
  });
}

export function useUpdateWorkflowDetail() {
  const queryClient = useQueryClient();

  return useMutation<
    WorkflowDetailResponse,
    ApiError,
    { workflowId: string; payload: Record<string, unknown> }
  >({
    mutationFn: ({ workflowId, payload }) =>
      apiClient<WorkflowDetailResponse>(`/api/resources/workflows/${encodeURIComponent(workflowId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['resources', 'workflow-detail', variables.workflowId] }),
        queryClient.invalidateQueries({ queryKey: ['resources', 'workflows', 'media'] }),
      ]);
    },
  });
}

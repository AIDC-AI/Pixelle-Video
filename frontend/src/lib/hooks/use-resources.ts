import { useQuery } from '@tanstack/react-query';

import { apiClient, type ApiError } from '../api-client';
import type { paths } from '@/types/api';

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

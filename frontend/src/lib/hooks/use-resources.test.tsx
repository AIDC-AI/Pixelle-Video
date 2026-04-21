import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

import {
  useBgmList,
  useImageWorkflows,
  useMediaWorkflows,
  usePresets,
  useTemplates,
  useTtsWorkflows,
  useWorkflowDetail,
} from './use-resources';
import { server } from '@/tests/msw/server';
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

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('use-resources hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  it('useTtsWorkflows fetches data', async () => {
    const { result } = renderHook(() => useTtsWorkflows(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<WorkflowListResponse>({
      success: true,
      message: 'Success',
      workflows: [
        {
          name: 'tts_edge.json',
          display_name: 'TTS 1',
          source: 'selfhost',
          path: '/workflows/tts/tts_edge.json',
          key: 'selfhost/tts_edge.json',
          workflow_id: null,
        },
        {
          name: 'tts_cloud.json',
          display_name: 'TTS Cloud',
          source: 'runninghub',
          path: '/workflows/runninghub/tts_cloud.json',
          key: 'runninghub/tts_cloud.json',
          workflow_id: 'rh-tts-cloud',
        },
      ],
    });
  });

  it('useMediaWorkflows fetches data', async () => {
    const { result } = renderHook(() => useMediaWorkflows(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<WorkflowListResponse>({
      success: true,
      message: 'Success',
      workflows: [
        {
          name: 'media_default.json',
          display_name: 'Media 1',
          source: 'selfhost',
          path: '/workflows/media/media_default.json',
          key: 'selfhost/media_default.json',
          workflow_id: null,
        },
        {
          name: 'pose_default.json',
          display_name: 'Pose 1',
          source: 'selfhost',
          path: '/workflows/media/pose_default.json',
          key: 'selfhost/pose_default.json',
          workflow_id: null,
        },
        {
          name: 'video_cloud.json',
          display_name: 'RunningHub Motion',
          source: 'runninghub',
          path: '/workflows/runninghub/video_cloud.json',
          key: 'runninghub/video_cloud.json',
          workflow_id: 'rh-video-cloud',
        },
      ],
    });
  });

  it('useImageWorkflows fetches data', async () => {
    const { result } = renderHook(() => useImageWorkflows(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<WorkflowListResponse>({
      success: true,
      message: 'Success',
      workflows: [
        {
          name: 'image_default.json',
          display_name: 'Image 1',
          source: 'selfhost',
          path: '/workflows/image/image_default.json',
          key: 'selfhost/image_default.json',
          workflow_id: null,
        },
        {
          name: 'image_flux.json',
          display_name: 'Image Flux',
          source: 'runninghub',
          path: '/workflows/runninghub/image_flux.json',
          key: 'runninghub/image_flux.json',
          workflow_id: 'rh-image-flux',
        },
      ],
    });
  });

  it('useBgmList fetches data', async () => {
    const { result } = renderHook(() => useBgmList(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<BgmListResponse>({
      success: true,
      message: 'Success',
      bgm_files: [
        {
          name: 'BGM 1',
          path: '/bgm/default/bgm-1.mp3',
          source: 'default',
        },
      ],
    });
  });

  it('useTtsWorkflows handles error', async () => {
    server.use(
      http.get(`${baseURL}/api/resources/workflows/tts`, () => new HttpResponse(null, { status: 500 }))
    );

    const { result } = renderHook(() => useTtsWorkflows(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<WorkflowListResponse>({
      success: false,
      message: 'Failed to load workflows',
      workflows: [],
    });
  });

  it('useMediaWorkflows handles error', async () => {
    server.use(
      http.get(`${baseURL}/api/resources/workflows/media`, () => new HttpResponse(null, { status: 500 }))
    );

    const { result } = renderHook(() => useMediaWorkflows(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<WorkflowListResponse>({
      success: false,
      message: 'Failed to load workflows',
      workflows: [],
    });
  });

  it('useImageWorkflows handles error', async () => {
    server.use(
      http.get(`${baseURL}/api/resources/workflows/image`, () => new HttpResponse(null, { status: 500 }))
    );

    const { result } = renderHook(() => useImageWorkflows(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<WorkflowListResponse>({
      success: false,
      message: 'Failed to load workflows',
      workflows: [],
    });
  });

  it('useTemplates fetches data', async () => {
    const { result } = renderHook(() => useTemplates(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<TemplateListResponse>({
      success: true,
      message: 'Success',
      templates: [
        {
          name: 'image_default.html',
          display_name: 'image_default.html',
          size: '1080x1920',
          width: 1080,
          height: 1920,
          orientation: 'portrait',
          path: '/templates/1080x1920/image_default.html',
          key: '1080x1920/image_default.html',
        },
        {
          name: 'landscape_default.html',
          display_name: 'landscape_default.html',
          size: '1920x1080',
          width: 1920,
          height: 1080,
          orientation: 'landscape',
          path: '/templates/1920x1080/landscape_default.html',
          key: '1920x1080/landscape_default.html',
        },
      ],
    });
  });

  it('useTemplates falls back on error', async () => {
    server.use(
      http.get(`${baseURL}/api/resources/templates`, () => new HttpResponse(null, { status: 500 }))
    );

    const { result } = renderHook(() => useTemplates(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<TemplateListResponse>({
      success: false,
      message: 'Failed to load templates',
      templates: [],
    });
  });

  it('usePresets fetches data', async () => {
    const { result } = renderHook(() => usePresets(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<PresetListResponse>({
      success: true,
      message: 'Success',
      presets: [
        {
          name: 'Launch Quick Preset',
          description: 'Reusable Quick pipeline preset.',
          pipeline: 'standard',
          payload_template: {
            title: 'Launch Quick Preset Title',
            text: 'Preset-based narration',
            mode: 'generate',
            n_scenes: 5,
            min_narration_words: 5,
            max_narration_words: 20,
            min_image_prompt_words: 30,
            max_image_prompt_words: 60,
            media_workflow: 'selfhost/media_default.json',
            video_fps: 30,
            frame_template: '1080x1920/image_default.html',
            bgm_volume: 0.3,
          },
          created_at: '2026-04-22T00:00:00Z',
          source: 'user',
        },
        {
          name: 'Creative LLM Preset',
          description: 'Reusable Quick pipeline preset.',
          pipeline: 'llm',
          payload_template: {
            llm: {
              base_url: 'https://api.example.com',
              model: 'gpt-4.1-mini',
            },
          },
          created_at: '2026-04-22T00:00:00Z',
          source: 'builtin',
        },
      ],
    });
  });

  it('usePresets falls back on error', async () => {
    server.use(
      http.get(`${baseURL}/api/resources/presets`, () => new HttpResponse(null, { status: 500 }))
    );

    const { result } = renderHook(() => usePresets(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<PresetListResponse>({
      success: false,
      message: 'Failed to load presets',
      presets: [],
    });
  });

  it('useBgmList handles error', async () => {
    server.use(
      http.get(`${baseURL}/api/resources/bgm`, () => new HttpResponse(null, { status: 500 }))
    );

    const { result } = renderHook(() => useBgmList(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<BgmListResponse>({
      success: false,
      message: 'Failed to load BGM files',
      bgm_files: [],
    });
  });

  it('useWorkflowDetail fetches workflow detail when an id is provided', async () => {
    const { result } = renderHook(() => useWorkflowDetail('selfhost/media_default.json'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual<WorkflowDetailResponse>({
      name: 'media_default.json',
      display_name: 'Media 1',
      source: 'selfhost',
      path: '/workflows/media/media_default.json',
      key: 'selfhost/media_default.json',
      workflow_id: null,
      editable: true,
      metadata: {
        node_count: 5,
        source_path: '/workflows/media/media_default.json',
      },
      key_parameters: ['loader', 'sampler', 'save'],
      raw_nodes: ['1', '2', '3'],
    });
  });

  it('useWorkflowDetail stays idle when no workflow id is provided', () => {
    const { result } = renderHook(() => useWorkflowDetail(null), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });
});

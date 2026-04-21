import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

import { useTtsWorkflows, useMediaWorkflows, useImageWorkflows, useBgmList } from './use-resources';
import { server } from '@/tests/msw/server';
import type { paths } from '@/types/api';

type WorkflowListResponse =
  paths['/api/resources/workflows/tts']['get']['responses'][200]['content']['application/json'];
type BgmListResponse =
  paths['/api/resources/bgm']['get']['responses'][200]['content']['application/json'];

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
});

import { beforeEach, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useSubmitQuick, useTaskPolling, useCancelTask } from './use-create-video';
import { useCurrentProjectStore } from '@/stores/current-project';
import {
  DEFAULT_CANCELLED_TASK_ID,
  DEFAULT_SUCCESS_TASK_ID,
  buildTask,
  getLastGeneratePayload,
  resetMockApiState,
  setSubmitScenario,
  setTaskScenario,
} from '@/tests/msw/handlers';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('use-create-video hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    resetMockApiState();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    useCurrentProjectStore.setState({
      currentProjectId: 'project-1',
    });
  });

  it('useSubmitQuick posts the generated contract and injects project_id', async () => {
    const { result } = renderHook(() => useSubmitQuick(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      text: 'Hello world',
      mode: 'generate',
      title: 'Test',
      n_scenes: 5,
      tts_workflow: 'selfhost/tts_edge.json',
      ref_audio: null,
      voice_id: null,
      min_narration_words: 5,
      max_narration_words: 20,
      min_image_prompt_words: 30,
      max_image_prompt_words: 60,
      media_workflow: 'selfhost/media_default.json',
      video_fps: 30,
      frame_template: null,
      template_params: null,
      prompt_prefix: null,
      bgm_mode: 'none',
      bgm_path: null,
      bgm_volume: 0.3,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      success: true,
      message: 'Task created successfully',
      task_id: DEFAULT_SUCCESS_TASK_ID,
    });
    expect(getLastGeneratePayload()?.project_id).toBe('project-1');
  });

  it('useSubmitQuick fails if no project is selected', async () => {
    useCurrentProjectStore.setState({ currentProjectId: null });

    const { result } = renderHook(() => useSubmitQuick(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      text: 'Hello world',
      mode: 'generate',
      title: 'Test',
      n_scenes: 5,
      tts_workflow: 'selfhost/tts_edge.json',
      ref_audio: null,
      voice_id: null,
      min_narration_words: 5,
      max_narration_words: 20,
      min_image_prompt_words: 30,
      max_image_prompt_words: 60,
      media_workflow: 'selfhost/media_default.json',
      video_fps: 30,
      frame_template: null,
      template_params: null,
      prompt_prefix: null,
      bgm_mode: 'none',
      bgm_path: null,
      bgm_volume: 0.3,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Project ID is required');
  });

  it('useTaskPolling fetches the typed task shape', async () => {
    setSubmitScenario('success', DEFAULT_SUCCESS_TASK_ID);
    setTaskScenario(DEFAULT_SUCCESS_TASK_ID, [buildTask(DEFAULT_SUCCESS_TASK_ID, 'completed')]);

    const { result } = renderHook(() => useTaskPolling(DEFAULT_SUCCESS_TASK_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.task_id).toBe(DEFAULT_SUCCESS_TASK_ID);
    expect(result.current.data?.status).toBe('completed');
    expect(result.current.data?.progress?.percentage).toBe(100);
  });

  it('useTaskPolling accepts cancelled as a terminal status', async () => {
    setSubmitScenario('success', DEFAULT_CANCELLED_TASK_ID);
    setTaskScenario(DEFAULT_CANCELLED_TASK_ID, [buildTask(DEFAULT_CANCELLED_TASK_ID, 'cancelled')]);

    const { result } = renderHook(() => useTaskPolling(DEFAULT_CANCELLED_TASK_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe('cancelled');
  });

  it('useCancelTask deletes a task', async () => {
    const { result } = renderHook(() => useCancelTask(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(DEFAULT_SUCCESS_TASK_ID);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      success: true,
      message: `Task ${DEFAULT_SUCCESS_TASK_ID} cancelled successfully`,
    });
  });
});

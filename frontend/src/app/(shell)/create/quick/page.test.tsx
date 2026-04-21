import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import QuickCreatePage, { QUICK_SUBMIT_REQUEST_KEYS } from './page';
import { useCurrentProjectStore } from '@/stores/current-project';
import {
  buildTask,
  DEFAULT_CANCELLED_TASK_ID,
  DEFAULT_FAILURE_TASK_ID,
  DEFAULT_SUCCESS_TASK_ID,
  getLastGeneratePayload,
  getTaskPollCount,
  resetMockApiState,
  setSubmitScenario,
  setTaskScenario,
} from '@/tests/msw/handlers';

let mockSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

class ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

window.ResizeObserver = ResizeObserver;

if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
    }
  }

  Object.defineProperty(window, 'PointerEvent', {
    value: PointerEventPolyfill,
    configurable: true,
    writable: true,
  });
}

type PersistedProject = ReturnType<typeof useCurrentProjectStore.getState>['currentProject'];

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

async function seedCurrentProject(project: PersistedProject): Promise<void> {
  if (project) {
    localStorage.setItem(
      'current-project-storage',
      JSON.stringify({
        state: { currentProject: project },
        version: 0,
      })
    );
  } else {
    localStorage.removeItem('current-project-storage');
  }

  useCurrentProjectStore.setState({ currentProject: project });

  await act(async () => {
    await useCurrentProjectStore.persist.rehydrate();
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <QuickCreatePage />
    </QueryClientProvider>
  );
}

async function fillQuickForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides?: { title?: string; topic?: string; narration?: string }
): Promise<void> {
  const title = overrides?.title ?? 'My Title';
  const topic = overrides?.topic ?? 'A valid topic description with enough detail';

  await user.type(screen.getByLabelText('视频标题'), title);
  await user.type(screen.getByLabelText('创意描述 (Topic)'), topic);

  await user.click(screen.getByLabelText('配音 (TTS)'));
  await user.click(await screen.findByText('TTS 1'));

  await user.click(screen.getByLabelText('媒体流 (Media)'));
  await user.click(await screen.findByText('Media 1'));

  if (overrides?.narration) {
    await user.click(screen.getByRole('button', { name: '高级配置' }));
    await user.type(screen.getByLabelText('自定义旁白'), overrides.narration);
  }
}

describe('QuickCreatePage', () => {
  beforeEach(async () => {
    resetMockApiState();
    mockSearchParams = new URLSearchParams('');
    await seedCurrentProject({ id: 'project-1', name: 'Test Project' });
  });

  it('renders the quick form and summary panel', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Quick' })).toBeInTheDocument();
    expect(screen.getByText('配置摘要')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成视频' })).toBeInTheDocument();
  });

  it('opens the project dialog and blocks submit when no project is selected', async () => {
    await seedCurrentProject(null);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: 'Quick' });
    await fillQuickForm(user);

    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('未选择项目')).toBeInTheDocument();
    expect(getLastGeneratePayload()).toBeNull();
  });

  it('submits, polls, and renders the generated video result via msw', async () => {
    setSubmitScenario('success', DEFAULT_SUCCESS_TASK_ID);
    setTaskScenario(DEFAULT_SUCCESS_TASK_ID, [buildTask(DEFAULT_SUCCESS_TASK_ID, 'completed')]);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: 'Quick' });
    await fillQuickForm(user);

    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('生成结果')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /复制链接/i })).toBeInTheDocument();
  });

  it('submits only backend-supported VideoGenerateRequest fields', async () => {
    setSubmitScenario('success', DEFAULT_SUCCESS_TASK_ID);
    setTaskScenario(DEFAULT_SUCCESS_TASK_ID, [buildTask(DEFAULT_SUCCESS_TASK_ID, 'completed')]);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: 'Quick' });
    await fillQuickForm(user, { narration: 'Use this fixed narration instead.' });

    await user.click(screen.getByRole('button', { name: '生成视频' }));

    await waitFor(() => {
      expect(getLastGeneratePayload()).not.toBeNull();
    });

    const payload = getLastGeneratePayload();
    expect(payload).not.toBeNull();
    expect(Object.keys(payload ?? {}).sort()).toEqual([...QUICK_SUBMIT_REQUEST_KEYS].sort());
    expect(payload).toMatchObject({
      project_id: 'project-1',
      text: 'Use this fixed narration instead.',
      mode: 'fixed',
      title: 'My Title',
      tts_workflow: 'selfhost/tts_edge.json',
      media_workflow: 'selfhost/media_default.json',
      n_scenes: 5,
      ref_audio: null,
      voice_id: null,
      min_narration_words: 5,
      max_narration_words: 20,
      min_image_prompt_words: 30,
      max_image_prompt_words: 60,
      video_fps: 30,
      frame_template: null,
      template_params: null,
      prompt_prefix: null,
      bgm_path: null,
      bgm_volume: 0.3,
    });
  });

  it('shows a failed state when the submit endpoint returns 502', async () => {
    setSubmitScenario('http-502');
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: 'Quick' });
    await fillQuickForm(user);

    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('生成失败')).toBeInTheDocument();
    expect(screen.getByText('Upstream unavailable')).toBeInTheDocument();
  });

  it('shows a failed state when the submit endpoint has a network error', async () => {
    setSubmitScenario('network-error');
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: 'Quick' });
    await fillQuickForm(user);

    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('生成失败')).toBeInTheDocument();
    expect(screen.getByText(/fetch/i)).toBeInTheDocument();
  });

  it('shows a failed state when the polled task fails', async () => {
    setSubmitScenario('success', DEFAULT_FAILURE_TASK_ID);
    setTaskScenario(DEFAULT_FAILURE_TASK_ID, [buildTask(DEFAULT_FAILURE_TASK_ID, 'failed')]);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: 'Quick' });
    await fillQuickForm(user);

    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('生成失败')).toBeInTheDocument();
    expect(screen.getByText('Generation failed')).toBeInTheDocument();
  });

  it('stops polling and shows cancelled state after cancelling a running task', async () => {
    setSubmitScenario('success', DEFAULT_CANCELLED_TASK_ID);
    setTaskScenario(
      DEFAULT_CANCELLED_TASK_ID,
      [
        buildTask(DEFAULT_CANCELLED_TASK_ID, 'pending'),
        buildTask(DEFAULT_CANCELLED_TASK_ID, 'running'),
      ],
      buildTask(DEFAULT_CANCELLED_TASK_ID, 'cancelled', {
        error: 'Task cancelled',
        result: null,
      })
    );

    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: 'Quick' });
    await fillQuickForm(user);

    await user.click(screen.getByRole('button', { name: '生成视频' }));
    expect(await screen.findByText('排队中')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('生成中')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '取消任务' }));

    expect(await screen.findByRole('button', { name: '重新开始' })).toBeInTheDocument();
    const pollCountAfterCancel = getTaskPollCount(DEFAULT_CANCELLED_TASK_ID);

    await new Promise((resolve) => window.setTimeout(resolve, 120));
    expect(getTaskPollCount(DEFAULT_CANCELLED_TASK_ID)).toBe(pollCountAfterCancel);
  });
});

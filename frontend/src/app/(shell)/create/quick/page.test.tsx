import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import QuickCreatePage from './page';
import { QUICK_SUBMIT_REQUEST_KEYS } from '../request-keys';
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

type PersistedProject = { id: string; name?: string } | null;
const QUICK_PAGE_HEADING = '快速创作';

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
        state: { currentProjectId: project.id },
        version: 0,
      })
    );
  } else {
    localStorage.removeItem('current-project-storage');
  }

  useCurrentProjectStore.setState({ currentProjectId: project?.id ?? null });

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
  await user.type(screen.getByLabelText('创意描述'), topic);

  await user.click(screen.getByLabelText('配音方案'));
  await user.click(await screen.findByText('Edge 配音方案 · 本地'));

  await user.click(screen.getByLabelText('画面方案'));
  await user.click(await screen.findByText('基础画面方案 · 本地'));

  if (overrides?.narration) {
    await user.click(screen.getByRole('button', { name: '高级配置' }));
    await user.type(screen.getByLabelText('自定义旁白'), overrides.narration);
  }
}

describe('QuickCreatePage', () => {
  beforeEach(async () => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    document.documentElement.lang = 'zh-CN';
    resetMockApiState();
    mockSearchParams = new URLSearchParams('');
    await seedCurrentProject({ id: 'project-1', name: 'Test Project' });
  });

  it('renders the quick form and summary panel', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: QUICK_PAGE_HEADING })).toBeInTheDocument();
    expect(screen.getByText('配置摘要')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成视频' })).toBeInTheDocument();
  });

  it('opens the project dialog and blocks submit when no project is selected', async () => {
    await seedCurrentProject(null);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: QUICK_PAGE_HEADING });
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
    await screen.findByRole('heading', { name: QUICK_PAGE_HEADING });
    await fillQuickForm(user);

    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('生成结果')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /复制链接/i })).toBeInTheDocument();
  });

  it('shows the task-level RunningHub instance selector only when a RunningHub workflow is selected', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: QUICK_PAGE_HEADING });

    expect(screen.queryByTestId('quick-runninghub-instance-type')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('配音方案'));
    await user.click(await screen.findByText('云端配音方案 · RunningHub'));

    expect(await screen.findByTestId('quick-runninghub-instance-type')).toHaveTextContent('Plus (48GB VRAM)');

    await user.click(screen.getByLabelText('配音方案'));
    await user.click(await screen.findByRole('option', { name: 'Edge 配音方案 · 本地' }));

    await waitFor(() => {
      expect(screen.queryByTestId('quick-runninghub-instance-type')).not.toBeInTheDocument();
    });
  });

  it('submits only backend-supported VideoGenerateRequest fields', async () => {
    setSubmitScenario('success', DEFAULT_SUCCESS_TASK_ID);
    setTaskScenario(DEFAULT_SUCCESS_TASK_ID, [buildTask(DEFAULT_SUCCESS_TASK_ID, 'completed')]);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    mockSearchParams = new URLSearchParams('tts_workflow=runninghub/tts_cloud.json&media_workflow=selfhost/media_default.json');

    renderPage();
    await screen.findByRole('heading', { name: QUICK_PAGE_HEADING });
    await user.type(screen.getByLabelText('视频标题'), 'My Title');
    await user.type(screen.getByLabelText('创意描述'), 'A valid topic description with enough detail');
    await user.click(screen.getByRole('button', { name: '高级配置' }));
    await user.type(screen.getByLabelText('自定义旁白'), 'Use this fixed narration instead.');
    await waitFor(() => {
      expect(screen.getByTestId('quick-runninghub-instance-type')).toHaveTextContent('Plus (48GB VRAM)');
    });

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
      style_id: null,
      tts_workflow: 'runninghub/tts_cloud.json',
      media_workflow: 'selfhost/media_default.json',
      n_scenes: 5,
      ref_audio: null,
      voice_id: null,
      min_narration_words: 5,
      max_narration_words: 20,
      min_image_prompt_words: 30,
      max_image_prompt_words: 60,
      video_fps: 30,
      frame_template: '1080x1920/image_default.html',
      template_params: null,
      prompt_prefix: null,
      bgm_mode: 'none',
      bgm_path: null,
      bgm_volume: 0.3,
      runninghub_instance_type: 'plus',
    });
  });

  it('applies selected style defaults and submits style_id', async () => {
    setSubmitScenario('success', DEFAULT_SUCCESS_TASK_ID);
    setTaskScenario(DEFAULT_SUCCESS_TASK_ID, [buildTask(DEFAULT_SUCCESS_TASK_ID, 'completed')]);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    mockSearchParams = new URLSearchParams('style_id=style-1014');

    renderPage();
    await screen.findByRole('heading', { name: QUICK_PAGE_HEADING });
    await fillQuickForm(user);

    await waitFor(() => {
      expect(screen.getByText('当前风格默认使用：发布故事默认背景音乐')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '生成视频' }));

    await waitFor(() => {
      expect(getLastGeneratePayload()).not.toBeNull();
    });

    expect(getLastGeneratePayload()).toMatchObject({
      style_id: 'style-1014',
      bgm_mode: 'default',
      bgm_path: null,
      prompt_prefix: 'Cinematic launch visuals with clean foreground focus',
    });
  });

  it('shows a failed state when the submit endpoint returns 502', async () => {
    setSubmitScenario('http-502');
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: QUICK_PAGE_HEADING });
    await fillQuickForm(user);

    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('生成失败')).toBeInTheDocument();
    expect(screen.getByText('Upstream unavailable')).toBeInTheDocument();
  });

  it('shows a failed state when the submit endpoint has a network error', async () => {
    setSubmitScenario('network-error');
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: QUICK_PAGE_HEADING });
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
    await screen.findByRole('heading', { name: QUICK_PAGE_HEADING });
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
    await screen.findByRole('heading', { name: QUICK_PAGE_HEADING });
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

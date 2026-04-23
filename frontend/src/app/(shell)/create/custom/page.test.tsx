import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CustomPage from './page';
import { CUSTOM_REQUEST_KEYS, CUSTOM_SCENE_KEYS } from '../request-keys';
import { renderWithQueryClient, seedCurrentProject } from '@/tests/pipeline-page-test-utils';
import {
  buildTask,
  getLastCustomPayload,
  getTaskPollCount,
  resetMockApiState,
  setAsyncSubmitScenario,
  setTaskScenario,
} from '@/tests/msw/handlers';

let mockSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

function buildScenesSearchParam() {
  const params = new URLSearchParams();
  params.set(
    'scenes',
    JSON.stringify([
      {
        duration: 5,
        media: 'http://localhost:8000/api/files/scene-1.png',
        narration: 'Introduce the product on a clean background.',
      },
    ])
  );
  return params;
}

describe('CustomPage', () => {
  beforeEach(async () => {
    resetMockApiState();
    mockSearchParams = buildScenesSearchParam();
    await seedCurrentProject({ id: 'project-1', name: 'Test Project' });
  });

  it('submits, polls, and renders the generated video result via msw', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setAsyncSubmitScenario('/api/video/custom/async', 'success', 'task-custom-success');
    setTaskScenario('task-custom-success', [buildTask('task-custom-success', 'completed')]);

    renderWithQueryClient(<CustomPage />);

    await screen.findByRole('heading', { name: '自定义资产' });
    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('生成结果')).toBeInTheDocument();
  });

  it('submits only supported CustomAsyncRequest fields and scene keys', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setAsyncSubmitScenario('/api/video/custom/async', 'success', 'task-custom-payload');
    setTaskScenario('task-custom-payload', [buildTask('task-custom-payload', 'completed')]);

    renderWithQueryClient(<CustomPage />);

    await screen.findByRole('heading', { name: '自定义资产' });
    await user.click(screen.getByRole('button', { name: '生成视频' }));

    await waitFor(() => {
      expect(getLastCustomPayload()).not.toBeNull();
    });

    const payload = getLastCustomPayload();
    expect(Object.keys(payload ?? {}).sort()).toEqual([...CUSTOM_REQUEST_KEYS].sort());
    expect(payload?.project_id).toBe('project-1');
    expect(Array.isArray(payload?.scenes)).toBe(true);
    expect(payload?.scenes[0]).toMatchObject({
      duration: 5,
      media: 'http://localhost:8000/api/files/scene-1.png',
      narration: 'Introduce the product on a clean background.',
    });
    expect(Object.keys(payload?.scenes[0] ?? {}).sort()).toEqual([...CUSTOM_SCENE_KEYS].sort());
  });

  it('stops polling and shows cancelled state after cancelling a running task', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setAsyncSubmitScenario('/api/video/custom/async', 'success', 'task-custom-cancelled');
    setTaskScenario(
      'task-custom-cancelled',
      [
        buildTask('task-custom-cancelled', 'pending'),
        buildTask('task-custom-cancelled', 'running'),
      ],
      buildTask('task-custom-cancelled', 'cancelled', {
        error: 'Task cancelled',
        result: null,
      })
    );

    renderWithQueryClient(<CustomPage />);

    await screen.findByRole('heading', { name: '自定义资产' });
    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('排队中')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('生成中')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '取消任务' }));

    expect(await screen.findByRole('button', { name: '重新开始' })).toBeInTheDocument();
    const pollCountAfterCancel = getTaskPollCount('task-custom-cancelled');

    await new Promise((resolve) => window.setTimeout(resolve, 120));
    expect(getTaskPollCount('task-custom-cancelled')).toBe(pollCountAfterCancel);
  });
});

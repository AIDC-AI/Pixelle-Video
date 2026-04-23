import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import I2VPage from './page';
import { I2V_REQUEST_KEYS } from '../request-keys';
import { renderWithQueryClient, seedCurrentProject } from '@/tests/pipeline-page-test-utils';
import {
  buildTask,
  getLastI2VPayload,
  getTaskPollCount,
  resetMockApiState,
  setAsyncSubmitScenario,
  setTaskScenario,
} from '@/tests/msw/handlers';

let mockSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

describe('I2VPage', () => {
  beforeEach(async () => {
    resetMockApiState();
    mockSearchParams = new URLSearchParams('source_image=http://localhost:8000/api/files/source-image.png');
    await seedCurrentProject({ id: 'project-1', name: 'Test Project' });
  });

  it('submits, polls, and renders the generated video result via msw', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setAsyncSubmitScenario('/api/video/i2v/async', 'success', 'task-i2v-success');
    setTaskScenario('task-i2v-success', [buildTask('task-i2v-success', 'completed')]);

    renderWithQueryClient(<I2VPage />);

    await screen.findByRole('heading', { name: '图片转视频' });
    await user.type(screen.getByLabelText('运动提示词'), 'Slow camera push-in with drifting fog.');
    await user.click(screen.getByRole('combobox', { name: '画面方案' }));
    await user.click(await screen.findByText('基础画面方案'));
    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('生成结果')).toBeInTheDocument();
  });

  it('submits only supported I2VAsyncRequest fields', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setAsyncSubmitScenario('/api/video/i2v/async', 'success', 'task-i2v-payload');
    setTaskScenario('task-i2v-payload', [buildTask('task-i2v-payload', 'completed')]);

    renderWithQueryClient(<I2VPage />);

    await screen.findByRole('heading', { name: '图片转视频' });
    await user.type(screen.getByLabelText('运动提示词'), 'Animate the scene with a subtle parallax effect.');
    await user.click(screen.getByRole('combobox', { name: '画面方案' }));
    await user.click(await screen.findByText('基础画面方案'));
    await user.click(screen.getByRole('button', { name: '生成视频' }));

    await waitFor(() => {
      expect(getLastI2VPayload()).not.toBeNull();
    });

    const payload = getLastI2VPayload();
    expect(Object.keys(payload ?? {}).sort()).toEqual([...I2V_REQUEST_KEYS].sort());
    expect(payload).toMatchObject({
      media_workflow: 'selfhost/media_default.json',
      motion_prompt: 'Animate the scene with a subtle parallax effect.',
      project_id: 'project-1',
      source_image: 'http://localhost:8000/api/files/source-image.png',
    });
  });

  it('stops polling and shows cancelled state after cancelling a running task', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setAsyncSubmitScenario('/api/video/i2v/async', 'success', 'task-i2v-cancelled');
    setTaskScenario(
      'task-i2v-cancelled',
      [
        buildTask('task-i2v-cancelled', 'pending'),
        buildTask('task-i2v-cancelled', 'running'),
      ],
      buildTask('task-i2v-cancelled', 'cancelled', {
        error: 'Task cancelled',
        result: null,
      })
    );

    renderWithQueryClient(<I2VPage />);

    await screen.findByRole('heading', { name: '图片转视频' });
    await user.type(screen.getByLabelText('运动提示词'), 'Keep rendering so the cancel path can be exercised.');
    await user.click(screen.getByRole('combobox', { name: '画面方案' }));
    await user.click(await screen.findByText('基础画面方案'));
    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('排队中')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('生成中')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '取消任务' }));

    expect(await screen.findByRole('button', { name: '重新开始' })).toBeInTheDocument();
    const pollCountAfterCancel = getTaskPollCount('task-i2v-cancelled');

    await new Promise((resolve) => window.setTimeout(resolve, 120));
    expect(getTaskPollCount('task-i2v-cancelled')).toBe(pollCountAfterCancel);
  });
});

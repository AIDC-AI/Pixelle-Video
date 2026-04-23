import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActionTransferPage from './page';
import { ACTION_TRANSFER_REQUEST_KEYS } from '../request-keys';
import { renderWithQueryClient, seedCurrentProject } from '@/tests/pipeline-page-test-utils';
import {
  buildTask,
  getLastActionTransferPayload,
  getTaskPollCount,
  resetMockApiState,
  setAsyncSubmitScenario,
  setTaskScenario,
} from '@/tests/msw/handlers';

let mockSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

describe('ActionTransferPage', () => {
  beforeEach(async () => {
    resetMockApiState();
    mockSearchParams = new URLSearchParams(
      'driver_video=http://localhost:8000/api/files/driver.mp4&target_image=http://localhost:8000/api/files/target.png'
    );
    await seedCurrentProject({ id: 'project-1', name: 'Test Project' });
  });

  it('submits, polls, and renders the generated video result via msw', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setAsyncSubmitScenario('/api/video/action-transfer/async', 'success', 'task-action-transfer-success');
    setTaskScenario('task-action-transfer-success', [buildTask('task-action-transfer-success', 'completed')]);

    renderWithQueryClient(<ActionTransferPage />);

    await screen.findByRole('heading', { name: '舞蹈复刻' });
    await user.click(screen.getByRole('combobox', { name: '舞蹈复刻方案' }));
    await user.click(await screen.findByText('舞蹈复刻方案'));
    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('生成结果')).toBeInTheDocument();
  });

  it('submits only supported ActionTransferAsyncRequest fields', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setAsyncSubmitScenario('/api/video/action-transfer/async', 'success', 'task-action-transfer-payload');
    setTaskScenario('task-action-transfer-payload', [buildTask('task-action-transfer-payload', 'completed')]);

    renderWithQueryClient(<ActionTransferPage />);

    await screen.findByRole('heading', { name: '舞蹈复刻' });
    await user.click(screen.getByRole('combobox', { name: '舞蹈复刻方案' }));
    await user.click(await screen.findByText('舞蹈复刻方案'));
    await user.click(screen.getByRole('button', { name: '生成视频' }));

    await waitFor(() => {
      expect(getLastActionTransferPayload()).not.toBeNull();
    });

    const payload = getLastActionTransferPayload();
    expect(Object.keys(payload ?? {}).sort()).toEqual([...ACTION_TRANSFER_REQUEST_KEYS].sort());
    expect(payload).toMatchObject({
      driver_video: 'http://localhost:8000/api/files/driver.mp4',
      pose_workflow: 'selfhost/pose_default.json',
      project_id: 'project-1',
      target_image: 'http://localhost:8000/api/files/target.png',
    });
  });

  it('stops polling and shows cancelled state after cancelling a running task', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setAsyncSubmitScenario('/api/video/action-transfer/async', 'success', 'task-action-transfer-cancelled');
    setTaskScenario(
      'task-action-transfer-cancelled',
      [
        buildTask('task-action-transfer-cancelled', 'pending'),
        buildTask('task-action-transfer-cancelled', 'running'),
      ],
      buildTask('task-action-transfer-cancelled', 'cancelled', {
        error: 'Task cancelled',
        result: null,
      })
    );

    renderWithQueryClient(<ActionTransferPage />);

    await screen.findByRole('heading', { name: '舞蹈复刻' });
    await user.click(screen.getByRole('combobox', { name: '舞蹈复刻方案' }));
    await user.click(await screen.findByText('舞蹈复刻方案'));
    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('排队中')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('生成中')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '取消任务' }));

    expect(await screen.findByRole('button', { name: '重新开始' })).toBeInTheDocument();
    const pollCountAfterCancel = getTaskPollCount('task-action-transfer-cancelled');

    await new Promise((resolve) => window.setTimeout(resolve, 120));
    expect(getTaskPollCount('task-action-transfer-cancelled')).toBe(pollCountAfterCancel);
  });
});

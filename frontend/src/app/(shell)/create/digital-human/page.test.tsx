import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DigitalHumanPage from './page';
import { DIGITAL_HUMAN_REQUEST_KEYS } from '../request-keys';
import { renderWithQueryClient, seedCurrentProject } from '@/tests/pipeline-page-test-utils';
import {
  buildTask,
  getLastDigitalHumanPayload,
  getTaskPollCount,
  resetMockApiState,
  setAsyncSubmitScenario,
  setTaskScenario,
} from '@/tests/msw/handlers';

let mockSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

describe('DigitalHumanPage', () => {
  beforeEach(async () => {
    resetMockApiState();
    mockSearchParams = new URLSearchParams('portrait_url=http://localhost:8000/api/files/portrait.png');
    await seedCurrentProject({ id: 'project-1', name: 'Test Project' });
  });

  it('submits, polls, and renders the generated video result via msw', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setAsyncSubmitScenario('/api/video/digital-human/async', 'success', 'task-digital-human-success');
    setTaskScenario('task-digital-human-success', [buildTask('task-digital-human-success', 'completed')]);

    renderWithQueryClient(<DigitalHumanPage />);

    await screen.findByRole('heading', { name: '数字人' });
    await user.type(screen.getByLabelText('旁白'), 'Read this script in a confident presenter voice.');
    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('生成结果')).toBeInTheDocument();
  });

  it('submits only supported DigitalHumanAsyncRequest fields', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setAsyncSubmitScenario('/api/video/digital-human/async', 'success', 'task-digital-human-payload');
    setTaskScenario('task-digital-human-payload', [buildTask('task-digital-human-payload', 'completed')]);

    renderWithQueryClient(<DigitalHumanPage />);

    await screen.findByRole('heading', { name: '数字人' });
    await user.type(screen.getByLabelText('旁白'), 'Anchor the update with a short intro.');
    await user.click(screen.getByRole('combobox', { name: '配音方案' }));
    await user.click(await screen.findByText('Edge 配音方案'));
    await user.click(screen.getByRole('button', { name: '生成视频' }));

    await waitFor(() => {
      expect(getLastDigitalHumanPayload()).not.toBeNull();
    });

    const payload = getLastDigitalHumanPayload();
    expect(Object.keys(payload ?? {}).sort()).toEqual([...DIGITAL_HUMAN_REQUEST_KEYS].sort());
    expect(payload).toMatchObject({
      narration: 'Anchor the update with a short intro.',
      portrait_url: 'http://localhost:8000/api/files/portrait.png',
      project_id: 'project-1',
      voice_workflow: 'selfhost/tts_edge.json',
    });
  });

  it('stops polling and shows cancelled state after cancelling a running task', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setAsyncSubmitScenario('/api/video/digital-human/async', 'success', 'task-digital-human-cancelled');
    setTaskScenario(
      'task-digital-human-cancelled',
      [
        buildTask('task-digital-human-cancelled', 'pending'),
        buildTask('task-digital-human-cancelled', 'running'),
      ],
      buildTask('task-digital-human-cancelled', 'cancelled', {
        error: 'Task cancelled',
        result: null,
      })
    );

    renderWithQueryClient(<DigitalHumanPage />);

    await screen.findByRole('heading', { name: '数字人' });
    await user.type(screen.getByLabelText('旁白'), 'Keep this running long enough to cancel.');
    await user.click(screen.getByRole('button', { name: '生成视频' }));

    expect(await screen.findByText('排队中')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('生成中')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '取消任务' }));

    expect(await screen.findByRole('button', { name: '重新开始' })).toBeInTheDocument();
    const pollCountAfterCancel = getTaskPollCount('task-digital-human-cancelled');

    await new Promise((resolve) => window.setTimeout(resolve, 120));
    expect(getTaskPollCount('task-digital-human-cancelled')).toBe(pollCountAfterCancel);
  });
});

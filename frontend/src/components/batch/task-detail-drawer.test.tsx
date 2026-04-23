import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TaskDetailDrawer } from '@/components/batch/task-detail-drawer';

vi.mock('@/lib/hooks/use-task-list', () => ({
  useTaskDetail: () => ({
    data: {
      created_at: '2026-04-22T00:00:00Z',
      error: 'Generation failed',
      progress: { message: 'Failed', percentage: 100 },
      request_params: { title: 'Launch clip' },
      result: null,
      status: 'failed',
      task_id: 'task-failed',
    },
    isLoading: false,
  }),
}));

describe('TaskDetailDrawer', () => {
  it('shows task actions and copies params', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

    render(
      <TaskDetailDrawer
        open
        taskId="task-failed"
        onOpenChange={vi.fn()}
        onDelete={vi.fn()}
        onRetry={onRetry}
      />
    );

    expect(screen.getAllByText('task-failed').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '复制参数' }));
    expect(writeTextSpy).toHaveBeenCalledWith(JSON.stringify({ title: 'Launch clip' }, null, 2));

    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalledWith('task-failed');
  });
});

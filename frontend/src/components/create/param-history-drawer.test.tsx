import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ParamHistoryDrawer } from '@/components/create/param-history-drawer';

vi.mock('@/lib/hooks/use-task-history', () => ({
  useTaskHistory: () => ({
    isLoading: false,
    tasks: [
      {
        created_at: '2026-04-22T00:00:00Z',
        request_params: { title: 'History title' },
        result: null,
        task_id: 'task-1',
      },
    ],
  }),
}));

describe('ParamHistoryDrawer', () => {
  it('confirms before applying params from history', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const onApply = vi.fn();

    render(
      <ParamHistoryDrawer
        open
        onOpenChange={vi.fn()}
        pipeline="quick"
        projectId="project-1"
        mapTaskToParams={(task) => ({ title: (task.request_params as { title: string }).title })}
        onApply={onApply}
      />
    );

    await user.click(screen.getByRole('button', { name: /task-1/i }));
    expect(await screen.findByText('覆盖当前参数？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '应用参数' }));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith({ title: 'History title' });
    });
  });
});

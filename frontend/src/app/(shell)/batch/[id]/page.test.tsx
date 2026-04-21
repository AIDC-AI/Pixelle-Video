import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';

import Page from './page';
import { buildBatch, buildTask, setBatches, setTaskScenario } from '@/tests/msw/handlers';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'batch-running' }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('Batch Detail Page', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('renders batch detail with child tasks', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'Motion Batch' })).toBeInTheDocument();
    expect(screen.getByText('task-batch-running')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Batch' })).toBeInTheDocument();
  });

  it('cancels the batch and returns to the list', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderWithQueryClient(<Page />);
    await screen.findByRole('heading', { name: 'Motion Batch' });

    await user.click(screen.getByRole('button', { name: 'Cancel Batch' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/batch/list');
    });
  });

  it('shows successful output download links for terminal batches', async () => {
    setTaskScenario(
      'task-batch-complete',
      [
        buildTask('task-batch-complete', 'completed', {
          batch_id: 'batch-complete',
          project_id: 'project-1',
          result: {
            video_url: 'http://localhost:8000/api/files/output/task-batch-complete/final.mp4',
            video_path: '/output/task-batch-complete/final.mp4',
            duration: 9,
            file_size: 1024,
          },
        }),
      ]
    );
    setBatches([
      buildBatch(['task-batch-complete'], {
        id: 'batch-running',
        name: 'Completed Batch',
        pipeline: 'standard',
        project_id: 'project-1',
      }),
    ]);

    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'Completed Batch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Batch' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download Outputs' })).toHaveAttribute('href', '#successful-outputs');
  });

  it('routes child tasks to the correct detail destination', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderWithQueryClient(<Page />);
    await screen.findByText('task-batch-running');

    await user.click(screen.getByRole('button', { name: 'View' }));

    expect(mockPush).toHaveBeenCalledWith('/create/i2v?task_id=task-batch-running');
  });
});

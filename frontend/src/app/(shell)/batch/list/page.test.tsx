import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';

import Page from './page';
import { renderWithQueryClient, seedCurrentProject } from '@/tests/pipeline-page-test-utils';
import { buildBatch, setBatches } from '@/tests/msw/handlers';

let mockSearchParams = new URLSearchParams('');
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/batch/list',
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe('Batch List Page', () => {
  beforeEach(async () => {
    mockSearchParams = new URLSearchParams('');
    mockReplace.mockReset();
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders the batch table from the batch list endpoint', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'All Batches' })).toBeInTheDocument();
    expect(await screen.findByText('Launch Batch')).toBeInTheDocument();
    expect(screen.queryByText('Motion Batch')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Project filter' })).toHaveTextContent('Launch Campaign');
    });
  });

  it('respects the URL filters for project and status', async () => {
    mockSearchParams = new URLSearchParams('project_id=project-2&status=running');

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('Motion Batch')).toBeInTheDocument();
    expect(screen.queryByText('Launch Batch')).not.toBeInTheDocument();
  });

  it('cancels an active batch from the list view', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    mockSearchParams = new URLSearchParams('project_id=project-2&status=running');

    renderWithQueryClient(<Page />);
    expect(await screen.findByText('Motion Batch')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Motion Batch')).not.toBeInTheDocument();
    });
  });

  it('updates URL state when filters change', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    mockSearchParams = new URLSearchParams('project_id=project-1');

    renderWithQueryClient(<Page />);
    await screen.findByRole('heading', { name: 'All Batches' });

    await user.click(screen.getByRole('combobox', { name: 'Status filter' }));
    await user.click(await screen.findByRole('option', { name: 'Completed' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/batch/list?project_id=project-1&status=completed', { scroll: false });
    });
  });

  it('shows the empty state when filters return no rows', async () => {
    setBatches([
      buildBatch(['task-library-video-1'], {
        id: 'batch-filtered',
        name: 'Filtered Batch',
        project_id: 'project-1',
        pipeline: 'standard',
      }),
    ]);
    mockSearchParams = new URLSearchParams('project_id=project-2&status=failed');

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('No batches match these filters')).toBeInTheDocument();
  });
});

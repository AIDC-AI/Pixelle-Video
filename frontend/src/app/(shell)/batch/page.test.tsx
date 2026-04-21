import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import Page from './page';
import { buildBatch, setBatches } from '@/tests/msw/handlers';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';

describe('Batch Dashboard Page', () => {
  it('renders batch KPIs and the recent batch list', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'Batch Overview' })).toBeInTheDocument();
    expect(screen.getByText('Total Batches')).toBeInTheDocument();
    expect(await screen.findByText('Launch Batch')).toBeInTheDocument();
  });

  it('shows the empty state when no batches exist', async () => {
    setBatches([]);

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('No batches yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create Batch' })).toHaveAttribute('href', '/batch/new');
  });

  it('links to batch creation and the full batch list', async () => {
    setBatches([
      buildBatch(['task-library-video-1'], {
        id: 'batch-dashboard-link',
        name: 'Dashboard Link Batch',
        pipeline: 'standard',
      }),
    ]);

    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('link', { name: 'New Batch' })).toHaveAttribute('href', '/batch/new');
    expect(screen.getByRole('link', { name: 'View All' })).toHaveAttribute('href', '/batch/list');
  });
});

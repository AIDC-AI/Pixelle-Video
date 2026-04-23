import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import Page from './page';
import { buildBatch, setBatches } from '@/tests/msw/handlers';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';

describe('Batch Dashboard Page', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
  });

  it('renders batch KPIs and the recent batch list', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: '批处理总览' })).toBeInTheDocument();
    expect(screen.getByText('批处理总数')).toBeInTheDocument();
    expect(await screen.findByText('Launch Batch')).toBeInTheDocument();
  });

  it('shows the empty state when no batches exist', async () => {
    setBatches([]);

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('还没有批处理')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建批处理' })).toHaveAttribute('href', '/batch/new');
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

    expect(await screen.findByRole('link', { name: '新建批处理' })).toHaveAttribute('href', '/batch/new');
    expect(screen.getByRole('link', { name: '查看全部' })).toHaveAttribute('href', '/batch/list');
  });
});

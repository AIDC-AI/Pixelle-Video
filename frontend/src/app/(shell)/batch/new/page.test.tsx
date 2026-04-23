import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import Page from './page';
import { renderWithQueryClient, seedCurrentProject } from '@/tests/pipeline-page-test-utils';
import { server } from '@/tests/msw/server';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('Batch New Page', () => {
  beforeEach(async () => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockPush.mockReset();
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders the batch builder and preselects the current project', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: '新建批处理' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /快速创作/,
      })
    ).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: '目标项目' })).toHaveTextContent('Launch Campaign');
    });
  });

  it('submits a manual digital-human batch and redirects to the detail page', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderWithQueryClient(<Page />);
    await screen.findByRole('heading', { name: '新建批处理' });

    await user.click(screen.getByRole('button', { name: /数字人/ }));
    await user.type(screen.getByLabelText('人像图片 URL'), 'https://example.com/portrait.png');
    await user.type(screen.getByLabelText('旁白'), 'Hello from the batch builder.');
    await user.type(screen.getByLabelText('配音方案'), 'selfhost/tts_edge.json');

    await user.click(screen.getByRole('button', { name: '提交批处理' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/batch\/batch-/));
    });
  });

  it('parses a CSV preview and marks valid rows', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const csv = [
      'portrait_url,narration,voice_workflow',
      'https://example.com/portrait.png,Welcome,selfhost/tts_edge.json',
    ].join('\n');

    renderWithQueryClient(<Page />);
    await screen.findByRole('heading', { name: '新建批处理' });

    await user.click(screen.getByRole('button', { name: /数字人/ }));
    await user.click(screen.getByRole('button', { name: 'CSV 导入' }));
    await user.upload(screen.getByLabelText('CSV 文件'), new File([csv], 'digital-human.csv', { type: 'text/csv' }));

    expect(await screen.findByText('有效')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://example.com/portrait.png')).toBeInTheDocument();
  });

  it('shows a validation message for an invalid csv row', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const csv = ['driver_video,target_image,pose_workflow', 'invalid-url,https://example.com/target.png,selfhost/pose.json'].join('\n');

    renderWithQueryClient(<Page />);
    await screen.findByRole('heading', { name: '新建批处理' });

    await user.click(screen.getByRole('button', { name: /动作迁移/ }));
    await user.click(screen.getByRole('button', { name: 'CSV 导入' }));
    await user.upload(screen.getByLabelText('CSV 文件'), new File([csv], 'action-transfer.csv', { type: 'text/csv' }));

    expect(await screen.findByText('驱动视频 URL必须是有效 URL。')).toBeInTheDocument();
  });

  it('forces custom asset batches into csv mode', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderWithQueryClient(<Page />);
    await screen.findByRole('heading', { name: '新建批处理' });

    await user.click(screen.getByRole('button', { name: /自定义资产/ }));

    expect(
      screen.getByText('自定义资产批处理目前只支持 CSV 导入，因为每一行都包含 scenes 场景数组。')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '切换到 CSV 导入' }));

    expect(await screen.findByText('上传 CSV')).toBeInTheDocument();
  });

  it('surfaces CSV header validation errors', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const csv = ['portrait_url,wrong_header', 'https://example.com/portrait.png,value'].join('\n');

    renderWithQueryClient(<Page />);
    await screen.findByRole('heading', { name: '新建批处理' });

    await user.click(screen.getByRole('button', { name: /数字人/ }));
    await user.click(screen.getByRole('button', { name: 'CSV 导入' }));
    await user.upload(screen.getByLabelText('CSV 文件'), new File([csv], 'digital-human.csv', { type: 'text/csv' }));

    expect(await screen.findByText('缺少表头：narration, voice_workflow')).toBeInTheDocument();
    expect(screen.getByText('存在多余表头：wrong_header')).toBeInTheDocument();
  });

  it('surfaces an API error when batch creation fails', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    server.use(
      http.post('http://localhost:8000/api/batch', () =>
        HttpResponse.json(
          { detail: { code: 'BATCH_CREATE_FAILED', message: 'Unable to submit batch' } },
          { status: 500 }
        )
      )
    );

    renderWithQueryClient(<Page />);
    await screen.findByRole('heading', { name: '新建批处理' });

    await user.click(screen.getByRole('button', { name: /数字人/ }));
    await user.type(screen.getByLabelText('人像图片 URL'), 'https://example.com/portrait.png');
    await user.type(screen.getByLabelText('旁白'), 'Hello from the batch builder.');
    await user.click(screen.getByRole('button', { name: '提交批处理' }));

    await waitFor(() => {
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

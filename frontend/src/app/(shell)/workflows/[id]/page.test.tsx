import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './page';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';
import { server } from '@/tests/msw/server';

const mockParams = vi.fn(() => ({ id: encodeURIComponent('selfhost/media_default.json') }));
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

vi.mock('next/navigation', () => ({
  useParams: () => mockParams(),
}));

describe('Workflow Detail Page', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockParams.mockReturnValue({ id: encodeURIComponent('selfhost/media_default.json') });
  });

  it('renders workflow detail metadata', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: '基础画面方案' })).toBeInTheDocument();
    expect(screen.getByText('关键参数')).toBeInTheDocument();
    expect(screen.getByText('loader')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Read-only workflow graph preview' })).toBeInTheDocument();
  });

  it('shows an empty state for a missing workflow', async () => {
    mockParams.mockReturnValue({ id: encodeURIComponent('missing-workflow') });
    renderWithQueryClient(<Page />);

    expect(await screen.findByText('未找到工作流')).toBeInTheDocument();
  });

  it('shows the edit affordance for editable workflows and downloads JSON', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:workflow');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('button', { name: '保存技术配置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as Template' })).toBeInTheDocument();

    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElement = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return {
          click,
          set href(value: string) {},
          set download(value: string) {},
        } as unknown as HTMLAnchorElement;
      }

      return originalCreateElement(tagName);
    });

    await user.click(screen.getByRole('button', { name: '下载技术配置' }));

    expect(click).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:workflow');

    createElement.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('renders the read-only empty-parameters branch for a runninghub workflow', async () => {
    mockParams.mockReturnValue({ id: encodeURIComponent('runninghub/custom-workflow') });
    server.use(
      http.get(`${baseURL}/api/resources/workflows/:workflowId`, () =>
        HttpResponse.json({
          name: 'custom-workflow.json',
          display_name: 'RunningHub Custom',
          source: 'runninghub',
          path: '/workflows/runninghub/custom-workflow.json',
          key: 'runninghub/custom-workflow',
          workflow_id: 'rh-custom',
          editable: false,
          metadata: {},
          key_parameters: [],
          raw_nodes: [],
          workflow_json: {},
        })
      )
    );

    renderWithQueryClient(<Page />);

    expect((await screen.findAllByText('RunningHub')).length).toBeGreaterThan(0);
    expect(screen.getByText('当前没有可展示的关键参数。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存技术配置' })).not.toBeInTheDocument();
  });
});

import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import Page from './page';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';
import { server } from '@/tests/msw/server';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

describe('RunningHub Workflows Page', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
  });

  it('shows only runninghub workflows', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'RunningHub 工作流' })).toBeInTheDocument();
    expect(await screen.findByText('云端配音方案')).toBeInTheDocument();
    expect((await screen.findAllByText('outdated')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Edge 配音方案')).not.toBeInTheDocument();
  });

  it('shows an empty state when no runninghub workflows are returned', async () => {
    server.use(
      http.get(`${baseURL}/api/resources/workflows/tts`, () =>
        HttpResponse.json({
          success: true,
          message: 'Success',
          workflows: [{ name: 'tts_edge.json', display_name: 'TTS 1', source: 'selfhost', path: '/workflows/tts/tts_edge.json', key: 'selfhost/tts_edge.json', workflow_id: null }],
        })
      ),
      http.get(`${baseURL}/api/resources/workflows/media`, () =>
        HttpResponse.json({ success: true, message: 'Success', workflows: [] })
      ),
      http.get(`${baseURL}/api/resources/workflows/image`, () =>
        HttpResponse.json({ success: true, message: 'Success', workflows: [] })
      )
    );

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('暂无 RunningHub 工作流')).toBeInTheDocument();
  });
});

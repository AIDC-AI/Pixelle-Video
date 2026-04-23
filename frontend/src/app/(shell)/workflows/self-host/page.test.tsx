import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import Page from './page';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';
import { server } from '@/tests/msw/server';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

describe('Self-host Workflows Page', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
  });

  it('shows only self-host workflows', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: '本地工作流' })).toBeInTheDocument();
    expect(await screen.findByText('Edge 配音方案')).toBeInTheDocument();
    expect(screen.queryByText('云端配音方案')).not.toBeInTheDocument();
  });

  it('shows an empty state when no self-host workflows are returned', async () => {
    server.use(
      http.get(`${baseURL}/api/resources/workflows/tts`, () =>
        HttpResponse.json({ success: true, message: 'Success', workflows: [] })
      ),
      http.get(`${baseURL}/api/resources/workflows/media`, () =>
        HttpResponse.json({ success: true, message: 'Success', workflows: [] })
      ),
      http.get(`${baseURL}/api/resources/workflows/image`, () =>
        HttpResponse.json({ success: true, message: 'Success', workflows: [] })
      )
    );

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('暂无本地工作流')).toBeInTheDocument();
  });
});

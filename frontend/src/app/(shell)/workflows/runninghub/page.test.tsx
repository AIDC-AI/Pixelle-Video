import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import Page from './page';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';
import { server } from '@/tests/msw/server';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

describe('RunningHub Workflows Page', () => {
  it('shows only runninghub workflows', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'RunningHub Workflows' })).toBeInTheDocument();
    expect(await screen.findByText('TTS Cloud')).toBeInTheDocument();
    expect(screen.queryByText('TTS 1')).not.toBeInTheDocument();
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

    expect(await screen.findByText('No RunningHub workflows available')).toBeInTheDocument();
  });
});

import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import Page from './page';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';
import { server } from '@/tests/msw/server';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

describe('Self-host Workflows Page', () => {
  it('shows only self-host workflows', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'Self-host Workflows' })).toBeInTheDocument();
    expect(await screen.findByText('TTS 1')).toBeInTheDocument();
    expect(screen.queryByText('TTS Cloud')).not.toBeInTheDocument();
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

    expect(await screen.findByText('No self-host workflows available')).toBeInTheDocument();
  });
});

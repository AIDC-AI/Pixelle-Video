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
    mockPush.mockReset();
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders the batch builder and preselects the current project', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'New Batch' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /Quick.*Bulk-generate narrated short videos from text prompts and optional workflow overrides\./,
      })
    ).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Target project' })).toHaveTextContent('Launch Campaign');
    });
  });

  it('submits a manual digital-human batch and redirects to the detail page', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderWithQueryClient(<Page />);
    await screen.findByRole('heading', { name: 'New Batch' });

    await user.click(screen.getByRole('button', { name: /Digital Human/ }));
    await user.type(screen.getByLabelText('Portrait URL'), 'https://example.com/portrait.png');
    await user.type(screen.getByLabelText('Narration'), 'Hello from the batch builder.');
    await user.type(screen.getByLabelText('Voice Workflow'), 'selfhost/tts_edge.json');

    await user.click(screen.getByRole('button', { name: 'Submit Batch' }));

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
    await screen.findByRole('heading', { name: 'New Batch' });

    await user.click(screen.getByRole('button', { name: /Digital Human/ }));
    await user.click(screen.getByRole('button', { name: 'CSV Import' }));
    await user.upload(screen.getByLabelText('CSV file'), new File([csv], 'digital-human.csv', { type: 'text/csv' }));

    expect(await screen.findByText('Valid')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://example.com/portrait.png')).toBeInTheDocument();
  });

  it('shows a validation message for an invalid csv row', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const csv = ['driver_video,target_image,pose_workflow', 'invalid-url,https://example.com/target.png,selfhost/pose.json'].join('\n');

    renderWithQueryClient(<Page />);
    await screen.findByRole('heading', { name: 'New Batch' });

    await user.click(screen.getByRole('button', { name: /Action Transfer/ }));
    await user.click(screen.getByRole('button', { name: 'CSV Import' }));
    await user.upload(screen.getByLabelText('CSV file'), new File([csv], 'action-transfer.csv', { type: 'text/csv' }));

    expect(await screen.findByText('Driver Video URL must be a valid URL.')).toBeInTheDocument();
  });

  it('forces custom asset batches into csv mode', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderWithQueryClient(<Page />);
    await screen.findByRole('heading', { name: 'New Batch' });

    await user.click(screen.getByRole('button', { name: /Custom Asset/ }));

    expect(
      screen.getByText('Custom Asset batches currently support CSV import only because each row contains a scenes array.')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch to CSV Import' }));

    expect(await screen.findByText('Upload CSV')).toBeInTheDocument();
  });

  it('surfaces CSV header validation errors', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const csv = ['portrait_url,wrong_header', 'https://example.com/portrait.png,value'].join('\n');

    renderWithQueryClient(<Page />);
    await screen.findByRole('heading', { name: 'New Batch' });

    await user.click(screen.getByRole('button', { name: /Digital Human/ }));
    await user.click(screen.getByRole('button', { name: 'CSV Import' }));
    await user.upload(screen.getByLabelText('CSV file'), new File([csv], 'digital-human.csv', { type: 'text/csv' }));

    expect(await screen.findByText('Missing headers: narration, voice_workflow')).toBeInTheDocument();
    expect(screen.getByText('Unexpected headers: wrong_header')).toBeInTheDocument();
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
    await screen.findByRole('heading', { name: 'New Batch' });

    await user.click(screen.getByRole('button', { name: /Digital Human/ }));
    await user.type(screen.getByLabelText('Portrait URL'), 'https://example.com/portrait.png');
    await user.type(screen.getByLabelText('Narration'), 'Hello from the batch builder.');
    await user.click(screen.getByRole('button', { name: 'Submit Batch' }));

    await waitFor(() => {
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

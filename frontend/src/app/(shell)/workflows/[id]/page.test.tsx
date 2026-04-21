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
    mockParams.mockReturnValue({ id: encodeURIComponent('selfhost/media_default.json') });
  });

  it('renders workflow detail metadata', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'Media 1' })).toBeInTheDocument();
    expect(screen.getByText('Key Parameters')).toBeInTheDocument();
    expect(screen.getByText('loader')).toBeInTheDocument();
  });

  it('shows an empty state for a missing workflow', async () => {
    mockParams.mockReturnValue({ id: encodeURIComponent('missing-workflow') });
    renderWithQueryClient(<Page />);

    expect(await screen.findByText('Workflow not found')).toBeInTheDocument();
  });

  it('shows the edit affordance for editable workflows and downloads JSON', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:workflow');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('button', { name: 'Edit (P4+)' })).toBeDisabled();

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

    await user.click(screen.getByRole('button', { name: 'Download JSON' }));

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
        })
      )
    );

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('RunningHub')).toBeInTheDocument();
    expect(screen.getByText('No key parameters were exposed by the backend for this workflow.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit (P4+)' })).not.toBeInTheDocument();
  });
});

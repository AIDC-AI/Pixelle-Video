import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import Page from './page';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';

describe('Workflows Overview Page', () => {
  it('renders the default TTS catalog', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'Workflows' })).toBeInTheDocument();
    expect(await screen.findByText('TTS 1')).toBeInTheDocument();
  });

  it('switches tabs and shows media workflows', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('button', { name: 'Media' }));

    expect(await screen.findByText('Media 1')).toBeInTheDocument();
    expect(screen.getByText('RunningHub Motion')).toBeInTheDocument();
  });
});

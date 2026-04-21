import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import Page from './page';
import { setPresets } from '@/tests/msw/handlers';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';

describe('Presets Page', () => {
  it('shows built-in presets by default', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'Presets' })).toBeInTheDocument();
    expect(await screen.findByText('Creative LLM Preset')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'No create route' })).toBeDisabled();
  });

  it('switches to user presets and opens the JSON dialog', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('button', { name: 'My Presets' }));

    expect(await screen.findByText('Launch Quick Preset')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Create' })).toHaveAttribute(
      'href',
      expect.stringContaining('/create/quick?')
    );
    await user.click(screen.getByRole('button', { name: 'View JSON' }));

    expect(await screen.findByRole('heading', { name: 'Launch Quick Preset' })).toBeInTheDocument();
  });

  it('shows an empty state when the selected source has no presets', async () => {
    const user = userEvent.setup();
    setPresets([]);

    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('button', { name: 'My Presets' }));

    expect(await screen.findByText('No personal presets yet')).toBeInTheDocument();
  });
});

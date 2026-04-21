import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Page from './page';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';

describe('Templates Page', () => {
  it('renders template cards', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'Templates' })).toBeInTheDocument();
    expect(await screen.findByText('image_default.html')).toBeInTheDocument();
  });

  it('links templates into the Quick pipeline with frame_template', async () => {
    renderWithQueryClient(<Page />);

    const links = await screen.findAllByRole('link', { name: 'Use in Quick' });
    expect(links[0]).toHaveAttribute(
      'href',
      '/create/quick?frame_template=1080x1920%2Fimage_default.html'
    );
  });
});

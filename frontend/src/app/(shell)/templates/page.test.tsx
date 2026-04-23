import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import Page from './page';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';

describe('Templates Page', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
  });

  it('renders template cards', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: '模板画廊' })).toBeInTheDocument();
    expect(await screen.findByText('image_default.html')).toBeInTheDocument();
    expect(screen.getByText('适用于 1080 × 1920 画布尺寸。')).toBeInTheDocument();
  });

  it('links templates into the Quick pipeline with frame_template', async () => {
    renderWithQueryClient(<Page />);

    const links = await screen.findAllByRole('link', { name: '用于 Quick' });
    expect(links[0]).toHaveAttribute(
      'href',
      '/create/quick?frame_template=1080x1920%2Fimage_default.html'
    );
  });

  it('filters templates by search text and shows usage badges', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<Page />);

    expect(await screen.findByText('image_default.html')).toBeInTheDocument();
    expect(await screen.findAllByText(/uses/)).not.toHaveLength(0);

    await user.type(screen.getByLabelText('Search templates'), 'landscape');
    expect(await screen.findByText('landscape_default.html')).toBeInTheDocument();
    expect(screen.queryByText('image_default.html')).not.toBeInTheDocument();
  });
});

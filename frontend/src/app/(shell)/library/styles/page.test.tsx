import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './page';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';

let mockSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

describe('Library Styles Page', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockSearchParams = new URLSearchParams('');
  });

  it('renders the styles catalog', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: '风格' })).toBeInTheDocument();
    expect(await screen.findAllByRole('link', { name: '用于 Quick' })).not.toHaveLength(0);
  });

  it('opens a style detail dialog from the style_id search param', async () => {
    mockSearchParams = new URLSearchParams('style_id=style-1014');
    renderWithQueryClient(<Page />);

    expect(await screen.findByText('Keep the story concise and visually clear.')).toBeInTheDocument();
    expect((await screen.findAllByText('适合品牌发布、营销叙事和短视频复刻。')).length).toBeGreaterThan(0);
  });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import Page from './page';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';

describe('Workflows Overview Page', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    document.documentElement.lang = 'zh-CN';
  });

  it('renders the default TTS catalog', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: '生成方案库' })).toBeInTheDocument();
    expect(await screen.findByText('Edge 配音方案')).toBeInTheDocument();
  });

  it('switches tabs and shows media workflows', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('button', { name: '画面方案' }));

    expect(await screen.findByText('基础画面方案')).toBeInTheDocument();
    expect(screen.getByText('云端动态画面方案')).toBeInTheDocument();
  });
});

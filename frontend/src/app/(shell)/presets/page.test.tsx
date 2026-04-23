import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import Page from './page';
import { setPresets } from '@/tests/msw/handlers';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';

describe('Presets Page', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    document.documentElement.lang = 'zh-CN';
  });

  it('shows built-in presets by default', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: '预设库' })).toBeInTheDocument();
    expect(await screen.findByText('创意模型预设')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '内建预设' })).toBeInTheDocument();
    expect(screen.getByText('模型配置')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '创建' })).not.toBeInTheDocument();
  });

  it('switches to user presets and opens the JSON dialog', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('button', { name: '我的预设' }));

    expect(await screen.findByText('快速创作预设')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '我的预设' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '创建' })).toHaveAttribute(
      'href',
      expect.stringContaining('/create/quick?')
    );
    await user.click(screen.getByRole('button', { name: '查看 JSON' }));

    expect(await screen.findByRole('heading', { name: '快速创作预设' })).toBeInTheDocument();
  });

  it('shows an empty state when the selected source has no presets', async () => {
    const user = userEvent.setup();
    setPresets([]);

    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('button', { name: '我的预设' }));

    expect(await screen.findByText('还没有个人预设')).toBeInTheDocument();
  });

  it('compares two user presets and shows parent references', async () => {
    const user = userEvent.setup();
    setPresets([
      {
        name: 'Parent Preset',
        description: 'Parent',
        pipeline: 'quick',
        payload_template: { title: 'A', steps: 4 },
        created_at: '2026-04-22T00:00:00Z',
        source: 'user',
      },
      {
        name: 'Child Preset',
        description: 'Child',
        pipeline: 'quick',
        payload_template: { title: 'B', steps: 6, __metadata: { parent_name: 'Parent Preset' } },
        created_at: '2026-04-22T00:00:00Z',
        source: 'user',
      },
    ]);

    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('button', { name: '我的预设' }));
    expect(await screen.findByText('Based on Parent Preset')).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Select Parent/));
    await user.click(screen.getByLabelText(/Select Child/));
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(await screen.findByRole('heading', { name: 'Compare presets' })).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});

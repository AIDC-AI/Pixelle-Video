import { screen } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

import Page from './page';
import { buildLibraryBgmItem, setLibraryBgm } from '@/tests/msw/handlers';
import { renderWithQueryClient, seedCurrentProject } from '@/tests/pipeline-page-test-utils';

let mockSearchParams = new URLSearchParams('');
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/library/bgm',
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe('Library BGM Page', () => {
  beforeEach(async () => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockSearchParams = new URLSearchParams('');
    mockReplace.mockReset();
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('shows built-in tracks by default', async () => {
    mockSearchParams = new URLSearchParams('project_id=all');
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: '背景音乐' })).toBeInTheDocument();
    expect((await screen.findAllByText('发布故事默认背景音乐')).length).toBeGreaterThan(0);
  });

  it('switches to personal history and reuses a track in Quick', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setLibraryBgm([
      buildLibraryBgmItem('bgm-built-in-1', { source: 'builtin' }),
      buildLibraryBgmItem('bgm-history-hero', {
        source: 'history',
        audio_path: '/data/bgm/history-hero.mp3',
        project_id: 'project-1',
      }),
    ]);

    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('button', { name: '我的资源库' }));

    expect(await screen.findByText('背景音乐 bgm-history-hero')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '用于 Quick' })).toHaveAttribute(
      'href',
      '/create/quick?bgm_mode=custom&bgm_path=%2Fdata%2Fbgm%2Fhistory-hero.mp3'
    );
  });

  it('shows the personal-library empty state when no history tracks exist', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setLibraryBgm([
      buildLibraryBgmItem('bgm-built-in-only', {
        source: 'builtin',
      }),
    ]);

    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('button', { name: '我的资源库' }));

    expect(await screen.findByText('还没有个人 BGM 历史。')).toBeInTheDocument();
  });

  it('shows linked style actions for built-in tracks', async () => {
    mockSearchParams = new URLSearchParams('project_id=all');
    renderWithQueryClient(<Page />);

    expect((await screen.findAllByText('发布故事默认背景音乐')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '打开关联风格' })).toHaveAttribute(
      'href',
      '/library/styles?style_id=style-1014'
    );
    expect(screen.getByRole('link', { name: '用于 Quick' })).toHaveAttribute(
      'href',
      '/create/quick?style_id=style-1014&bgm_mode=default'
    );
  });

  it('loads more built-in tracks when another cursor page exists', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    mockSearchParams = new URLSearchParams('project_id=all');
    setLibraryBgm(
      Array.from({ length: 21 }, (_, index) =>
        buildLibraryBgmItem(`bgm-${index}`, {
          source: 'builtin',
          name: `Built-in ${index}`,
          display_name_zh: `内建曲目 ${index}`,
          technical_name: `Built-in ${index}`,
          created_at: `2026-04-22T${String(index).padStart(2, '0')}:00:00Z`,
        })
      )
    );

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('内建曲目 20')).toBeInTheDocument();
    expect(screen.queryByText('内建曲目 0')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '加载更多' }));

    expect(await screen.findByText('内建曲目 0')).toBeInTheDocument();
  });

  it('updates the URL when switching the project filter to Unassigned', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('combobox', { name: '项目' }));
    await user.click(await screen.findByRole('option', { name: '未分配' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/bgm?project_id=__unassigned__', { scroll: false });
    });
  });

  it('updates the URL when switching to a concrete project filter', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('combobox', { name: '项目' }));
    await user.click(await screen.findByRole('option', { name: 'Unreleased Experiments' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/bgm?project_id=project-2', { scroll: false });
    });
  });
});

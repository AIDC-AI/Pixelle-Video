import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './page';
import { buildScriptItem, setLibraryScripts } from '@/tests/msw/handlers';
import { renderWithQueryClient, seedCurrentProject } from '@/tests/pipeline-page-test-utils';

let mockSearchParams = new URLSearchParams('');
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/library/scripts',
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe('Library Scripts Page', () => {
  beforeEach(async () => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockSearchParams = new URLSearchParams('');
    mockReplace.mockReset();
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders scripts and binds the current project filter into the URL', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: '脚本' })).toBeInTheDocument();
    expect(await screen.findByText('Small habits compound into major creative momentum over time.')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/scripts?project_id=project-1', { scroll: false });
    });
  });

  it('builds a Quick reuse link from the script text', async () => {
    setLibraryScripts([
      buildScriptItem('script-quick', {
        text: 'Quick narration from script history.',
      }),
    ]);

    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('link', { name: '复用' })).toHaveAttribute(
      'href',
      '/create/quick?narration=Quick+narration+from+script+history.'
    );
  });

  it('toggles the full script view and falls back to Unknown pipeline when task data is missing', async () => {
    const user = userEvent.setup();
    setLibraryScripts([
      buildScriptItem('script-no-task', {
        task_id: 'missing-task',
        pipeline: null,
        pipeline_label_zh: null,
        summary_zh: '旁白草稿',
        text: 'Script with no matching task record.',
      }),
    ]);

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('未知')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '查看完整内容' }));
    expect((await screen.findAllByText('Script with no matching task record.')).length).toBe(2);

    await user.click(screen.getByRole('button', { name: '收起完整内容' }));
    expect(screen.queryByRole('button', { name: '收起完整内容' })).not.toBeInTheDocument();
  });

  it('shows the empty state when the current project has no script history', async () => {
    setLibraryScripts([
      buildScriptItem('script-project-2', {
        project_id: 'project-2',
        text: 'Other project script.',
      }),
    ]);

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('这个项目还没有脚本历史')).toBeInTheDocument();
  });

  it('updates the URL when switching the project filter to All Projects', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('combobox', { name: '项目' }));
    await user.click(await screen.findByRole('option', { name: '全部项目' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/scripts', { scroll: false });
    });
  });

  it('updates the URL when switching to a concrete project and hides the prompt subtitle when absent', async () => {
    const user = userEvent.setup();
    setLibraryScripts([
      buildScriptItem('script-no-prompt', {
        prompt_used: null,
        text: 'Script without prompt preview.',
        project_id: 'project-2',
      }),
    ]);

    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('combobox', { name: '项目' }));
    await user.click(await screen.findByRole('option', { name: 'Unreleased Experiments' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/scripts?project_id=project-2', { scroll: false });
    });

    expect(await screen.findByText('Script without prompt preview.')).toBeInTheDocument();
    expect(screen.queryByText('Narration generated from the launch concept.')).not.toBeInTheDocument();
  });
});

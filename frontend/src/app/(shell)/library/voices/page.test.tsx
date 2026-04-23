import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './page';
import { buildVoiceItem, setLibraryVoices } from '@/tests/msw/handlers';
import { renderWithQueryClient, seedCurrentProject } from '@/tests/pipeline-page-test-utils';

let mockSearchParams = new URLSearchParams('');
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/library/voices',
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe('Library Voices Page', () => {
  beforeEach(async () => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockSearchParams = new URLSearchParams('');
    mockReplace.mockReset();
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders voice rows and keeps the current project filter in the URL', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: '语音' })).toBeInTheDocument();
    expect(await screen.findByText('Edge 配音方案')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/voices?project_id=project-1', { scroll: false });
    });
  });

  it('builds a Digital Human reuse link from the stored text and voice workflow', async () => {
    setLibraryVoices([
      buildVoiceItem('voice-reuse', {
        text: 'Narration from voice history.',
        tts_voice: 'selfhost/tts_voice.json',
      }),
    ]);

    renderWithQueryClient(<Page />);

    const reuseLink = await screen.findByRole('link', { name: '复用' });
    expect(reuseLink).toHaveAttribute(
      'href',
      '/create/digital-human?narration=Narration+from+voice+history.&voice_workflow=selfhost%2Ftts_voice.json'
    );
  });

  it('shows the empty state when there are no voices for the current project', async () => {
    setLibraryVoices([
      buildVoiceItem('voice-project-2', {
        project_id: 'project-2',
        text: 'Other project voice.',
      }),
    ]);

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('这个项目还没有语音资产')).toBeInTheDocument();
  });

  it('loads the next page of voice history when available', async () => {
    const user = userEvent.setup();
    mockSearchParams = new URLSearchParams('project_id=all');
    setLibraryVoices(
      Array.from({ length: 17 }, (_, index) =>
        buildVoiceItem(`voice-${index}`, {
          text: `Voice history ${index}`,
          created_at: `2026-04-22T${String(index).padStart(2, '0')}:00:00Z`,
          project_id: index % 2 === 0 ? 'project-1' : null,
        })
      )
    );

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('Voice history 16')).toBeInTheDocument();
    expect(screen.queryByText('Voice history 0')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '加载更多' }));

    expect(await screen.findByText('Voice history 0')).toBeInTheDocument();
  });

  it('updates the URL when switching the project filter to Unassigned', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('combobox', { name: '项目' }));
    await user.click(await screen.findByRole('option', { name: '未分配' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/voices?project_id=__unassigned__', { scroll: false });
    });
  });

  it('handles concrete project selection and voice rows without transcript metadata', async () => {
    const user = userEvent.setup();
    setLibraryVoices([
      buildVoiceItem('voice-fallbacks', {
        text: null,
        tts_voice: null,
        project_id: 'project-2',
      }),
    ]);

    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('combobox', { name: '项目' }));
    await user.click(await screen.findByRole('option', { name: 'Unreleased Experiments' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/voices?project_id=project-2', { scroll: false });
    });

    expect(await screen.findByText('未命名配音方案')).toBeInTheDocument();
    expect(screen.getByText('没有文本快照')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '复用' })).toHaveAttribute('href', '/create/digital-human');
  });
});

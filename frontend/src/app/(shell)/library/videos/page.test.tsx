import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './page';
import { useCurrentProjectStore } from '@/stores/current-project';
import { buildVideoItem, setLibraryVideos } from '@/tests/msw/handlers';

let mockSearchParams = new URLSearchParams('');
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/library/videos',
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

async function seedCurrentProject(project: { id: string; name: string } | null) {
  if (project) {
    localStorage.setItem(
      'current-project-storage',
      JSON.stringify({
        state: { currentProject: project },
        version: 0,
      })
    );
  } else {
    localStorage.removeItem('current-project-storage');
  }

  useCurrentProjectStore.setState({ currentProject: project });

  await act(async () => {
    await useCurrentProjectStore.persist.rehydrate();
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <Page />
    </QueryClientProvider>
  );
}

describe('Library Videos Page', () => {
  beforeEach(async () => {
    mockSearchParams = new URLSearchParams('');
    mockReplace.mockReset();
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders video cards and binds the default filter to current project', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Videos' })).toBeInTheDocument();
    expect(await screen.findByText('Library Video')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/videos?project_id=project-1', { scroll: false });
    });
  });

  it('renders the unassigned filter from the URL state', async () => {
    mockSearchParams = new URLSearchParams('project_id=__unassigned__');

    renderPage();

    expect(await screen.findByText('Unassigned Clip')).toBeInTheDocument();
    expect(screen.queryByText('Library Video')).not.toBeInTheDocument();
  });

  it('shows the empty state when the selected project has no videos', async () => {
    mockSearchParams = new URLSearchParams('project_id=project-2');

    renderPage();

    expect(await screen.findByText('This project has no generated videos yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Create' })).toHaveAttribute('href', '/create');
  });

  it('updates the URL when the project filter changes', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    renderPage();
    await screen.findByRole('heading', { name: 'Videos' });
    await user.click(screen.getByRole('combobox', { name: 'Project filter' }));
    await user.click(screen.getByText('Unassigned'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/videos?project_id=__unassigned__', { scroll: false });
    });
  });

  it('loads the next cursor page when load more is clicked', async () => {
    setLibraryVideos(
      Array.from({ length: 13 }).map((_, index) =>
        buildVideoItem(`task-library-${index + 1}`, {
          title: `Library Clip ${index + 1}`,
          created_at: `2026-04-22T${String(12 - Math.min(index, 9)).padStart(2, '0')}:00:00Z`,
        })
      )
    );

    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderPage();

    expect(await screen.findByText('Library Clip 1')).toBeInTheDocument();
    expect(screen.queryByText('Library Clip 13')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load More' }));

    expect(await screen.findByText('Library Clip 13')).toBeInTheDocument();
  });
});

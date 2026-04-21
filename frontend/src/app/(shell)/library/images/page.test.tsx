import { screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './page';
import { buildImageItem, setLibraryImages } from '@/tests/msw/handlers';
import { renderWithQueryClient, seedCurrentProject } from '@/tests/pipeline-page-test-utils';

let mockSearchParams = new URLSearchParams('');
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/library/images',
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe('Library Images Page', () => {
  beforeEach(async () => {
    mockSearchParams = new URLSearchParams('');
    mockReplace.mockReset();
    await seedCurrentProject({ id: 'project-1', name: 'Launch Campaign' });
  });

  it('renders image cards and binds the default project filter to currentProject', async () => {
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'Images' })).toBeInTheDocument();
    expect(await screen.findByText('Sunlit portrait with soft cinematic lighting')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/images?project_id=project-1', { scroll: false });
    });
  });

  it('opens the preview dialog and exposes the reuse link', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setLibraryImages([
      buildImageItem('image-hero', {
        prompt_used: 'Hero portrait prompt',
        image_url: 'https://cdn.example.com/hero.png',
      }),
    ]);

    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('button', { name: 'Open image-hero' }));

    expect(await screen.findByRole('heading', { name: 'Reuse image asset' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reuse in Image → Video/i })).toHaveAttribute(
      'href',
      '/create/i2v?source_image=https%3A%2F%2Fcdn.example.com%2Fhero.png'
    );
  });

  it('shows the empty state when the active project has no indexed images', async () => {
    setLibraryImages([
      buildImageItem('image-project-2', {
        project_id: 'project-2',
        prompt_used: 'Only project 2 image',
      }),
    ]);

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('This project has no images yet.')).toBeInTheDocument();
  });

  it('loads the next cursor page when more images are available', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    mockSearchParams = new URLSearchParams('project_id=all');
    setLibraryImages(
      Array.from({ length: 13 }, (_, index) =>
        buildImageItem(`image-${index}`, {
          prompt_used: `Prompt ${index}`,
          created_at: `2026-04-22T${String(index).padStart(2, '0')}:00:00Z`,
          project_id: index % 2 === 0 ? 'project-1' : null,
        })
      )
    );

    renderWithQueryClient(<Page />);

    expect(await screen.findByText('Prompt 12')).toBeInTheDocument();
    expect(screen.queryByText('Prompt 0')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load More' }));

    expect(await screen.findByText('Prompt 0')).toBeInTheDocument();
  });

  it('updates the URL when switching the project filter to All Projects', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('combobox', { name: 'Project' }));
    await user.click(await screen.findByRole('option', { name: 'All Projects' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/images', { scroll: false });
    });
  });

  it('updates the URL when switching to a concrete project and disables copy without a prompt snapshot', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setLibraryImages([
      buildImageItem('image-no-prompt', {
        prompt_used: null,
        project_id: 'project-2',
      }),
    ]);

    renderWithQueryClient(<Page />);

    await user.click(await screen.findByRole('combobox', { name: 'Project' }));
    await user.click(await screen.findByRole('option', { name: 'Unreleased Experiments' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/library/images?project_id=project-2', { scroll: false });
    });

    await user.click(await screen.findByRole('button', { name: 'Open image-no-prompt' }));

    expect(await screen.findByText('No prompt snapshot stored for this asset.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Prompt' })).toBeDisabled();
  });
});

import { render, screen } from '@testing-library/react';
import { Film } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renders the optional action when provided', () => {
    render(
      <EmptyState
        icon={Film}
        title="No videos"
        description="Create one to get started."
        actionHref="/create"
        actionLabel="Go to Create"
      />
    );

    expect(screen.getByRole('heading', { name: 'No videos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Create' })).toHaveAttribute('href', '/create');
  });

  it('omits the action button when no action props are provided', () => {
    render(
      <EmptyState
        icon={Film}
        title="No videos"
        description="Create one to get started."
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});


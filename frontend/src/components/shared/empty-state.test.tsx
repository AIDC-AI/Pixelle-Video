import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Film } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { axe } from '@/tests/setup-axe';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('keeps the legacy link action API working', async () => {
    const { container } = render(
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
    expect(await axe(container)).toHaveNoViolations();
  });

  it('supports primary and secondary callback actions', async () => {
    const user = userEvent.setup();
    const primary = vi.fn();
    const secondary = vi.fn();

    render(
      <EmptyState
        icon={<Film className="size-10 text-muted-foreground" />}
        title="No videos yet"
        description="Create one to get started."
        action={{ label: 'Create video', onClick: primary }}
        secondaryAction={{ label: 'Learn more', onClick: secondary }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Create video' }));
    await user.click(screen.getByRole('button', { name: 'Learn more' }));

    expect(primary).toHaveBeenCalledTimes(1);
    expect(secondary).toHaveBeenCalledTimes(1);
  });
});

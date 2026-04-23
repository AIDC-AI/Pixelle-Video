import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { axe } from '@/tests/setup-axe';
import { ShortcutHelpDialog } from './shortcut-help-dialog';

describe('ShortcutHelpDialog', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
  });

  it('renders grouped shortcuts and filters them by query', async () => {
    const user = userEvent.setup();
    const { container } = render(<ShortcutHelpDialog open onOpenChange={() => undefined} />);

    expect(screen.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Open keyboard shortcuts')).toBeInTheDocument();
    expect(screen.getAllByText('⌘').length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText('Search shortcuts'), 'settings');

    expect(screen.getByText('Go to Settings')).toBeInTheDocument();
    expect(screen.queryByText('Go to Batch')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

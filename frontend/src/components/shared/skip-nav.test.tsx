import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { axe } from '@/tests/setup-axe';
import { SkipNav } from './skip-nav';

describe('SkipNav', () => {
  it('links to the main content landmark', async () => {
    const { container } = render(<SkipNav />);

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content');
    expect(await axe(container)).toHaveNoViolations();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { axe } from '@/tests/setup-axe';
import { Kbd } from './kbd';

describe('Kbd', () => {
  it('renders all keys in order', async () => {
    const { container } = render(<Kbd keys={['⌘', 'K']} />);

    expect(screen.getByText('⌘')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';

describe('Quick Create Page', () => {
  it('renders placeholder', () => {
    render(<Page />);
    expect(screen.getByRole('heading', { name: 'Quick Create' })).toBeInTheDocument();
  });
});

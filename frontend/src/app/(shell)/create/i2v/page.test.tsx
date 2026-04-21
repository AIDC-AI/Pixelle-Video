import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';

describe('Image to Video Page', () => {
  it('renders placeholder', () => {
    render(<Page />);
    expect(screen.getByRole('heading', { name: 'Image to Video' })).toBeInTheDocument();
  });
});

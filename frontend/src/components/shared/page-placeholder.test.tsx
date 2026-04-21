import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PagePlaceholder } from './page-placeholder';

describe('PagePlaceholder', () => {
  it('renders title and description', () => {
    render(<PagePlaceholder title="Test Title" description="Test Description" />);
    expect(screen.getByRole('heading', { name: 'Test Title' })).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
  });
});

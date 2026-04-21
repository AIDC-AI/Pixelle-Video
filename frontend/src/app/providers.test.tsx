import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Providers from './providers';

describe('Providers', () => {
  it('renders children wrapped in QueryClientProvider', () => {
    render(
      <Providers>
        <div data-testid="child">Provided</div>
      </Providers>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

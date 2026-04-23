import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MasonryGrid, MasonryGridItem } from './masonry-grid';

describe('MasonryGrid', () => {
  it('renders masonry items', () => {
    render(
      <MasonryGrid>
        <MasonryGridItem>Asset one</MasonryGridItem>
      </MasonryGrid>
    );

    expect(screen.getByText('Asset one')).toBeInTheDocument();
  });
});

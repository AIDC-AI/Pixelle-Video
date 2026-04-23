import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompareView } from './compare-view';

describe('CompareView', () => {
  it('renders selected assets and metadata diff rows', () => {
    render(
      <CompareView
        open
        onOpenChange={vi.fn()}
        items={[
          {
            id: 'image-1',
            kind: 'image',
            title: 'First image',
            url: '/first.png',
            metadata: { duration: 0, pipeline: 'i2v' },
          },
          {
            id: 'image-2',
            kind: 'image',
            title: 'Second image',
            url: '/second.png',
            metadata: { duration: 1, pipeline: 'quick' },
          },
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Compare selected assets' })).toBeInTheDocument();
    expect(screen.getAllByText('First image').length).toBeGreaterThan(0);
    expect(screen.getByText('pipeline')).toBeInTheDocument();
  });
});

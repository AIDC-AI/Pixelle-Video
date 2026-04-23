import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SkeletonDetail } from './skeleton-detail';

describe('SkeletonDetail', () => {
  it('renders a detail layout skeleton with shimmer blocks', () => {
    const { container } = render(<SkeletonDetail />);

    expect(container.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(5);
  });
});

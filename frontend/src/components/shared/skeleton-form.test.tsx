import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SkeletonForm } from './skeleton-form';

describe('SkeletonForm', () => {
  it('renders a shimmer row for each requested field', () => {
    const { container } = render(<SkeletonForm rows={3} />);

    expect(container.querySelectorAll('.skeleton-shimmer')).toHaveLength(6);
  });
});

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppToaster } from './toaster';

describe('AppToaster', () => {
  it('mounts without crashing', () => {
    const { container } = render(<AppToaster />);
    expect(container).toBeTruthy();
  });
});

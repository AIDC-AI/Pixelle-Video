import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SubmitSuccessToast } from '@/components/create/submit-success-toast';

describe('SubmitSuccessToast', () => {
  it('renders the queued task message and queue link', () => {
    render(<SubmitSuccessToast taskName="Launch clip" />);

    expect(screen.getByText('已加入队列')).toBeInTheDocument();
    expect(screen.getByText('Launch clip')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看队列' })).toHaveAttribute('href', '/batch/queue');
  });
});

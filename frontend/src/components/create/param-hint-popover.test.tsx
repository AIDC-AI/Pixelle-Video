import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ParamHintPopover } from '@/components/create/param-hint-popover';

describe('ParamHintPopover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens after 300ms hover delay and closes on leave', () => {
    render(
      <ParamHintPopover paramKey="quick.topic">
        <button type="button">Topic</button>
      </ParamHintPopover>
    );

    const [trigger] = screen.getAllByRole('button', { name: 'Topic' });

    fireEvent.mouseEnter(trigger);

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(screen.queryByText('Creative Brief')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Creative Brief')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByText('Creative Brief')).not.toBeInTheDocument();
  });
});

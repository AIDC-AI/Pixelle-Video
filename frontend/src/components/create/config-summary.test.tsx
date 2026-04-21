import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConfigSummary } from './config-summary';

describe('ConfigSummary', () => {
  it('formats strings, numbers, arrays, and objects for display', () => {
    render(
      <ConfigSummary
        config={{
          title: 'Project Title',
          duration: 5.5,
          scenes: [{ media: 'a' }, { media: 'b' }],
          tags: ['one', 'two'],
          metadata: { foo: 'bar', baz: 'qux' },
        }}
      />
    );

    expect(screen.getByText('Project Title')).toBeInTheDocument();
    expect(screen.getByText('5.5')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('one, two')).toBeInTheDocument();
    expect(screen.getByText('2 fields')).toBeInTheDocument();
  });

  it('omits null, undefined, and empty string values', () => {
    render(
      <ConfigSummary
        config={{
          empty: '',
          nullable: null,
          missing: undefined,
        }}
      />
    );

    expect(screen.queryByText('empty')).not.toBeInTheDocument();
    expect(screen.queryByText('nullable')).not.toBeInTheDocument();
    expect(screen.queryByText('missing')).not.toBeInTheDocument();
  });
});

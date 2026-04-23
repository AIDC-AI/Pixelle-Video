import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ConfigSummary } from './config-summary';
import { AppIntlProvider } from '@/lib/i18n';

describe('ConfigSummary', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
  });

  it('formats strings, numbers, arrays, and objects for display', () => {
    render(
      <AppIntlProvider>
        <ConfigSummary
          config={{
            title: 'Project Title',
            duration: 5.5,
            scenes: [{ media: 'a' }, { media: 'b' }],
            tags: ['one', 'two'],
            metadata: { foo: 'bar', baz: 'qux' },
          }}
        />
      </AppIntlProvider>
    );

    expect(screen.getByText('Project Title')).toBeInTheDocument();
    expect(screen.getByText('5.5')).toBeInTheDocument();
    expect(screen.getByText('2 项')).toBeInTheDocument();
    expect(screen.getByText('one, two')).toBeInTheDocument();
    expect(screen.getByText('2 个字段')).toBeInTheDocument();
  });

  it('omits null, undefined, and empty string values', () => {
    render(
      <AppIntlProvider>
        <ConfigSummary
          config={{
            empty: '',
            nullable: null,
            missing: undefined,
          }}
        />
      </AppIntlProvider>
    );

    expect(screen.queryByText('empty')).not.toBeInTheDocument();
    expect(screen.queryByText('nullable')).not.toBeInTheDocument();
    expect(screen.queryByText('missing')).not.toBeInTheDocument();
  });
});

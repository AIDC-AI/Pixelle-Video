import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PresetDiffView } from './preset-diff-view';

describe('PresetDiffView', () => {
  it('renders added, removed, and changed values', () => {
    render(
      <PresetDiffView
        presetA={{ prompt: 'old', steps: 4, removed: true }}
        presetB={{ prompt: 'new', steps: 4, added: 'yes' }}
      />
    );

    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('Changed')).toBeInTheDocument();
    expect(screen.getByText('prompt')).toBeInTheDocument();
    expect(screen.getByText('old')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();
  });
});

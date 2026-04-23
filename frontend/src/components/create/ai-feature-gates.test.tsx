import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AI_PREVIEW_STORAGE_KEY,
  AI_PROMPT_ASSIST_STORAGE_KEY,
} from '@/lib/hooks/use-ai-features';
import { AiFeatureGates } from './ai-feature-gates';

describe('AiFeatureGates', () => {
  it('renders nothing when AI features are disabled', () => {
    const { container } = render(<AiFeatureGates />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders preview and rewrite placeholders when enabled', () => {
    localStorage.setItem(AI_PREVIEW_STORAGE_KEY, 'true');
    localStorage.setItem(AI_PROMPT_ASSIST_STORAGE_KEY, 'true');

    render(<AiFeatureGates />);

    expect(screen.getByText('Real-time preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI rewrite unavailable until backend ships' })).toBeDisabled();
  });
});

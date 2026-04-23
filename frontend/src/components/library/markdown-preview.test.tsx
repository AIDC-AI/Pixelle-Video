import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MarkdownPreview } from './markdown-preview';

describe('MarkdownPreview', () => {
  it('renders markdown, stats, and editor changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MarkdownPreview markdown={'## Title\n\nHello world'} onChange={onChange} />);

    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('3 words')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Markdown editor'), '!');
    expect(onChange).toHaveBeenCalled();
  });
});

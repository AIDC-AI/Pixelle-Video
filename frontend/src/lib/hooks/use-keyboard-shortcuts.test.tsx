import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useKeyboardShortcuts } from './use-keyboard-shortcuts';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

function Harness({
  onCloseTopLayer = vi.fn(),
  onOpenCommandPalette = vi.fn(),
  onToggleShortcutHelp = vi.fn(),
}: {
  onCloseTopLayer?: () => void;
  onOpenCommandPalette?: () => void;
  onToggleShortcutHelp?: () => void;
}) {
  useKeyboardShortcuts({ onCloseTopLayer, onOpenCommandPalette, onToggleShortcutHelp });

  return (
    <div>
      <input aria-label="Project name" />
      <button type="button">Focusable</button>
    </div>
  );
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('navigates with g+letter sequences and opens shell overlays', () => {
    const onOpenCommandPalette = vi.fn();
    const onToggleShortcutHelp = vi.fn();
    const onCloseTopLayer = vi.fn();
    render(
      <Harness
        onCloseTopLayer={onCloseTopLayer}
        onOpenCommandPalette={onOpenCommandPalette}
        onToggleShortcutHelp={onToggleShortcutHelp}
      />
    );

    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'h' });
    expect(mockPush).toHaveBeenCalledWith('/');

    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', metaKey: true });
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: '/', code: 'Slash', metaKey: true });
    fireEvent.keyDown(window, { key: '?' });
    expect(onToggleShortcutHelp).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseTopLayer).toHaveBeenCalledTimes(1);
  });

  it('ignores navigation shortcuts inside editable fields but still allows Escape', () => {
    const onCloseTopLayer = vi.fn();
    render(<Harness onCloseTopLayer={onCloseTopLayer} onToggleShortcutHelp={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: 'Project name' });
    input.focus();

    fireEvent.keyDown(input, { key: 'g' });
    fireEvent.keyDown(input, { key: 'h' });
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCloseTopLayer).toHaveBeenCalledTimes(1);
  });
});

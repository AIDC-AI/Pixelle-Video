'use client';

import { useEffect } from 'react';
import { createKeybindingsHandler } from 'tinykeys';
import { useRouter } from 'next/navigation';

export type ShortcutGroupId = 'actions' | 'general' | 'navigation';

export interface ShortcutItem {
  description: string;
  group: ShortcutGroupId;
  id: string;
  keys: {
    default: string[];
    mac?: string[];
  };
  shortcut: string;
}

export const SHORTCUT_ITEMS: ShortcutItem[] = [
  {
    id: 'go-home',
    group: 'navigation',
    description: 'Go to Home',
    shortcut: 'g h',
    keys: { default: ['G', 'H'] },
  },
  {
    id: 'go-create',
    group: 'navigation',
    description: 'Go to Create',
    shortcut: 'g c',
    keys: { default: ['G', 'C'] },
  },
  {
    id: 'go-batch',
    group: 'navigation',
    description: 'Go to Batch',
    shortcut: 'g b',
    keys: { default: ['G', 'B'] },
  },
  {
    id: 'go-library',
    group: 'navigation',
    description: 'Go to Library',
    shortcut: 'g l',
    keys: { default: ['G', 'L'] },
  },
  {
    id: 'go-workflows',
    group: 'navigation',
    description: 'Go to Workflows',
    shortcut: 'g w',
    keys: { default: ['G', 'W'] },
  },
  {
    id: 'go-settings',
    group: 'navigation',
    description: 'Go to Settings',
    shortcut: 'g s',
    keys: { default: ['G', 'S'] },
  },
  {
    id: 'open-help',
    group: 'actions',
    description: 'Open keyboard shortcuts',
    shortcut: '$mod+Slash',
    keys: {
      default: ['Ctrl', '/'],
      mac: ['⌘', '/'],
    },
  },
  {
    id: 'open-command-palette',
    group: 'actions',
    description: 'Open command palette',
    shortcut: '$mod+k',
    keys: {
      default: ['Ctrl', 'K'],
      mac: ['⌘', 'K'],
    },
  },
  {
    id: 'close-layer',
    group: 'general',
    description: 'Close dialog or drawer',
    shortcut: 'Escape',
    keys: { default: ['Esc'] },
  },
];

export interface UseKeyboardShortcutsOptions {
  onCloseTopLayer?: () => void;
  onOpenCommandPalette?: () => void;
  onToggleShortcutHelp: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
    target.getAttribute('role') === 'textbox'
  );
}

export function isMacPlatform(platform?: string): boolean {
  return /mac/i.test(platform ?? navigator.platform ?? '');
}

export function getShortcutKeys(item: ShortcutItem, platform?: string): string[] {
  return isMacPlatform(platform) ? item.keys.mac ?? item.keys.default : item.keys.default;
}

export function useKeyboardShortcuts({
  onCloseTopLayer,
  onOpenCommandPalette,
  onToggleShortcutHelp,
}: UseKeyboardShortcutsOptions) {
  const router = useRouter();

  useEffect(() => {
    const handler = createKeybindingsHandler(
      {
        '$mod+k': (event) => {
          event.preventDefault();
          onOpenCommandPalette?.();
        },
        '$mod+Slash': (event) => {
          event.preventDefault();
          onToggleShortcutHelp();
        },
        Escape: () => {
          onCloseTopLayer?.();
        },
        'g h': (event) => {
          event.preventDefault();
          router?.push('/');
        },
        'g c': (event) => {
          event.preventDefault();
          router?.push('/create');
        },
        'g b': (event) => {
          event.preventDefault();
          router?.push('/batch');
        },
        'g l': (event) => {
          event.preventDefault();
          router?.push('/library/videos');
        },
        'g w': (event) => {
          event.preventDefault();
          router?.push('/workflows');
        },
        'g s': (event) => {
          event.preventDefault();
          router?.push('/settings');
        },
      },
      { timeout: 500 }
    );

    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenCommandPalette?.();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.code === 'Slash') {
        event.preventDefault();
        onToggleShortcutHelp();
        return;
      }

      if (event.key === '?' && !isEditableTarget(event.target)) {
        event.preventDefault();
        onToggleShortcutHelp();
        return;
      }

      if (event.key !== 'Escape' && isEditableTarget(event.target)) {
        return;
      }

      handler(event);
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onCloseTopLayer, onOpenCommandPalette, onToggleShortcutHelp, router]);
}

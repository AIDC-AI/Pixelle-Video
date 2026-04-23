'use client';

import { Grid2X2, List } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type LibraryView = 'grid' | 'list';

interface ViewToggleProps {
  onViewChange: (view: LibraryView) => void;
  view: LibraryView;
}

const STORAGE_PREFIX = 'pixelle-library-view';

export function getLibraryViewStorageKey(type: string): string {
  return `${STORAGE_PREFIX}-${type}`;
}

export function readLibraryView(type: string, fallback: LibraryView = 'grid'): LibraryView {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = window.localStorage.getItem(getLibraryViewStorageKey(type));
  return value === 'list' || value === 'grid' ? value : fallback;
}

export function writeLibraryView(type: string, view: LibraryView): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getLibraryViewStorageKey(type), view);
}

export function ViewToggle({ onViewChange, view }: ViewToggleProps) {
  const options: Array<{ icon: typeof Grid2X2; label: string; value: LibraryView }> = [
    { icon: Grid2X2, label: 'Grid view', value: 'grid' },
    { icon: List, label: 'List view', value: 'list' },
  ];

  return (
    <div className="inline-flex rounded-lg border border-border bg-background p-1" aria-label="Library view">
      {options.map((option) => {
        const Icon = option.icon;
        const active = view === option.value;

        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={option.label}
            aria-pressed={active}
            className={cn(active && 'bg-accent text-accent-foreground')}
            onClick={() => onViewChange(option.value)}
          >
            <Icon className="size-4" />
          </Button>
        );
      })}
    </div>
  );
}

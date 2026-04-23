'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StarButtonProps {
  onToggle: () => void;
  size?: 'sm' | 'md';
  starred: boolean;
}

export function getStarStorageKey(type: string, id: string): string {
  return `pixelle-starred-${type}-${id}`;
}

export function readStarredAsset(type: string, id: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(getStarStorageKey(type, id)) === 'true';
}

export function writeStarredAsset(type: string, id: string, starred: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  const key = getStarStorageKey(type, id);
  if (starred) {
    window.localStorage.setItem(key, 'true');
  } else {
    window.localStorage.removeItem(key);
  }
}

export function useStarredAsset(type: string, id: string) {
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    setStarred(readStarredAsset(type, id));
  }, [id, type]);

  const toggleStarred = () => {
    setStarred((current) => {
      const nextValue = !current;
      writeStarredAsset(type, id, nextValue);
      return nextValue;
    });
  };

  return { starred, toggleStarred };
}

export function StarButton({ onToggle, size = 'md', starred }: StarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={size === 'sm' ? 'icon-sm' : 'icon'}
      aria-label={starred ? 'Remove from starred' : 'Add to starred'}
      aria-pressed={starred}
      className={cn(starred && 'text-amber-500 hover:text-amber-600')}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <Star className={cn('size-4', starred && 'fill-current')} />
    </Button>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TagFilterProps {
  onChange: (selected: string[]) => void;
  selected: string[];
  tags: string[];
}

export function TagFilter({ onChange, selected, tags }: TagFilterProps) {
  const uniqueTags = Array.from(new Set(tags.filter(Boolean))).sort((left, right) => left.localeCompare(right));

  const toggleTag = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag]);
  };

  if (uniqueTags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-foreground">Tags</span>
      {uniqueTags.map((tag) => {
        const active = selected.includes(tag);

        return (
          <button
            key={tag}
            type="button"
            aria-pressed={active}
            className={cn(
              'rounded-full border border-border px-3 py-1 text-xs transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        );
      })}
      {selected.length > 0 ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}

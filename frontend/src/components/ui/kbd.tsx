import { cn } from '@/lib/utils';

export interface KbdProps {
  className?: string;
  keys: string[];
}

export function Kbd({ className, keys }: KbdProps) {
  return (
    <span data-slot="kbd" className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key) => (
        <kbd
          key={`${key}-${keys.join('-')}`}
          className="inline-flex min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

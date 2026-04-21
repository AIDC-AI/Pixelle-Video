'use client';

import { cn } from '@/lib/utils';

type ProgressSegment = {
  value: number;
  className: string;
};

export function BatchProgressBar({
  cancelled,
  failed,
  succeeded,
  total,
  className,
}: {
  cancelled: number;
  failed: number;
  succeeded: number;
  total: number;
  className?: string;
}) {
  const safeTotal = total > 0 ? total : 0;
  const segments: ProgressSegment[] =
    safeTotal > 0
      ? [
          { value: (succeeded / safeTotal) * 100, className: 'bg-[hsl(145,70%,40%)]' },
          { value: (failed / safeTotal) * 100, className: 'bg-[hsl(3,80%,56%)]' },
          { value: (cancelled / safeTotal) * 100, className: 'bg-[hsl(220,10%,38%)]' },
        ].filter((segment) => segment.value > 0)
      : [];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="h-2 overflow-hidden rounded-full bg-muted/60">
        <div className="flex h-full w-full">
          {segments.map((segment, index) => (
            <div
              key={`${segment.className}-${index}`}
              className={segment.className}
              style={{ width: `${segment.value}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>Success {succeeded}</span>
        <span>Failed {failed}</span>
        <span>Cancelled {cancelled}</span>
        <span>Total {total}</span>
      </div>
    </div>
  );
}

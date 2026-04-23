import { cn } from '@/lib/utils';

export function SkeletonCard({
  aspectClassName = 'aspect-[9/16]',
  className,
  rows = 2,
}: {
  aspectClassName?: string;
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border/70 bg-card', className)}>
      <div className={cn('skeleton-shimmer', aspectClassName)} />
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={`skeleton-card-row-${index}`}
            className={cn(
              'skeleton-shimmer h-4 rounded',
              index === rows - 1 ? 'w-1/2' : 'w-4/5'
            )}
          />
        ))}
      </div>
    </div>
  );
}

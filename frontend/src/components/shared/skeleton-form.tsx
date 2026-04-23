import { cn } from '@/lib/utils';

export function SkeletonForm({
  className,
  rows = 4,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn('space-y-5 rounded-2xl border border-border/70 bg-card p-6', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={`skeleton-form-row-${index}`} className="space-y-2">
          <div className="skeleton-shimmer h-3 w-24 rounded" />
          <div className="skeleton-shimmer h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

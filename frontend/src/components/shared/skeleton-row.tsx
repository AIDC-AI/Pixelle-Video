import { cn } from '@/lib/utils';

export function SkeletonRow({
  cellCount,
  className,
  gridClassName,
  heightClassName = 'h-4',
}: {
  cellCount: number;
  className?: string;
  gridClassName: string;
  heightClassName?: string;
}) {
  return (
    <div className={cn(gridClassName, 'gap-4 border-b border-border/60 px-4 py-4 last:border-none', className)}>
      {Array.from({ length: cellCount }).map((_, index) => (
        <div key={`skeleton-row-cell-${index}`} className={cn(heightClassName, 'skeleton-shimmer rounded')} />
      ))}
    </div>
  );
}

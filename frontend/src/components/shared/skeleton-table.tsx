import { SkeletonRow } from '@/components/shared/skeleton-row';

export function SkeletonTable({
  cellCount,
  gridClassName,
  rows = 5,
}: {
  cellCount: number;
  gridClassName: string;
  rows?: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonRow
          key={`skeleton-table-row-${index}`}
          cellCount={cellCount}
          gridClassName={gridClassName}
        />
      ))}
    </div>
  );
}

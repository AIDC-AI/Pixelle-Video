import { cn } from '@/lib/utils';

export function SkeletonDetail({ className }: { className?: string }) {
  return (
    <div className={cn('grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]', className)}>
      <div className="space-y-6 rounded-2xl border border-border/70 bg-card p-6">
        <div className="skeleton-shimmer h-8 w-56 rounded" />
        <div className="skeleton-shimmer aspect-[16/9] w-full rounded-2xl" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`skeleton-detail-stat-${index}`} className="space-y-2 rounded-2xl border border-border/70 p-4">
              <div className="skeleton-shimmer h-3 w-20 rounded" />
              <div className="skeleton-shimmer h-6 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>

      <aside className="space-y-4 rounded-2xl border border-border/70 bg-card p-6">
        <div className="skeleton-shimmer h-5 w-28 rounded" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`skeleton-detail-sidebar-${index}`} className="space-y-2">
            <div className="skeleton-shimmer h-3 w-24 rounded" />
            <div className="skeleton-shimmer h-10 w-full rounded-xl" />
          </div>
        ))}
      </aside>
    </div>
  );
}

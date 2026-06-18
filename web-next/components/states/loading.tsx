import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/design/cn";

/**
 * Loading state — used while data is being fetched.
 * Per spec: keep the animation minimal, prefer skeletons over spinners.
 */
export function LoadingState({
  rows = 3,
  className,
  label,
}: {
  rows?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
      className={cn("space-y-2", className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-primary-200 border-t-brand-primary-700",
        className,
      )}
      aria-hidden
    />
  );
}

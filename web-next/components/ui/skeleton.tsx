import { cn } from "@/lib/design/cn";

/**
 * Skeleton — neutral-tone shimmering placeholder.
 * Use for list rows, card bodies, and KPI numbers.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} aria-hidden />;
}

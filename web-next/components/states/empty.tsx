import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * EmptyState — per spec:
 * - navy-muted icon
 * - navy heading
 * - muted description
 * - max 1 gradient CTA
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-0 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-brand-primary-50">
        <Icon className="h-8 w-8 text-brand-primary-300" aria-hidden />
      </div>
      <h3 className="mt-5 text-h4 text-text-heading">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-body-sm text-text-muted">
          {description}
        </p>
      ) : null}
      {actionLabel && onAction ? (
        <div className="mt-6">
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

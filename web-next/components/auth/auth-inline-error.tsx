"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/design/cn";

export function AuthInlineError({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-error/30 bg-error-soft px-4 py-3",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-error"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-semibold text-error">{title}</p>
          {description ? (
            <p className="mt-0.5 text-body-sm text-text-body">{description}</p>
          ) : null}
          {action ? <div className="mt-2">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

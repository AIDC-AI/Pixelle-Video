"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * ErrorState — surfaces a problem with a clear next action.
 * Per spec: semantic error, never gradient brand red.
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-error/30 bg-error-soft px-6 py-8 text-center"
    >
      <AlertTriangle className="mx-auto h-10 w-10 text-error" aria-hidden />
      <h3 className="mt-4 text-h4 text-text-heading">{title}</h3>
      {description ? (
        <p className="mt-2 text-body-sm text-text-body">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <div className="mt-6">
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import * as React from "react";
import { cn } from "@/lib/design/cn";

/**
 * SectionCard — a structured, bounded region on a page. More opinionated
 * than the bare `Card`: it enforces a consistent title→description→body
 * rhythm so every page section reads the same way.
 *
 * Variant tokens — no hard-coded hex:
 * - `surface` (default): white card with standard border
 * - `featured`: subtle gradient bg, brand border
 * - `accent`: left accent bar for emphasis (e.g. progress, result)
 */
export interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  /** Left-border accent stripe — use for status/result sections. */
  accent?: "info" | "success" | "warning" | "error" | false;
  variant?: "surface" | "featured";
}

export function SectionCard({
  title,
  description,
  accent,
  variant = "surface",
  className,
  children,
  ...props
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-lg border bg-neutral-0 shadow-1",
        variant === "featured"
          ? "border-brand-primary-100 bg-surface-soft"
          : "border-neutral-200",
        accent === "info" && "border-l-4 border-l-brand-primary-600",
        accent === "success" && "border-l-4 border-l-success",
        accent === "warning" && "border-l-4 border-l-warning",
        accent === "error" && "border-l-4 border-l-error",
        className,
      )}
      {...props}
    >
      {title || description ? (
        <div className="border-b border-neutral-100 px-5 py-4">
          {title ? (
            <h3 className="text-h4 text-text-heading">{title}</h3>
          ) : null}
          {description ? (
            <p className="mt-0.5 text-body-sm text-text-muted">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

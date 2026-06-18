import * as React from "react";
import { cn } from "@/lib/design/cn";

/**
 * PageHeader — consistent page-level title with optional breadcrumb trail
 * and action area. Use on every workspace page for visual consistency.
 *
 * All color values are Tailwind token classes; no hard-coded hex.
 */
export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Breadcrumb trail segments shown before the title. */
  breadcrumbs?: Array<{ label: string; href?: string }>;
  /** Optional action slot (button group, filter bar, etc.). */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 sm:mb-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-body-sm text-text-muted">
            {breadcrumbs.map((crumb, i) => (
              <li key={crumb.label} className="flex items-center gap-1">
                {i > 0 ? (
                  <span aria-hidden className="select-none text-neutral-300">
                    /
                  </span>
                ) : null}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="hover:text-brand-primary-700 hover:underline"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-h2 text-text-heading sm:text-h1">{title}</h1>
          {description ? (
            <p className="mt-1 text-body-sm text-text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-3">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

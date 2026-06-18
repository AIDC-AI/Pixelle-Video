"use client";

import { cn } from "@/lib/design/cn";

export interface AuthFeatureCardProps {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  description?: string;
  className?: string;
}

export function AuthFeatureCard({
  icon: Icon,
  label,
  description,
  className,
}: AuthFeatureCardProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-brand-primary-100/60 bg-neutral-0/60 px-4 py-3 shadow-1 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-0/80 hover:shadow-2",
        className,
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary-50">
        <Icon className="h-4 w-4 text-brand-primary-600" aria-hidden />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-body-sm font-semibold text-text-heading">{label}</p>
        {description ? (
          <p className="mt-0.5 text-caption text-text-muted">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export function AuthFeaturePill({
  icon: Icon,
  label,
  className,
}: Omit<AuthFeatureCardProps, "description">) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-brand-primary-100/60 bg-neutral-0/60 px-3 py-1.5 shadow-1 backdrop-blur-sm",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 text-brand-primary-600" aria-hidden />
      <span className="text-caption font-medium text-text-heading">
        {label}
      </span>
    </div>
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/design/cn";

/**
 * Badge / Tag — per spec:
 * - info   → brand-primary-50 bg + brand-primary-700 text
 * - accent → gold-soft bg + navy text
 * - success/warning/error/danger → semantic colors
 * - neutral → subtle gray
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-caption font-medium",
  {
    variants: {
      tone: {
        info: "bg-brand-primary-50 text-brand-primary-700",
        accent: "bg-brand-gold-300/60 text-brand-primary-800",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        error: "bg-error-soft text-error",
        neutral: "bg-neutral-100 text-neutral-700",
        outline: "border border-neutral-300 bg-transparent text-neutral-700",
      },
    },
    defaultVariants: {
      tone: "info",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

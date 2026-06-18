import * as React from "react";
import { cn } from "@/lib/design/cn";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
} from "lucide-react";

/**
 * StatusSurface — medium-level status block (progress, result, error).
 * Richer than a bare badge but simpler than a full error/empty page state.
 *
 * All colors are token-classes — no hard-coded hex.
 */
type StatusTone = "info" | "success" | "warning" | "error" | "loading";

const toneMap: Record<
  StatusTone,
  {
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    bg: string;
    text: string;
    bar: string;
  }
> = {
  info: { icon: Info, bg: "bg-info-soft", text: "text-info", bar: "bg-info" },
  success: {
    icon: CheckCircle2,
    bg: "bg-success-soft",
    text: "text-success",
    bar: "bg-success",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-warning-soft",
    text: "text-warning",
    bar: "bg-warning",
  },
  error: {
    icon: AlertCircle,
    bg: "bg-error-soft",
    text: "text-error",
    bar: "bg-error",
  },
  loading: {
    icon: Loader2,
    bg: "bg-brand-primary-50",
    text: "text-brand-primary-700",
    bar: "bg-brand-primary-600",
  },
};

export interface StatusSurfaceProps {
  tone: StatusTone;
  title: string;
  message?: string;
  /** Horizontal progress bar value (0–100). Only rendered when defined. */
  progress?: number;
  /** When true, the icon spins (mainly for `loading` tone). */
  spin?: boolean;
  className?: string;
}

export function StatusSurface({
  tone,
  title,
  message,
  progress,
  spin,
  className,
}: StatusSurfaceProps) {
  const { icon: Icon, bg, text, bar } = toneMap[tone];

  return (
    <div
      className={cn("rounded-lg border border-neutral-200 p-4", bg, className)}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className="flex items-center gap-3">
        <span className={cn("shrink-0", spin && "animate-spin")}>
          <Icon className={cn("h-5 w-5", text)} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-body-sm font-semibold", text)}>{title}</p>
          {message ? (
            <p className="mt-0.5 text-body-sm text-text-muted">{message}</p>
          ) : null}
        </div>
      </div>

      {progress !== undefined ? (
        <div className="mt-3">
          <div
            className="h-1.5 w-full overflow-hidden rounded-pill bg-neutral-200"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                "h-full rounded-pill transition-all duration-300",
                bar,
              )}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <p className="mt-1 text-caption text-text-muted">
            {Math.round(progress)}%
          </p>
        </div>
      ) : null}
    </div>
  );
}

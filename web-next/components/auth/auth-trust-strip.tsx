"use client";

import { Shield } from "lucide-react";
import { cn } from "@/lib/design/cn";

export function AuthTrustStrip({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 rounded-full border border-brand-primary-100/60 bg-brand-primary-50/70 px-4 py-2 text-body-sm text-brand-primary-800",
        className,
      )}
    >
      <Shield className="h-4 w-4 text-success" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

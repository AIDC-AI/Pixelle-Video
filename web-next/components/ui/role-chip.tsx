import * as React from "react";
import { cn } from "@/lib/design/cn";

/**
 * RoleChip — surfaces the signed-in user's role in the header.
 *
 * - `admin` → gold-soft bg + navy text (highlight, per the spec).
 * - `user`  → navy-soft bg + navy text.
 * - `guest` → neutral bg + neutral-500 text.
 */
export type Role = "guest" | "user" | "admin";

export function RoleChip({
  role,
  className,
}: {
  role: Role;
  className?: string;
}) {
  const label = role === "admin" ? "Admin" : role === "user" ? "User" : "Guest";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-caption font-medium",
        role === "admin" &&
          "border-brand-gold-300 bg-brand-gold-300/40 text-brand-primary-800",
        role === "user" &&
          "border-brand-primary-200 bg-brand-primary-50 text-brand-primary-700",
        role === "guest" &&
          "border-neutral-200 bg-neutral-100 text-neutral-500",
        className,
      )}
      aria-label={`role: ${label}`}
    >
      {label}
    </span>
  );
}

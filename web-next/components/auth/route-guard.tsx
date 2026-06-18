"use client";

import { LoadingState } from "@/components/states/loading";
import { AccessDenied } from "@/components/states/access-denied";
import { useRouteGuard } from "@/lib/auth/guard";

/**
 * Reusable guard. Pages call:
 *
 *   <RouteGuard required="user">...</RouteGuard>
 */
export function RouteGuard({
  required,
  children,
}: {
  required: "user" | "admin";
  children: React.ReactNode;
}) {
  const guard = useRouteGuard(required);
  if (!guard.ready) return <LoadingState rows={4} label="Checking session" />;
  if (!guard.allowed) return <AccessDenied />;
  return <>{children}</>;
}

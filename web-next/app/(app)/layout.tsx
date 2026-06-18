import { AppShell } from "@/components/layout/app-shell";

/**
 * Layout for all authenticated workspace routes. The default guard is
 * "user"; specific pages (admin) opt in to a stricter guard by
 * wrapping their content in <RouteGuard required="admin">.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

/**
 * Reusable guard. Pages call:
 *
 *   <RouteGuard required="user">...</RouteGuard>
 */
export { RouteGuard } from "@/components/auth/route-guard";

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Film,
  Menu,
  X,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/design/cn";
import { useAuthBootstrap, useRole } from "@/lib/auth/guard";
import { useAuthStore } from "@/lib/auth/store";
import { RoleChip } from "@/components/ui/role-chip";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/lib/api/hooks/use-auth";
import { PIPELINE_NAV, visibleNavFor, type NavItem } from "./nav-config";

/**
 * Context-aware page title: derives a human-readable label from the
 * current pathname so the header always shows where the user is.
 */
function derivePageContext(pathname: string): {
  title: string;
  section?: string;
} {
  if (pathname === "/") return { title: "Home" };
  if (pathname.startsWith("/generate/")) {
    const slug = pathname.replace("/generate/", "");
    const labels: Record<string, string> = {
      standard: "Standard",
      "asset-based": "Asset‑based",
      "digital-human": "Digital Human",
      i2v: "Image‑to‑Video",
      "action-transfer": "Action Transfer",
    };
    return {
      section: "Generate",
      title: labels[slug] ?? slug,
    };
  }
  if (pathname.startsWith("/history"))
    return { section: "Workspace", title: "History" };
  if (pathname.startsWith("/settings"))
    return { section: "Workspace", title: "Settings" };
  if (pathname.startsWith("/admin"))
    return { section: "Admin", title: "Admin" };
  return { title: "Pixelle" };
}

/**
 * AppShell — the workspace layout used by every authenticated page.
 *
 * - Desktop: persistent navy sidebar (240px) with a cream/light content
 *   area to its right.
 * - Mobile (<1024px): sidebar collapses into a drawer toggled from the
 *   header.
 * - Header shows the page title (caller-provided via <Header title=.../>)
 *   and the user menu.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  useAuthBootstrap();
  const role = useRole();
  const pathname = usePathname();
  const navItems = visibleNavFor(role);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-app text-text-body">
      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-neutral-0 px-4 lg:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setDrawerOpen(true)}
          className="rounded-md p-2 text-text-heading hover:bg-brand-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <Link href="/" className="flex items-center gap-2 text-text-heading">
          <Film className="h-5 w-5 text-brand-primary-700" aria-hidden />
          <span className="text-title font-semibold">Pixelle</span>
        </Link>
        <span className="w-9" />
      </header>

      <div className="flex">
        {/* Sidebar — desktop */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-brand-primary-900/40 bg-brand-primary-800 text-neutral-0 lg:flex">
          <SidebarContent
            pathname={pathname}
            navItems={navItems}
            onNavigate={() => undefined}
          />
        </aside>

        {/* Sidebar — mobile drawer */}
        {drawerOpen ? (
          <div
            className="fixed inset-0 z-40 flex lg:hidden"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-brand-primary-900/60"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <aside className="relative z-50 flex w-64 flex-col bg-brand-primary-800 text-neutral-0">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-2 top-2 rounded-md p-2 text-neutral-300 hover:bg-brand-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-400"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
              <SidebarContent
                pathname={pathname}
                navItems={navItems}
                onNavigate={() => setDrawerOpen(false)}
              />
            </aside>
          </div>
        ) : null}

        {/* Content */}
        <main className="min-w-0 flex-1">
          <PageHeader pathname={pathname} />
          <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  navItems,
  onNavigate,
}: {
  pathname: string;
  navItems: NavItem[];
  onNavigate: () => void;
}) {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const role = useRole();
  const logout = useLogout();

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <Link
        href="/"
        onClick={onNavigate}
        className="flex h-14 shrink-0 items-center gap-2.5 border-b border-brand-primary-700/50 px-5 text-neutral-0"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gold-400/15">
          <Film className="h-4.5 w-4.5 text-brand-gold-400" aria-hidden />
        </div>
        <span className="text-title font-semibold tracking-tight">Pixelle</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        {/* Main nav group */}
        <NavGroup
          label={t("nav.home").toString()}
          items={navItems}
          pathname={pathname}
          t={t}
          onNavigate={onNavigate}
        />

        {/* Pipeline nav group */}
        {role !== "guest" ? (
          <NavGroup
            label={t("nav.generate").toString()}
            items={PIPELINE_NAV.map((p) => ({
              href: p.href,
              icon: p.icon,
              labelKey: p.labelKey,
            }))}
            pathname={pathname}
            t={t}
            onNavigate={onNavigate}
            className="mt-6"
          />
        ) : null}
      </nav>

      {/* Account area */}
      <AccountFooter user={user} role={role} logout={logout} />
    </div>
  );
}

function NavGroup({
  label,
  items,
  pathname,
  t,
  onNavigate,
  className,
}: {
  label: string;
  items: Array<{ href: string; icon: LucideIcon; labelKey: string }>;
  pathname: string;
  t: ReturnType<typeof useTranslations>;
  onNavigate: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="px-2 pb-1.5 text-caption font-semibold uppercase tracking-wider text-brand-primary-300">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-body-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-brand-primary-700/80 text-neutral-0 shadow-sm shadow-brand-primary-900/20"
                    : "text-brand-primary-100 hover:bg-brand-primary-700/40 hover:text-neutral-0",
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active
                      ? "text-brand-gold-400"
                      : "text-brand-primary-300 group-hover:text-brand-primary-200",
                  )}
                  aria-hidden
                />
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AccountFooter({
  user,
  role,
  logout,
}: {
  user: ReturnType<typeof useAuthStore.getState>["user"];
  role: ReturnType<typeof useRole>;
  logout: ReturnType<typeof useLogout>;
}) {
  return (
    <div className="shrink-0 border-t border-brand-primary-700/50 px-3 py-3">
      {user ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-lg bg-brand-primary-700/60 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold-400/20 text-brand-gold-400">
              <span className="text-body-sm font-bold">
                {user.email.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-medium text-neutral-0">
                {user.email}
              </p>
              <p className="text-caption text-brand-primary-300 capitalize">
                {user.role}
              </p>
            </div>
            <RoleChip role={role} />
          </div>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-body-sm text-brand-primary-200 transition-colors hover:bg-brand-primary-700/40 hover:text-neutral-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-400"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            variant="primary"
            size="sm"
            block
            onClick={() => (window.location.href = "/login")}
          >
            Sign in
          </Button>
          <Button
            variant="secondary"
            size="sm"
            block
            onClick={() => (window.location.href = "/signup")}
            className="border-brand-primary-700 bg-brand-primary-700/40 text-neutral-0 hover:bg-brand-primary-700 hover:text-neutral-0"
          >
            Sign up
          </Button>
        </div>
      )}
    </div>
  );
}

function PageHeader({ pathname }: { pathname: string }) {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);
  const role = useRole();
  const logout = useLogout();
  const ctx = useMemo(() => derivePageContext(pathname), [pathname]);

  return (
    <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-neutral-200 bg-neutral-0/95 px-6 backdrop-blur-sm lg:flex">
      <div className="flex items-center gap-3">
        {ctx.section ? (
          <>
            <span className="text-body-sm font-medium text-brand-primary-700">
              {ctx.section}
            </span>
            <ChevronRight
              className="h-3.5 w-3.5 text-neutral-400"
              aria-hidden
            />
          </>
        ) : null}
        <h1 className="text-title font-semibold text-text-heading">
          {ctx.title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="hidden text-body-sm text-text-muted sm:inline">
              {user.email}
            </span>
            <RoleChip role={role} />
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => logout.mutate()}
            >
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => (window.location.href = "/login")}
            >
              Sign in
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => (window.location.href = "/signup")}
            >
              Sign up
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

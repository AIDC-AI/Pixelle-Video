import Link from "next/link";
import { ShieldOff } from "lucide-react";

/**
 * AccessDenied — 403 surface.
 * Per spec: light bg, navy icon, one warm accent, short message,
 * one "go back" action.
 */
export function AccessDenied({
  message = "You don't have access to this area.",
  returnHref = "/",
  returnLabel = "Back to home",
}: {
  message?: string;
  returnHref?: string;
  returnLabel?: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-brand-primary-50">
        <ShieldOff className="h-8 w-8 text-brand-primary-700" aria-hidden />
      </div>
      <h1 className="mt-6 text-h1 text-text-heading">Access denied</h1>
      <p className="mt-2 text-body text-text-muted">{message}</p>
      <div className="mt-8">
        <Link
          href={returnHref}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cta px-5 text-body font-semibold text-neutral-0 shadow-1 hover:saturate-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-300 focus-visible:ring-offset-2"
        >
          {returnLabel}
        </Link>
      </div>
    </div>
  );
}

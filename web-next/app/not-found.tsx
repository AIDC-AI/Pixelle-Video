import Link from "next/link";
import { Film } from "lucide-react";

/**
 * 404 — light surface, navy heading, single warm accent. Mirrors the
 * "Access denied" visual language per the spec.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-text-heading"
        >
          <Film className="h-6 w-6 text-brand-primary-700" aria-hidden />
          <span className="text-title font-semibold">Pixelle-Video</span>
        </Link>
        <p className="mt-8 text-display font-bold text-gradient">404</p>
        <h1 className="mt-4 text-h1 text-text-heading">Page not found</h1>
        <p className="mt-2 text-body text-text-muted">
          The page you’re looking for doesn’t exist.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cta px-5 text-body font-semibold text-neutral-0 shadow-1"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}

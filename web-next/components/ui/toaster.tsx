"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Minimal toast container. Renders nothing on the server.
 * Kept tiny on purpose — the real toast UX is wired in Phase 7.
 */
export function Toaster() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div
      id="toaster-root"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    />,
    document.body,
  );
}

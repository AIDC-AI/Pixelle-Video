"use client";

/**
 * Ambient auth background for the single-column form layout.
 *
 * Motion stays broad, slow, and low-contrast so the surface feels alive
 * without competing with the form content.
 */
export function AuthHeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(26, 43, 77, 0.08), transparent 38%), linear-gradient(135deg, rgba(26, 43, 77, 0.04) 0%, var(--bg-app) 48%, rgba(212, 168, 83, 0.12) 100%)",
        }}
      />

      <div
        className="auth-ambient-orb auth-motion-drift-ambient left-[-12%] top-[-10%] h-80 w-80 bg-brand-primary-500/22"
        style={{ animationDelay: "-4s" }}
      />

      <div
        className="auth-ambient-orb auth-motion-drift-ambient-slow bottom-[-12%] right-[-8%] h-96 w-96 bg-brand-gold-400/24"
        style={{ animationDelay: "-7s" }}
      />

      <div
        className="auth-ambient-orb auth-motion-drift-ambient hidden h-72 w-72 bg-brand-red-300/14 md:block"
        style={{ animationDelay: "-10s", left: "42%", top: "18%" }}
      />

      <div className="auth-ambient-grid absolute inset-0 opacity-55" />

      <div
        className="auth-motion-light-sweep-ambient absolute left-[-20%] top-0 h-full w-[24%] -skew-x-[18deg] bg-gradient-to-r from-transparent via-neutral-0/38 to-transparent blur-3xl"
        style={{ animationDelay: "-2s" }}
      />
    </div>
  );
}

"use client";

import { AuthBrandBlock } from "./auth-brand-block";
import { AuthHeroBackdrop } from "./auth-hero-backdrop";

export interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  belowForm?: React.ReactNode;
}

/**
 * Shared auth layout.
 *
 * Single-column auth layout with ambient motion behind the form.
 *
 * The moving background adds atmosphere but stays low-contrast so the form
 * remains the only real focal point during login and signup.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  belowForm,
}: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-app px-6 py-10 sm:px-10 sm:py-14">
      <AuthHeroBackdrop />

      <section className="relative z-10 w-full max-w-lg auth-motion-page-enter">
        {/*
          Soft glass surface over a restrained moving background. The card stays
          crisp and stable while the page still feels alive.
        */}
        <div className="relative rounded-[28px] border border-brand-primary-100/50 bg-neutral-0/78 p-6 shadow-2 backdrop-blur-xl sm:p-10">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-neutral-0/90 to-transparent" />
          <div className="absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-primary-100/60 to-transparent" />

          <div className="relative">
            <AuthBrandBlock className="mb-10" />

            <div className="mb-8">
              <h1 className="text-h1 text-text-heading">{title}</h1>
              <p className="mt-3 text-body-lg text-text-muted">{subtitle}</p>
            </div>

            {children}

            {belowForm ? (
              <div className="mt-10 flex justify-center">{belowForm}</div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useAuthBootstrap, useRole } from "@/lib/auth/guard";
import { PIPELINE_NAV } from "@/components/layout/nav-config";
import { Sparkles, ArrowRight, Zap, Film, Layers } from "lucide-react";

/**
 * Home (/) — marketing-style hero for guests; dashboard for signed-in
 * users. Same visual language, different copy.
 */
export default function HomePage() {
  const t = useTranslations("home");
  const tPipelines = useTranslations("pipelines");
  const role = useRole();
  useAuthBootstrap();
  const isGuest = role === "guest";

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-brand-primary-100 bg-surface-soft px-6 py-10 sm:px-10 sm:pb-14 sm:pt-16">
        {/* Subtle decorative element */}
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-brand-gold-400/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-brand-red-300/10"
          aria-hidden
        />

        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary-100 px-3 py-1 text-caption font-medium text-brand-primary-700">
              <Zap className="h-3 w-3" aria-hidden />
              {isGuest ? "AI Video Generation" : "Video Studio"}
            </span>
          </div>

          <h1 className="mt-4 max-w-2xl text-display font-bold text-text-heading text-balance">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-lg text-body-lg text-text-body">
            {t("subtitle")}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {isGuest ? (
              <>
                <Link href="/signup">
                  <Button variant="primary" size="lg">
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Get started
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="secondary" size="lg">
                    Sign in
                  </Button>
                </Link>
              </>
            ) : (
              <Link href="/generate/standard">
                <Button variant="primary" size="lg">
                  <Film className="h-4 w-4" aria-hidden />
                  {t("newVideo")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Pipelines */}
      <section>
        <div className="mb-6">
          <h2 className="text-h3 text-text-heading">Pipelines</h2>
          <p className="mt-1 text-body-sm text-text-muted">
            Choose a generation pipeline that fits your creative needs.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE_NAV.map((p) => (
            <Card key={p.key} variant="lift" className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary-50">
                    <p.icon
                      className="h-5 w-5 text-brand-primary-700"
                      aria-hidden
                    />
                  </span>
                  <CardTitle>{tPipelines(`${p.key}.name` as never)}</CardTitle>
                </div>
                <p className="mt-2 text-body-sm text-text-muted">
                  {tPipelines(`${p.key}.description` as never)}
                </p>
              </CardHeader>
              <CardBody className="mt-auto">
                {isGuest ? (
                  <Link
                    href={`/signup?next=${encodeURIComponent(p.href)}`}
                    className="group flex w-full items-center justify-between rounded-md border border-neutral-200 px-4 py-2.5 text-body-sm font-medium text-brand-primary-700 transition-colors hover:border-brand-primary-300 hover:bg-brand-primary-50"
                  >
                    Create video
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                ) : (
                  <Link
                    href={p.href}
                    className="group flex w-full items-center justify-between rounded-md border border-neutral-200 px-4 py-2.5 text-body-sm font-medium text-brand-primary-700 transition-colors hover:border-brand-primary-300 hover:bg-brand-primary-50"
                  >
                    Create video
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* Supporting section — adds substance without fake data */}
      {!isGuest ? (
        <section>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Card variant="default" className="text-center">
              <CardBody>
                <Layers
                  className="mx-auto h-8 w-8 text-brand-primary-400"
                  aria-hidden
                />
                <h3 className="mt-3 text-title text-text-heading">
                  Multiple pipelines
                </h3>
                <p className="mt-1 text-body-sm text-text-muted">
                  Standard, asset-based, digital human, I2V, and action transfer
                  — pick the right tool for every project.
                </p>
              </CardBody>
            </Card>

            <Card variant="default" className="text-center">
              <CardBody>
                <Zap
                  className="mx-auto h-8 w-8 text-brand-gold-500"
                  aria-hidden
                />
                <h3 className="mt-3 text-title text-text-heading">
                  Fast generation
                </h3>
                <p className="mt-1 text-body-sm text-text-muted">
                  Real-time progress tracking and SSE streaming so you always
                  know what&apos;s happening.
                </p>
              </CardBody>
            </Card>

            <Card variant="default" className="text-center">
              <CardBody>
                <Film
                  className="mx-auto h-8 w-8 text-brand-primary-700"
                  aria-hidden
                />
                <h3 className="mt-3 text-title text-text-heading">
                  Production ready
                </h3>
                <p className="mt-1 text-body-sm text-text-muted">
                  High-quality output with configurable templates, TTS, and
                  background music options.
                </p>
              </CardBody>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}

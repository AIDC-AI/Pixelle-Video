"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { LogIn, CheckCircle2 } from "lucide-react";
import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLogin, useGoogleLogin } from "@/lib/api/hooks/use-auth";
import { AuthInlineError, AuthShell, GoogleButton } from "@/components/auth";
import type { GoogleButtonStatus } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const googleLogin = useGoogleLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleError, setGoogleError] = useState<{ status: GoogleButtonStatus; message: string } | null>(null);
  const resetOk = searchParams?.get("msg") === "password_reset_ok";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: () => {
          const next = searchParams?.get("next");
          router.replace(next && next.startsWith("/") ? next : "/");
        },
        onError: () => undefined,
      },
    );
  };

  const errorCode = (login.error as { code?: string } | null)?.code;
  const errorMessage = errorCode
    ? (t(`errors.${errorCode}` as never) as string)
    : undefined;

  const googleErrorCode = (googleLogin.error as { code?: string } | null)?.code;
  const googleApiErrorMessage = googleErrorCode
    ? (t(`errors.${googleErrorCode}` as never) as string)
    : undefined;

  const handleGoogleCredential = useCallback(
    (idToken: string) => {
      setGoogleError(null);
      googleLogin.mutate(idToken, {
        onSuccess: () => {
          const next = searchParams?.get("next");
          router.replace(next && next.startsWith("/") ? next : "/");
        },
      });
    },
    [googleLogin, router, searchParams],
  );

  const handleGoogleError = useCallback(
    (status: GoogleButtonStatus, message: string) => {
      if (status === "error_cancelled" || status === "error_unavailable") {
        setGoogleError({ status, message });
      }
    },
    [],
  );

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {resetOk ? (
          <div
            role="status"
            className="rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-center"
          >
            <CheckCircle2 className="mx-auto h-5 w-5 text-success" aria-hidden />
            <p className="mt-1 text-body-sm font-semibold text-success">
              {t("resetSuccess")}
            </p>
          </div>
        ) : null}
        <Field label={t("email")} htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            invalid={login.isError}
          />
        </Field>

        <Field label={t("password")} htmlFor="password" required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            invalid={login.isError}
          />
          <div className="mt-1.5 text-right">
            <Link
              href="/forgot-password"
              className="text-caption text-brand-primary-600 transition-colors hover:text-brand-primary-700 hover:underline"
            >
              {t("forgotLink")}
            </Link>
          </div>
        </Field>

        {login.isError ? (
          <AuthInlineError
            title={tCommon("states.error")}
            description={errorMessage}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => login.reset()}
              >
                {tCommon("actions.tryAgain")}
              </Button>
            }
          />
        ) : null}

        {googleApiErrorMessage ? (
          <AuthInlineError
            title={tCommon("states.error")}
            description={googleApiErrorMessage}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => googleLogin.reset()}
              >
                {tCommon("actions.tryAgain")}
              </Button>
            }
          />
        ) : null}

        {googleError?.status === "error_unavailable" ? (
          <AuthInlineError
            title={t("googleUnavailable")}
            description={t("errors.provider_error")}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGoogleError(null)}
              >
                {tCommon("actions.close")}
              </Button>
            }
          />
        ) : null}

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            isLoading={login.isPending}
          >
            <LogIn className="h-4 w-4" aria-hidden />
            {t("submit")}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-caption text-text-muted">{t("orContinueWith")}</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        <GoogleButton
          onCredential={handleGoogleCredential}
          onError={handleGoogleError}
        />

        <p className="text-center text-body-sm text-text-muted">
          {t("noAccount")}{" "}
          <Link
            href="/signup"
            className="font-medium text-brand-primary-700 transition-colors hover:text-brand-primary-800 hover:underline"
          >
            {t("signUpLink")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

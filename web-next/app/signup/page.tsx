"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignup, useGoogleLogin } from "@/lib/api/hooks/use-auth";
import { AuthInlineError, AuthShell, GoogleButton } from "@/components/auth";
import type { GoogleButtonStatus } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export default function SignupPage() {
  const t = useTranslations("auth.signup");
  const router = useRouter();
  const searchParams = useSearchParams();
  const signup = useSignup();
  const googleLogin = useGoogleLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [googleError, setGoogleError] = useState<{ status: GoogleButtonStatus; message: string } | null>(null);

  const errCode = (signup.error as { code?: string } | null)?.code;

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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signup.mutate(
      { email, password, confirm_password: confirm },
      {
        onSuccess: () => {
          const next = searchParams?.get("next");
          router.replace(next && next.startsWith("/") ? next : "/");
        },
      },
    );
  };

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label={t("email")} htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            invalid={errCode === "email_exists"}
          />
        </Field>

        <Field
          label={t("password")}
          htmlFor="password"
          required
          error={
            errCode === "password_policy"
              ? t("errors.password_policy")
              : undefined
          }
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            invalid={errCode === "password_policy"}
          />
        </Field>

        <Field
          label={t("confirmPassword")}
          htmlFor="confirm"
          required
          error={
            errCode === "password_mismatch"
              ? t("errors.password_mismatch")
              : undefined
          }
        >
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            invalid={errCode === "password_mismatch"}
          />
        </Field>

        {errCode === "email_exists" ? (
          <AuthInlineError
            title={t("errors.email_exists")}
            action={
              <Link
                href="/login"
                className="text-body-sm font-medium text-brand-primary-700 hover:underline"
              >
                {t("signInLink")}
              </Link>
            }
          />
        ) : null}

        {googleApiErrorMessage ? (
          <AuthInlineError
            title={t("errors.provider_unavailable")}
            description={googleApiErrorMessage}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => googleLogin.reset()}
              >
                {t("signInLink")}
              </Button>
            }
          />
        ) : null}

        {googleError?.status === "error_unavailable" ? (
          <AuthInlineError
            title={t("errors.provider_unavailable")}
            description={t("errors.provider_error")}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGoogleError(null)}
              >
                {t("signInLink")}
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
            isLoading={signup.isPending}
          >
            <UserPlus className="h-4 w-4" aria-hidden />
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
          {t("haveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-brand-primary-700 transition-colors hover:text-brand-primary-800 hover:underline"
          >
            {t("signInLink")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

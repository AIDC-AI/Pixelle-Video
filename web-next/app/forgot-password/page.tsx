"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, MailWarning } from "lucide-react";
import { useState } from "react";
import { useForgotPassword } from "@/lib/api/hooks/use-auth";
import { AuthInlineError, AuthShell } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgot");
  const tCommon = useTranslations("common");
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");

  const shell = (
    title: string,
    subtitle: string,
    children: React.ReactNode,
  ) => (
    <AuthShell title={title} subtitle={subtitle}>
      {children}
    </AuthShell>
  );

  // Success state — safe, non-enumerating message shown even when the
  // account doesn't exist.
  if (forgot.isSuccess) {
    return shell(
      t("title"),
      forgot.data?.message ?? t("successMessage"),
      <div className="space-y-6">
        <div
          role="status"
          className="rounded-lg border border-success/30 bg-success-soft px-6 py-6 text-center"
        >
          <CheckCircle2 className="mx-auto h-8 w-8 text-success" aria-hidden />
          <p className="mt-3 text-body text-text-body">
            {forgot.data?.message ?? t("successMessage")}
          </p>
        </div>

        {forgot.data?.reset_token ? (
          <div className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-body-sm text-text-body">
            <p className="font-semibold text-warning">Dev mode</p>
            <p className="mt-1 break-all">
              Reset token:{" "}
              <code className="rounded bg-neutral-0 px-1.5 py-0.5">
                {forgot.data.reset_token}
              </code>
            </p>
            <Link
              href={`/reset-password?token=${encodeURIComponent(forgot.data.reset_token)}`}
              className="mt-3 inline-block text-brand-primary-700 hover:underline"
            >
              Continue to reset &rarr;
            </Link>
          </div>
        ) : null}

        <Link
          href="/login"
          className="block text-center text-body-sm text-brand-primary-700 hover:underline"
        >
          <ArrowLeft className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          {t("backToLogin")}
        </Link>
      </div>,
    );
  }

  // Detect mail-send failure (502 with code=mail_send_failed or provider_error).
  const errorCode = (forgot.error as { code?: string } | null)?.code;
  const emailError =
    errorCode === "invalid_input"
      ? t("errors.email_invalid")
      : undefined;
  const mailSendFailed =
    errorCode === "mail_send_failed" || errorCode === "provider_error";

  return shell(
    t("title"),
    t("subtitle"),
    <form
      onSubmit={(e) => {
        e.preventDefault();
        forgot.mutate({ email });
      }}
      className="space-y-5"
      noValidate
    >
      <Field
        label={t("email")}
        htmlFor="email"
        required
        error={emailError}
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          invalid={!!emailError}
        />
      </Field>

      {mailSendFailed ? (
        <div className="space-y-3">
          <AuthInlineError
            title={t("errors.mail_title")}
            description={t("errors.mail_description")}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => forgot.reset()}
              >
                <ArrowLeft className="mr-1 h-3 w-3" aria-hidden />
                {t("errors.mail_retry")}
              </Button>
            }
          />
          <p className="text-center text-caption text-text-muted">
            <MailWarning className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            {t("errors.mail_subtext")}
          </p>
        </div>
      ) : forgot.isError && !mailSendFailed ? (
        <AuthInlineError
          title={tCommon("states.error")}
          description={tCommon("states.errorDescription")}
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => forgot.reset()}
            >
              {tCommon("actions.tryAgain")}
            </Button>
          }
        />
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        isLoading={forgot.isPending}
      >
        {t("submit")}
      </Button>

      <Link
        href="/login"
        className="block text-center text-body-sm text-brand-primary-700 hover:underline"
      >
        <ArrowLeft className="mr-1 inline h-3.5 w-3.5" aria-hidden />
        {t("backToLogin")}
      </Link>
    </form>,
  );
}

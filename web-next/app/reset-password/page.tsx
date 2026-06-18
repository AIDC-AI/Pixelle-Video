"use client";

import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { useResetPassword } from "@/lib/api/hooks/use-auth";
import { AuthInlineError, AuthShell } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const tCommon = useTranslations("common");
  const params = useSearchParams();
  const reset = useResetPassword();
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const token = params.get("token") ?? "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    reset.mutate(
      {
        reset_token: token,
        new_password: newPassword,
        confirm_password: confirm,
      },
      {
        onSuccess: () => {
          window.location.href = `/login?msg=password_reset_ok`;
        },
      },
    );
  };

  const errorCode = (reset.error as { code?: string } | null)?.code;
  const mismatch =
    confirm.length > 0 && newPassword !== confirm
      ? t("errors.password_mismatch")
      : undefined;

  // Token-related errors that should show guidance, not a retry form.
  const tokenErrorKey =
    errorCode === "token_expired"
      ? "errors.token_expired"
      : errorCode === "token_invalid"
        ? "errors.token_invalid"
        : errorCode === "user_inactive"
          ? "errors.user_inactive"
          : null;

  if (tokenErrorKey) {
    return (
      <AuthShell title={t("title")} subtitle={t("subtitle")}>
        <div className="space-y-6">
          <AuthInlineError
            title={t(tokenErrorKey as never) as string}
            description={t("errors.token_guidance")}
          />
          <Link
            href="/forgot-password"
            className="block w-full"
          >
            <Button type="button" variant="primary" size="lg" block>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              {t("requestNewLink")}
            </Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  const policyError =
    errorCode === "invalid_input" && !mismatch
      ? t("errors.password_policy")
      : undefined;

  if (!token) {
    return (
      <AuthShell title={t("title_missing")} subtitle="">
        <div className="space-y-6">
          <AuthInlineError
            title={t("errors.no_token")}
            description={t("errors.no_token_guidance")}
          />
          <Link
            href="/forgot-password"
            className="block w-full"
          >
            <Button type="button" variant="primary" size="lg" block>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              {t("requestNewLink")}
            </Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field
          label={t("newPassword")}
          htmlFor="new"
          required
        >
          <Input
            id="new"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            required
            minLength={8}
            invalid={!!mismatch || !!policyError}
          />
        </Field>

        <Field
          label={t("confirmPassword")}
          htmlFor="confirm"
          required
          error={mismatch}
        >
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            invalid={!!mismatch}
          />
        </Field>

        {policyError ? (
          <p className="text-caption text-error" role="alert">
            {policyError}
          </p>
        ) : null}

        {reset.isError && !mismatch && !policyError ? (
          <AuthInlineError
            title={tCommon("states.error")}
            description={tCommon("states.errorDescription")}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => reset.reset()}
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
          disabled={!token}
          isLoading={reset.isPending}
        >
          <KeyRound className="mr-2 h-4 w-4" aria-hidden />
          {t("submit")}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

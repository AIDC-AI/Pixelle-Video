"use client";

import { useTranslations } from "next-intl";
import { useState, useRef } from "react";
import { Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  requestGoogleCredential,
  GoogleSignInCancelled,
  GoogleSignInNotConfigured,
  GoogleSignInUnavailable,
} from "@/lib/auth/google";
import { isGoogleConfigured } from "@/lib/auth/google";

export type GoogleButtonStatus =
  | "idle"
  | "loading"
  | "error_not_configured"
  | "error_cancelled"
  | "error_unavailable"
  | "error_token"
  | "error_provider";

export interface GoogleButtonProps {
  onCredential: (idToken: string) => void;
  onError?: (status: GoogleButtonStatus, message: string) => void;
  className?: string;
}

/**
 * "Continue with Google" button.
 *
 * Behaviour:
 *  - Loads GIS lazily on first click (keeps page weight down).
 *  - Shows a spinner while the popup is open.
 *  - Maps known failures to typed statuses the parent page can render
 *    as inline error blocks.
 *  - Silent when not configured (AC8 — disabled state with tooltip).
 */
export function GoogleButton({
  onCredential,
  onError,
  className,
}: GoogleButtonProps) {
  const t = useTranslations("auth.login");
  const configured = isGoogleConfigured();
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const credential = await requestGoogleCredential();
      if (mountedRef.current) {
        setLoading(false);
        onCredential(credential);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setLoading(false);
      if (err instanceof GoogleSignInCancelled) {
        onError?.("error_cancelled", "User cancelled Google sign-in");
        return;
      }
      if (err instanceof GoogleSignInNotConfigured) {
        onError?.("error_not_configured", "Google sign-in is not configured");
        return;
      }
      if (err instanceof GoogleSignInUnavailable) {
        onError?.("error_unavailable", err.message);
        return;
      }
      onError?.("error_provider", "Google sign-in failed");
    }
  };

  // Not configured — show a disabled state with tooltip (AC8).
  if (!configured) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="lg"
        block
        disabled
        className={className}
        title={t("googleUnavailable")}
        aria-label={t("googleUnavailable")}
      >
        <Chrome className="h-4 w-4" aria-hidden />
        {t("googleButton")}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      block
      className={className}
      onClick={handleClick}
      isLoading={loading}
      disabled={loading}
    >
      <Chrome className="h-4 w-4" aria-hidden />
      {t("googleButton")}
    </Button>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useResetConfig } from "@/lib/api/hooks/use-config";

/**
 * Settings-level action bar — reset all config to defaults. Per-card
 * save buttons live in each card; this is the only top-level action.
 */
export function SettingsActions() {
  const reset = useResetConfig();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-6">
        <p className="text-body text-text-body">
          Reset all settings to defaults? This cannot be undone.
        </p>
        <Button
          variant="destructive"
          onClick={() => {
            reset.mutate();
            setConfirming(false);
          }}
          disabled={reset.isPending}
        >
          {reset.isPending ? "Resetting…" : "Yes, reset everything"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setConfirming(false)}
          disabled={reset.isPending}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-6">
      <Button
        variant="secondary"
        onClick={() => setConfirming(true)}
        disabled={reset.isPending}
      >
        Reset to defaults
      </Button>
      {reset.isError ? (
        <p className="text-body-sm text-error" role="alert">
          {(reset.error as Error).message}
        </p>
      ) : null}
    </div>
  );
}

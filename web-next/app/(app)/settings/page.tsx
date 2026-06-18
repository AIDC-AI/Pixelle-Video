"use client";

import { useTranslations } from "next-intl";
import { RouteGuard } from "../layout";
import { LlmCard } from "@/components/settings/llm-card";
import { ComfyuiCard } from "@/components/settings/comfyui-card";
import { ApiProvidersCard } from "@/components/settings/api-providers-card";
import { SettingsActions } from "@/components/settings/settings-actions";

/**
 * Settings — LLM, ComfyUI / RunningHub, and direct API media providers.
 * Values are read from / written to the FastAPI `config_manager` via
 * `/api/config`. Each card has its own Save button; the Reset button at
 * the bottom restores the full config to defaults.
 */
export default function SettingsPage() {
  const t = useTranslations("settings");
  return (
    <RouteGuard required="admin">
      <div className="space-y-6">
        <h1 className="text-h1 text-text-heading">{t("title")}</h1>

        <LlmCard />
        <ComfyuiCard />
        <ApiProvidersCard />

        <SettingsActions />
      </div>
    </RouteGuard>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useConfig,
  useSaveApiProvider,
  useSaveApiProvidersCommon,
  type APIProviderConfig,
  type APIProvidersCommonConfig,
} from "@/lib/api/hooks/use-config";

type ProviderName = "openai" | "dashscope" | "ark" | "kling";

const PROVIDER_LABELS: Record<ProviderName, string> = {
  openai: "OpenAI / GPT Image",
  dashscope: "DashScope / Wan / HappyHorse",
  ark: "Volcengine ARK / Seedream / Seedance",
  kling: "Kling AI / 可灵",
};

const DEFAULT_BASE_URLS: Record<ProviderName, string> = {
  openai: "https://api.openai.com/v1",
  dashscope: "https://dashscope.aliyuncs.com/api/v1",
  ark: "https://ark.cn-beijing.volces.com/api/v3",
  kling: "https://api-beijing.klingai.com",
};

const PROVIDERS: ProviderName[] = ["openai", "dashscope", "ark", "kling"];

/**
 * Direct API media providers card — OpenAI / DashScope / ARK / Kling,
 * plus a shared "common" section (local proxy + debug print).
 *
 * Kling uses access_key + secret_key; the other three use api_key.
 * Each provider has its own Save button so partial updates are safe.
 */
export function ApiProvidersCard() {
  const { data, isLoading } = useConfig();
  const saveCommon = useSaveApiProvidersCommon();
  // Call all four provider save hooks at the top level so the hook
  // order stays stable across renders (Rules of Hooks). The map below
  // just looks up the right one.
  const saveOpenai = useSaveApiProvider("openai");
  const saveDashscope = useSaveApiProvider("dashscope");
  const saveArk = useSaveApiProvider("ark");
  const saveKling = useSaveApiProvider("kling");
  const saves: Record<ProviderName, ReturnType<typeof useSaveApiProvider>> = {
    openai: saveOpenai,
    dashscope: saveDashscope,
    ark: saveArk,
    kling: saveKling,
  };

  // One draft per provider so a Save in one card doesn't dirty the others.
  const [drafts, setDrafts] = useState<Record<
    ProviderName,
    APIProviderConfig
  > | null>(null);
  const [commonDraft, setCommonDraft] =
    useState<APIProvidersCommonConfig | null>(null);

  useEffect(() => {
    if (data?.api_providers) {
      if (!drafts) {
        setDrafts({
          openai: data.api_providers.openai,
          dashscope: data.api_providers.dashscope,
          ark: data.api_providers.ark,
          kling: data.api_providers.kling,
        });
      }
      if (!commonDraft) setCommonDraft(data.api_providers.common);
    }
  }, [data, drafts, commonDraft]);

  if (isLoading || !drafts || !commonDraft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Media Models</CardTitle>
        </CardHeader>
        <CardBody>Loading…</CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Common */}
      <Card>
        <CardHeader>
          <CardTitle>API media models — common</CardTitle>
          <CardDescription>
            Shared settings for direct image / video model calls. Does not
            affect LLM or ComfyUI / RunningHub above.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Local proxy (optional)"
              htmlFor="api-proxy"
              help="Only used by some providers (e.g. OpenAI image). Leave blank to disable."
            >
              <Input
                id="api-proxy"
                value={commonDraft.local_proxy}
                onChange={(e) =>
                  setCommonDraft({
                    ...commonDraft,
                    local_proxy: e.target.value,
                  })
                }
                placeholder="http://127.0.0.1:9090"
              />
            </Field>
            <Field
              label="Print model request parameters"
              htmlFor="api-print"
              help="For debugging. Logs prompts, model names, and input file paths to the terminal."
            >
              <label className="flex h-11 items-center gap-2">
                <input
                  id="api-print"
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-300 text-brand-primary-700 focus:ring-brand-primary-300"
                  checked={commonDraft.print_model_input}
                  onChange={(e) =>
                    setCommonDraft({
                      ...commonDraft,
                      print_model_input: e.target.checked,
                    })
                  }
                />
                <span className="text-body text-neutral-800">
                  {commonDraft.print_model_input ? "Enabled" : "Disabled"}
                </span>
              </label>
            </Field>
          </div>

          {saveCommon.isError ? (
            <p className="text-body-sm text-error" role="alert">
              {(saveCommon.error as Error).message}
            </p>
          ) : null}
          {saveCommon.isSuccess ? (
            <p className="text-body-sm text-success" role="status">
              Saved.
            </p>
          ) : null}

          <Button
            variant="primary"
            onClick={() => saveCommon.mutate(commonDraft)}
            disabled={saveCommon.isPending}
          >
            Save common
          </Button>
        </CardBody>
      </Card>

      {/* Per-provider cards */}
      {PROVIDERS.map((name) => (
        <ProviderSection
          key={name}
          name={name}
          draft={drafts[name]}
          onChange={(next) => setDrafts({ ...drafts, [name]: next })}
          save={saves[name]}
        />
      ))}
    </div>
  );
}

function ProviderSection({
  name,
  draft,
  onChange,
  save,
}: {
  name: ProviderName;
  draft: APIProviderConfig;
  onChange: (next: APIProviderConfig) => void;
  save: ReturnType<typeof useSaveApiProvider>;
}) {
  const isKling = name === "kling";
  const defaultBase = DEFAULT_BASE_URLS[name];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{PROVIDER_LABELS[name]}</CardTitle>
        <CardDescription>
          {isKling
            ? "Kling uses Access Key + Secret Key for signing."
            : "API key + optional base URL override."}
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        {isKling ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Access Key" htmlFor={`${name}-access`}>
              <Input
                id={`${name}-access`}
                type="password"
                value={draft.access_key}
                onChange={(e) =>
                  onChange({ ...draft, access_key: e.target.value })
                }
                autoComplete="off"
              />
            </Field>
            <Field label="Secret Key" htmlFor={`${name}-secret`}>
              <Input
                id={`${name}-secret`}
                type="password"
                value={draft.secret_key}
                onChange={(e) =>
                  onChange({ ...draft, secret_key: e.target.value })
                }
                autoComplete="off"
              />
            </Field>
          </div>
        ) : (
          <Field label="API Key" htmlFor={`${name}-key`}>
            <Input
              id={`${name}-key`}
              type="password"
              value={draft.api_key}
              onChange={(e) => onChange({ ...draft, api_key: e.target.value })}
              autoComplete="off"
            />
          </Field>
        )}

        <Field label="Base URL" htmlFor={`${name}-url`}>
          <Input
            id={`${name}-url`}
            value={draft.base_url}
            onChange={(e) => onChange({ ...draft, base_url: e.target.value })}
            placeholder={defaultBase}
          />
        </Field>

        <label className="flex items-center gap-2 text-body">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-neutral-300 text-brand-primary-700 focus:ring-brand-primary-300"
            checked={draft.use_proxy}
            onChange={(e) =>
              onChange({ ...draft, use_proxy: e.target.checked })
            }
          />
          <span className="text-neutral-800">Use local proxy</span>
        </label>

        {save.isError ? (
          <p className="text-body-sm text-error" role="alert">
            {(save.error as Error).message}
          </p>
        ) : null}
        {save.isSuccess ? (
          <p className="text-body-sm text-success" role="status">
            Saved.
          </p>
        ) : null}

        <Button
          variant="primary"
          onClick={() => save.mutate(draft)}
          disabled={save.isPending}
        >
          Save {PROVIDER_LABELS[name].split(" /")[0]}
        </Button>
      </CardBody>
    </Card>
  );
}

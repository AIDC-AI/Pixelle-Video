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
  useSaveLlm,
  useTestLlm,
  type LLMConfig,
} from "@/lib/api/hooks/use-config";

/**
 * LLM card — API key, base URL, model. Test connection probes the
 * endpoint by listing available models. Save persists to /api/config/llm.
 */
export function LlmCard() {
  const { data, isLoading } = useConfig();
  const save = useSaveLlm();
  const test = useTestLlm();

  const [draft, setDraft] = useState<LLMConfig | null>(null);

  useEffect(() => {
    if (data?.llm && !draft) setDraft(data.llm);
  }, [data, draft]);

  if (isLoading || !draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>LLM</CardTitle>
        </CardHeader>
        <CardBody>Loading…</CardBody>
      </Card>
    );
  }

  const onSave = () => {
    save.mutate(draft, {
      onSuccess: (next) => setDraft(next),
    });
  };

  const onTest = () => {
    test.mutate({
      api_key: draft.api_key,
      base_url: draft.base_url,
      model: draft.model,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>LLM</CardTitle>
        <CardDescription>OpenAI-compatible LLM endpoint.</CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <Field label="API Key" htmlFor="llm-key" required>
          <Input
            id="llm-key"
            type="password"
            value={draft.api_key}
            onChange={(e) => setDraft({ ...draft, api_key: e.target.value })}
            placeholder="sk-…"
            autoComplete="off"
          />
        </Field>
        <Field label="Base URL" htmlFor="llm-url" required>
          <Input
            id="llm-url"
            value={draft.base_url}
            onChange={(e) => setDraft({ ...draft, base_url: e.target.value })}
            placeholder="https://api.openai.com/v1"
          />
        </Field>
        <Field label="Model" htmlFor="llm-model" required>
          <Input
            id="llm-model"
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            placeholder="gpt-4o-mini"
          />
        </Field>

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
        {test.isSuccess ? (
          <p
            className={
              test.data.success
                ? "text-body-sm text-success"
                : "text-body-sm text-error"
            }
            role="status"
          >
            {test.data.success
              ? `Connected — ${test.data.model_count} models available.`
              : `Failed: ${test.data.message}`}
          </p>
        ) : null}

        <div className="flex items-center gap-3 pt-1">
          <Button variant="primary" onClick={onSave} disabled={save.isPending}>
            Save LLM
          </Button>
          <Button
            variant="secondary"
            onClick={onTest}
            disabled={test.isPending || !draft.api_key || !draft.base_url}
          >
            {test.isPending ? "Testing…" : "Test connection"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

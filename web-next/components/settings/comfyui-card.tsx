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
  useSaveComfyui,
  useTestComfyui,
  useTestRunninghub,
  type ComfyUIConfig,
} from "@/lib/api/hooks/use-config";

const INSTANCE_24G = "24G";
const INSTANCE_48G = "48G";

/**
 * ComfyUI + RunningHub card.
 *
 * - Local ComfyUI URL + API key + test connection
 * - RunningHub API key, concurrent limit (1-10), instance type (24G / 48G)
 *
 * Both sections save together (one PUT) so the user gets one confirmation.
 */
export function ComfyuiCard() {
  const { data, isLoading } = useConfig();
  const save = useSaveComfyui();
  const test = useTestComfyui();
  const testRh = useTestRunninghub();

  const [draft, setDraft] = useState<ComfyUIConfig | null>(null);

  useEffect(() => {
    if (data?.comfyui && !draft) setDraft(data.comfyui);
  }, [data, draft]);

  if (isLoading || !draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ComfyUI & RunningHub</CardTitle>
        </CardHeader>
        <CardBody>Loading…</CardBody>
      </Card>
    );
  }

  const instanceDisplay =
    draft.runninghub_instance_type === "plus" ? INSTANCE_48G : INSTANCE_24G;

  const onSave = () => {
    save.mutate(
      {
        ...draft,
        runninghub_instance_type:
          instanceDisplay === INSTANCE_48G ? "plus" : "",
      },
      { onSuccess: (next) => setDraft(next) },
    );
  };

  const onTest = () => {
    test.mutate({ url: draft.comfyui_url });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ComfyUI &amp; RunningHub</CardTitle>
        <CardDescription>
          Local ComfyUI server and RunningHub cloud workflow runner.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-6">
        {/* Local ComfyUI */}
        <div className="space-y-4">
          <h3 className="text-h4 text-text-heading">Local ComfyUI</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ComfyUI URL" htmlFor="comfyui-url">
              <Input
                id="comfyui-url"
                value={draft.comfyui_url}
                onChange={(e) =>
                  setDraft({ ...draft, comfyui_url: e.target.value })
                }
                placeholder="http://127.0.0.1:8188"
              />
            </Field>
            <Field label="ComfyUI API Key (optional)" htmlFor="comfyui-key">
              <Input
                id="comfyui-key"
                type="password"
                value={draft.comfyui_api_key}
                onChange={(e) =>
                  setDraft({ ...draft, comfyui_api_key: e.target.value })
                }
                autoComplete="off"
              />
            </Field>
          </div>
        </div>

        {/* RunningHub */}
        <div className="space-y-4 border-t border-neutral-200 pt-4">
          <h3 className="text-h4 text-text-heading">RunningHub (cloud)</h3>
          <Field label="RunningHub API Key" htmlFor="rh-key">
            <Input
              id="rh-key"
              type="password"
              value={draft.runninghub_api_key}
              onChange={(e) =>
                setDraft({ ...draft, runninghub_api_key: e.target.value })
              }
              autoComplete="off"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Concurrent limit"
              htmlFor="rh-concurrent"
              help="Number of RunningHub tasks to run in parallel (1–10)."
            >
              <Input
                id="rh-concurrent"
                type="number"
                min={1}
                max={10}
                value={draft.runninghub_concurrent_limit}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    runninghub_concurrent_limit: Math.max(
                      1,
                      Math.min(10, Number(e.target.value) || 1),
                    ),
                  })
                }
              />
            </Field>
            <Field
              label="Instance type"
              htmlFor="rh-instance"
              help="48G (Plus) machines can run larger models."
            >
              <select
                id="rh-instance"
                value={instanceDisplay}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    runninghub_instance_type:
                      e.target.value === INSTANCE_48G ? "plus" : "",
                  })
                }
                className="h-11 w-full rounded-md border border-neutral-300 bg-neutral-0 px-3 text-body text-neutral-800 focus:border-brand-primary-600 focus:outline-none focus:ring-2 focus:ring-brand-primary-300"
              >
                <option value={INSTANCE_24G}>24G (default)</option>
                <option value={INSTANCE_48G}>48G (Plus)</option>
              </select>
            </Field>
          </div>
        </div>

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
              ? `ComfyUI reachable.`
              : `ComfyUI unreachable: ${test.data.message}`}
          </p>
        ) : null}
        {testRh.isSuccess ? (
          <p
            className={
              testRh.data.success
                ? "text-body-sm text-success"
                : "text-body-sm text-error"
            }
            role="status"
          >
            {testRh.data.success
              ? `RunningHub: ${testRh.data.message}`
              : `RunningHub error: ${testRh.data.message}`}
          </p>
        ) : null}

        <div className="flex items-center gap-3 pt-1">
          <Button variant="primary" onClick={onSave} disabled={save.isPending}>
            Save ComfyUI &amp; RunningHub
          </Button>
          <Button
            variant="secondary"
            onClick={onTest}
            disabled={test.isPending || !draft.comfyui_url}
          >
            {test.isPending ? "Testing…" : "Test ComfyUI"}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              testRh.mutate({
                api_key: draft.runninghub_api_key,
                instance_type: draft.runninghub_instance_type,
              })
            }
            disabled={testRh.isPending || !draft.runninghub_api_key}
          >
            {testRh.isPending ? "Testing…" : "Test RunningHub"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

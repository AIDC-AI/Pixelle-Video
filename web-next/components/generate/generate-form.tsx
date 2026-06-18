"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  CardDivider,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusSurface } from "@/components/ui/status-surface";
import { SectionCard } from "@/components/ui/section-card";
import { LoadingState } from "@/components/states/loading";
import { ErrorState } from "@/components/states/error";
import { useTaskStream } from "@/lib/api/hooks/use-tasks";
import {
  useBgm,
  useMediaWorkflows,
  useTemplates,
  useTtsWorkflows,
} from "@/lib/api/hooks/use-resources";
import { useVideoGenerateAsync } from "@/lib/api/hooks/use-video";
import {
  clearActiveTaskId,
  getActiveTaskId,
  setActiveTaskId,
} from "@/lib/api/active-task";
import { cn } from "@/lib/design/cn";
import { Settings2, Film, Music, Layout, Wand2 } from "lucide-react";

/**
 * Shared form scaffold for the five generate pipelines. Pipeline
 * pages pass a `PipelineKind` and any extra fields; submission
 * serialises into a single VideoGenerateRequest and dispatches to
 * `/api/video/generate/async` with a task ID we then poll.
 *
 * Task persistence: the active `task_id` is mirrored to
 * `localStorage` so a page reload (or a tab that opens the URL
 * after the work is in flight) can reattach to the in-flight SSE
 * stream instead of resetting to the empty "Submit to start"
 * state. We keep the id around after terminal states so the user
 * can refresh and still inspect the result; the next submission
 * (or a 404 from the server) clears it.
 */
export type PipelineKind =
  | "standard"
  | "asset_based"
  | "digital_human"
  | "i2v"
  | "action_transfer";

export interface GenerateFormProps {
  pipeline: PipelineKind;
  /** Heading + description for the pipeline-specific section. */
  extra?: React.ReactNode;
}

export function GenerateForm({ pipeline, extra }: GenerateFormProps) {
  const t = useTranslations("pipelines");
  const templates = useTemplates();
  const imageWorkflows = useMediaWorkflows();
  const ttsWorkflows = useTtsWorkflows();
  const bgms = useBgm();

  // Common fields
  const [template, setTemplate] = useState("");
  const [imageWorkflow, setImageWorkflow] = useState("");
  const [ttsWorkflow, setTtsWorkflow] = useState("");
  const [bgm, setBgm] = useState("");
  const [topic, setTopic] = useState("");
  const [nScenes, setNScenes] = useState(5);

  // Restore the in-flight task from `localStorage` so reload
  // doesn't drop us back to the empty state. The id stays null
  // for users with no prior submission on this browser.
  const [activeTaskId, setActiveTaskIdState] = useState<string | null>(null);
  useEffect(() => {
    setActiveTaskIdState(getActiveTaskId());
  }, []);

  // Defaults — once resources arrive, preselect the first option.
  useEffect(() => {
    if (!template && templates.data && templates.data[0]) {
      setTemplate(templates.data[0].key);
    }
  }, [template, templates.data]);
  useEffect(() => {
    if (!imageWorkflow && imageWorkflows.data && imageWorkflows.data[0]) {
      setImageWorkflow(imageWorkflows.data[0].key);
    }
  }, [imageWorkflow, imageWorkflows.data]);
  useEffect(() => {
    if (!ttsWorkflow && ttsWorkflows.data && ttsWorkflows.data[0]) {
      setTtsWorkflow(ttsWorkflows.data[0].key);
    }
  }, [ttsWorkflow, ttsWorkflows.data]);
  useEffect(() => {
    if (!bgm && bgms.data && bgms.data[0]) {
      setBgm(bgms.data[0].path);
    }
  }, [bgm, bgms.data]);

  const generate = useVideoGenerateAsync();

  // Mirror the mutation result into local state + storage. We only
  // overwrite the persisted id after a *new* submission, not when
  // restoring one on mount.
  useEffect(() => {
    const id = generate.data?.task_id;
    if (!id) return;
    setActiveTaskIdState(id);
    setActiveTaskId(id);
  }, [generate.data?.task_id]);

  const {
    task,
    isStreaming,
    error: taskError,
  } = useTaskStream(activeTaskId, {
    onNotFound: () => {
      // The server has forgotten this task (e.g. restart, 24h
      // retention cleanup, manual delete). Drop the stale id
      // so the UI goes back to the empty "Submit to start"
      // state instead of looping on a 404.
      clearActiveTaskId();
      setActiveTaskIdState(null);
    },
  });

  // When the user submits a new job, evict whatever was previously
  // shown (it might be a completed result they'd otherwise see
  // mixed with the new progress). The new task_id is mirrored into
  // `activeTaskId` by the effect above.
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTaskId) {
      clearActiveTaskId();
      setActiveTaskIdState(null);
    }
    generate.mutate({
      topic,
      template,
      n_scenes: nScenes,
      workflow_image: imageWorkflow || undefined,
      workflow_tts: ttsWorkflow || undefined,
      bgm: bgm || undefined,
    });
  };

  const hasActiveJob = Boolean(generate.data?.task_id) || Boolean(activeTaskId);
  const showInitialState = !hasActiveJob && !task;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Form column */}
      <div className="space-y-6 lg:col-span-2">
        {/* Content & topic */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-brand-primary-600" aria-hidden />
              <CardTitle>Content</CardTitle>
            </div>
            <CardDescription>
              {t(`${pipeline}.description` as never)}
            </CardDescription>
          </CardHeader>
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-5">
              <Field label="Topic" htmlFor="topic" required>
                <Textarea
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Why reading is the ultimate life hack"
                  required
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Number of scenes" htmlFor="n">
                  <Input
                    id="n"
                    type="number"
                    min={1}
                    max={20}
                    value={nScenes}
                    onChange={(e) => setNScenes(Number(e.target.value))}
                  />
                </Field>

                <Field label="Template" htmlFor="template">
                  <ResourceSelect
                    id="template"
                    value={template}
                    onChange={setTemplate}
                    options={(templates.data ?? []).map((tpl) => ({
                      value: tpl.key,
                      label: `${tpl.display_name} (${tpl.width}×${tpl.height})`,
                    }))}
                    loading={templates.isLoading}
                  />
                </Field>
              </div>

              <CardDivider />

              {/* Workflow settings — grouped visually */}
              <div>
                <p className="mb-3 flex items-center gap-2 text-label font-medium text-neutral-700">
                  <Settings2 className="h-3.5 w-3.5" aria-hidden />
                  Workflow settings
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Image workflow" htmlFor="img-wf">
                    <ResourceSelect
                      id="img-wf"
                      value={imageWorkflow}
                      onChange={setImageWorkflow}
                      options={(imageWorkflows.data ?? []).map((w) => ({
                        value: w.key,
                        label: w.display_name,
                      }))}
                      loading={imageWorkflows.isLoading}
                    />
                  </Field>
                  <Field label="TTS workflow" htmlFor="tts-wf">
                    <ResourceSelect
                      id="tts-wf"
                      value={ttsWorkflow}
                      onChange={setTtsWorkflow}
                      options={(ttsWorkflows.data ?? []).map((w) => ({
                        value: w.key,
                        label: w.display_name,
                      }))}
                      loading={ttsWorkflows.isLoading}
                    />
                  </Field>
                  <Field label="Background music" htmlFor="bgm">
                    <ResourceSelect
                      id="bgm"
                      value={bgm}
                      onChange={setBgm}
                      options={[
                        { value: "", label: "No BGM" },
                        ...(bgms.data ?? []).map((b) => ({
                          value: b.path,
                          label: b.name,
                        })),
                      ]}
                      loading={bgms.isLoading}
                    />
                  </Field>
                </div>
              </div>

              {extra ? (
                <>
                  <CardDivider />
                  {extra}
                </>
              ) : null}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={generate.isPending || isStreaming}
                >
                  <Film className="h-4 w-4" aria-hidden />
                  Generate video
                </Button>
                {generate.isError ? (
                  <span className="text-body-sm text-error">
                    {(generate.error as Error)?.message ?? "Failed to start"}
                  </span>
                ) : null}
              </div>
            </form>
          </CardBody>
        </Card>
      </div>

      {/* Panel column — progress & result */}
      <aside className="space-y-4">
        {/* Progress panel */}
        <SectionCard
          title="Progress"
          description="Track your generation in real time."
          accent={getProgressAccent(task)}
        >
          {showInitialState ? (
            <div className="flex flex-col items-center py-4 text-center">
              <Layout className="h-10 w-10 text-neutral-300" aria-hidden />
              <p className="mt-3 text-body-sm text-text-muted">
                Submit the form to start a generation.
              </p>
            </div>
          ) : taskError ? (
            <StatusSurface
              tone="error"
              title="Connection lost"
              message={taskError}
            />
          ) : task ? (
            <ProgressView
              taskId={task.task_id}
              status={task.status}
              progress={task.progress}
              message={task.message ?? null}
              errorCode={task.error_detail?.code}
            />
          ) : (
            <LoadingState rows={2} label="Starting" />
          )}
        </SectionCard>

        {/* Result panel */}
        {task?.status === "completed" && task.result ? (
          <SectionCard
            title="Result"
            description="Your video is ready."
            accent="success"
          >
            <ResultView result={task.result} />
          </SectionCard>
        ) : null}
      </aside>
    </div>
  );
}

function getProgressAccent(
  task: ReturnType<typeof useTaskStream>["task"],
): false | "info" | "success" | "warning" | "error" {
  if (!task) return false;
  if (task.status === "completed") return "success";
  if (task.status === "failed") return "error";
  if (task.status === "cancelled") return "warning";
  return "info";
}

function ResourceSelect({
  id,
  value,
  onChange,
  options,
  loading,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  loading?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-11 w-full rounded-md border border-neutral-300 bg-neutral-0 px-3 text-body text-neutral-800",
        "transition-colors focus:border-brand-primary-600 focus:outline-none focus:ring-2 focus:ring-brand-primary-300",
        "disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400",
      )}
      disabled={loading}
    >
      {options.map((o) => (
        <option key={o.value || "(empty)"} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ProgressView({
  taskId,
  status,
  progress,
  message,
  errorCode,
}: {
  taskId: string;
  status: string;
  progress: number;
  message: string | null;
  errorCode?: string;
}) {
  const t = useTranslations("task.error");
  const isFailed = status === "failed";
  const isCompleted = status === "completed";
  const isPending = status === "pending" || status === "running";

  const statusLabels: Record<string, string> = {
    pending: "Queued",
    running: "Processing",
    completed: "Complete",
    failed: "Failed",
    cancelled: "Cancelled",
  };

  const tone = isFailed
    ? "error"
    : isCompleted
      ? "success"
      : status === "cancelled"
        ? "warning"
        : isPending && !message
          ? "loading"
          : "info";

  const title = message ?? statusLabels[status] ?? status;
  const friendlyError = errorCode ? (t(errorCode) as string) : message;

  return (
    <div className="space-y-3">
      <StatusSurface
        tone={tone}
        title={title}
        message={isFailed ? (friendlyError ?? undefined) : undefined}
        progress={!isFailed && !isCompleted ? progress : undefined}
        spin={status === "running" && !message}
      />

      {isFailed && friendlyError ? (
        <div
          className="rounded-md bg-error-soft p-3 text-body-sm text-error"
          role="alert"
        >
          <p className="font-medium">Error detail</p>
          <p className="mt-1">{friendlyError}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="text-caption text-text-muted">
          Task:{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">
            {taskId.slice(0, 12)}…
          </code>
        </span>
        <Badge
          tone={
            isCompleted
              ? "success"
              : isFailed
                ? "error"
                : status === "cancelled"
                  ? "warning"
                  : "info"
          }
        >
          {statusLabels[status] ?? status}
        </Badge>
      </div>
    </div>
  );
}

function ResultView({ result }: { result: Record<string, unknown> }) {
  const videoUrl = (result.video_url as string) ?? "";

  if (!videoUrl) {
    return (
      <pre className="overflow-x-auto rounded-md bg-neutral-50 p-3 text-caption">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-3">
      <video
        controls
        className="w-full rounded-md border border-neutral-200"
        src={videoUrl}
      >
        Your browser does not support the video tag.
      </video>
      <a
        href={videoUrl}
        download
        className="inline-flex items-center gap-2 text-body-sm font-medium text-brand-primary-700 hover:text-brand-primary-800 hover:underline"
      >
        <Film className="h-4 w-4" aria-hidden />
        Download video
      </a>
    </div>
  );
}

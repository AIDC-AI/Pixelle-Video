'use client';

import Link from 'next/link';
import React, { Suspense, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Copy, Download, Film, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiClient, type ApiError } from '@/lib/api-client';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useTaskDetail } from '@/lib/hooks/use-task-list';
import { useProjects } from '@/lib/hooks/use-projects';
import {
  buildRegenerateHref,
  formatFileSize,
  formatRelativeTime,
  getTaskResult,
  inferPipeline,
  isRecord,
  statusBadgeClassName,
  statusLabel,
} from '@/lib/pipeline-utils';
import { ConfigSummary } from '@/components/create/config-summary';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { components, paths } from '@/types/api';

type Task = components['schemas']['Task'];
type LibraryVideoDetailResponse =
  paths['/api/library/videos/{video_id}']['get']['responses'][200]['content']['application/json'];

type NormalizedVideoDetail = {
  completedAt?: string | null;
  createdAt?: string | null;
  duration?: number | null;
  fileSize?: number | null;
  nFrames?: number | null;
  pipelineLabel?: string;
  projectId?: string | null;
  snapshot?: Record<string, unknown>;
  taskId: string;
  title: string;
  videoUrl?: string | null;
};

function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function toNumberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeLibraryDetail(
  payload: LibraryVideoDetailResponse,
  fallbackTaskId: string
): NormalizedVideoDetail | null {
  if (!isRecord(payload)) {
    return null;
  }

  const snapshot = isRecord(payload.snapshot) ? payload.snapshot : undefined;

  return {
    completedAt: toStringValue(payload.completed_at) ?? null,
    createdAt: toStringValue(payload.created_at) ?? null,
    duration: toNumberValue(payload.duration) ?? null,
    fileSize: toNumberValue(payload.file_size) ?? null,
    nFrames: toNumberValue(payload.n_frames) ?? null,
    pipelineLabel: toStringValue(payload.pipeline),
    projectId: toStringValue(payload.project_id) ?? null,
    snapshot,
    taskId: toStringValue(payload.task_id) ?? fallbackTaskId,
    title: toStringValue(payload.title) ?? fallbackTaskId,
    videoUrl: toStringValue(payload.video_url) ?? null,
  };
}

function getVideoUrl(detail: NormalizedVideoDetail | null, task: Task | undefined): string | undefined {
  const taskResult = getTaskResult(task);
  return detail?.videoUrl ?? taskResult?.video_url;
}

function getSnapshot(detail: NormalizedVideoDetail | null, task: Task | undefined): Record<string, unknown> | undefined {
  if (detail?.snapshot) {
    return detail.snapshot;
  }

  return isRecord(task?.request_params) ? task.request_params : undefined;
}

function VideoMetadataRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-3 text-sm last:border-none">
      <span className="text-muted-foreground">{label}</span>
      <div className="max-w-[60%] text-right font-medium text-foreground">{value}</div>
    </div>
  );
}

function LibraryVideoDetailContent() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const videoId = params.id;
  const taskQuery = useTaskDetail(videoId);
  const detailQuery = useQuery<LibraryVideoDetailResponse, ApiError>({
    queryKey: ['library', 'video', videoId],
    queryFn: () => apiClient<LibraryVideoDetailResponse>(`/api/library/videos/${videoId}`),
    retry: false,
  });

  const cancelTask = useMutation({
    mutationFn: (taskId: string) =>
      apiClient<paths['/api/tasks/{task_id}']['delete']['responses'][200]['content']['application/json']>(
        `/api/tasks/${taskId}`,
        { method: 'DELETE' }
      ),
    onSuccess: async () => {
      toast.success('Task cancelled.');
      setIsDeleteDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['task', 'detail', videoId] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['library', 'videos'] }),
      ]);
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Unable to cancel this task.';
      toast.error(message);
    },
  });

  const task = taskQuery.data;
  const detail =
    detailQuery.isSuccess
      ? normalizeLibraryDetail(detailQuery.data, videoId)
      : null;

  const pipeline = task ? inferPipeline(task) : null;
  const videoUrl = getVideoUrl(detail, task);
  const snapshot = getSnapshot(detail, task);
  const isLimitedDetail = detailQuery.error?.status === 501;
  const canCancelTask = task?.status === 'pending' || task?.status === 'running';
  const projectId = detail?.projectId ?? task?.project_id ?? null;
  const projectName = (projectsData?.items ?? []).find((project) => project.id === projectId)?.name ?? projectId ?? '—';
  const duration = detail?.duration ?? getTaskResult(task)?.duration ?? null;
  const fileSize = detail?.fileSize ?? getTaskResult(task)?.file_size ?? null;
  const taskResult = getTaskResult(task);
  const title = detail?.title ?? (isRecord(task?.request_params) && toStringValue(task.request_params.title)) ?? videoId;
  const createdAt = detail?.createdAt ?? task?.created_at ?? null;
  const status = task?.status ?? 'unknown';

  const regenerateHref = useMemo(() => {
    return task ? buildRegenerateHref(task) : undefined;
  }, [task]);

  if (detailQuery.isLoading && taskQuery.isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading video detail…</div>;
  }

  if (!detail && !task) {
    return (
      <div className="p-4">
        <EmptyState
          icon={Film}
          title="Video detail unavailable"
          description="The requested video could not be found in the current library index or task store."
          actionHref="/library/videos"
          actionLabel="Back to Library"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusBadgeClassName(status)}>{statusLabel(status)}</Badge>
            {pipeline ? <Badge variant="outline">{pipeline.label}</Badge> : null}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {createdAt ? formatRelativeTime(createdAt) : 'Unknown creation time'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {videoUrl ? (
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(videoUrl);
                toast.success('Video link copied.');
              }}
            >
              <Copy className="size-4" />
              Copy Link
            </Button>
          ) : null}

          {videoUrl ? (
            <Button
              variant="outline"
              render={<a href={videoUrl} download target="_blank" rel="noreferrer" />}
            >
              <Download className="size-4" />
              Download
            </Button>
          ) : null}

          {regenerateHref ? (
            <Button
              onClick={() => {
                if (projectId) {
                  setCurrentProject({ id: projectId, name: typeof projectName === 'string' ? projectName : String(projectId) });
                }
                router.push(regenerateHref);
              }}
            >
              <RefreshCcw className="size-4" />
              Regenerate From This
            </Button>
          ) : null}

          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>

      {isLimitedDetail ? (
        <Card className="border-[hsl(32,85%,52%)]/40 bg-[hsl(32,85%,52%)]/10 shadow-none">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[hsl(32,85%,52%)]" />
            <p>
              Detailed library metadata is not available yet. This page is showing the task record fallback, so some
              fields may be limited until the richer `/api/library/videos/{'{id}'}` endpoint ships.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-border/70 bg-card shadow-none">
            <CardHeader className="border-b">
              <CardTitle>Video</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {videoUrl ? (
                <div className="aspect-video bg-black">
                  <video src={videoUrl} controls className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center bg-muted/30 text-sm text-muted-foreground">
                  The video file is not available for preview yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader className="border-b">
              <CardTitle>Generation Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {snapshot ? (
                <ConfigSummary config={snapshot} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No generation snapshot is available for this video.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-card shadow-none">
          <CardHeader className="border-b">
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <VideoMetadataRow label="Task ID" value={<span className="font-mono text-xs">{videoId}</span>} />
            <VideoMetadataRow
              label="Project"
              value={
                projectId ? (
                  <Link href={`/library/videos?project_id=${encodeURIComponent(projectId)}`} className="text-primary underline-offset-4 hover:underline">
                    {projectName}
                  </Link>
                ) : (
                  'Unassigned'
                )
              }
            />
            <VideoMetadataRow label="Duration" value={duration ? `${duration.toFixed(1)}s` : '—'} />
            <VideoMetadataRow label="File Size" value={formatFileSize(fileSize)} />
            <VideoMetadataRow label="Frames" value={detail?.nFrames ?? '—'} />
            <VideoMetadataRow label="Created" value={createdAt ?? '—'} />
            <VideoMetadataRow label="Pipeline" value={detail?.pipelineLabel ?? pipeline?.label ?? '—'} />
            {taskResult?.video_path ? (
              <VideoMetadataRow label="Stored Path" value={<span className="font-mono text-xs">{taskResult.video_path}</span>} />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{canCancelTask ? 'Cancel task?' : 'Deletion unavailable'}</DialogTitle>
            <DialogDescription>
              {canCancelTask
                ? 'The current backend exposes task cancellation here. Pending or running work will stop, and the queue/library views will refresh.'
                : 'The current Phase 1/2 backend does not expose completed-history deletion yet. You can still copy or regenerate from this video.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Close
            </Button>
            {canCancelTask ? (
              <Button
                variant="destructive"
                onClick={() => {
                  void cancelTask.mutateAsync(videoId);
                }}
                disabled={cancelTask.isPending}
              >
                Confirm Cancel
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LibraryVideoDetailPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading detail…</div>}>
      <LibraryVideoDetailContent />
    </Suspense>
  );
}

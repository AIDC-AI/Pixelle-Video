'use client';

import Link from 'next/link';
import React, { Suspense, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, Film, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiClient, type ApiError } from '@/lib/api-client';
import { toApiFileUrl } from '@/lib/file-url';
import { useAppTranslations } from '@/lib/i18n';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useProjects } from '@/lib/hooks/use-projects';
import { useTaskDetail } from '@/lib/hooks/use-task-list';
import { useVideoShortcuts } from '@/lib/hooks/use-video-shortcuts';
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
import type { ConfigSummaryItem } from '@/lib/resource-display';
import { getBgmModeLabel, getStyleReferenceDisplayName, getWorkflowReferenceDisplayName } from '@/lib/resource-display';
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
type DeleteLibraryVideoResponse =
  paths['/api/library/videos/{video_id}']['delete']['responses'][200]['content']['application/json'];

type NormalizedVideoDetail = {
  completedAt?: string | null;
  createdAt?: string | null;
  duration?: number | null;
  fileSize?: number | null;
  nFrames?: number | null;
  pipelineLabel?: string;
  projectId?: string | null;
  snapshot?: Record<string, unknown>;
  storyboard?: Record<string, unknown> | null;
  taskId: string;
  title: string;
  videoPath?: string | null;
  videoUrl?: string | null;
};

type StoryboardFrame = {
  audioUrl?: string;
  composedFrameUrl?: string;
  duration?: number;
  imagePrompt?: string;
  imageUrl?: string;
  narration?: string;
  videoUrl?: string;
};

function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function toNumberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getStringFromKeys(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = toStringValue(record[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function getNumberFromKeys(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNumberValue(record[key]);
    if (typeof value === 'number') {
      return value;
    }
  }

  return undefined;
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
    storyboard: isRecord(payload.storyboard) ? payload.storyboard : null,
    taskId: toStringValue(payload.task_id) ?? fallbackTaskId,
    title: toStringValue(payload.title) ?? fallbackTaskId,
    videoPath: toStringValue(payload.video_path) ?? null,
    videoUrl: toStringValue(payload.video_url) ?? null,
  };
}

function getVideoUrl(detail: NormalizedVideoDetail | null, task: Task | undefined): string | undefined {
  const taskResult = getTaskResult(task);
  return detail?.videoUrl ?? toApiFileUrl(detail?.videoPath) ?? taskResult?.video_url;
}

function getSnapshot(detail: NormalizedVideoDetail | null, task: Task | undefined): Record<string, unknown> | undefined {
  if (detail?.snapshot) {
    return detail.snapshot;
  }

  return isRecord(task?.request_params) ? task.request_params : undefined;
}

function normalizeStoryboardFrames(detail: NormalizedVideoDetail | null): StoryboardFrame[] {
  if (!detail?.storyboard || !Array.isArray(detail.storyboard.frames)) {
    return [];
  }

  return detail.storyboard.frames.flatMap((frame) => {
    if (!isRecord(frame)) {
      return [];
    }

    return [
      {
        narration: getStringFromKeys(frame, ['narration', 'text']),
        imagePrompt: getStringFromKeys(frame, ['image_prompt', 'prompt']),
        audioUrl: toApiFileUrl(getStringFromKeys(frame, ['audio_url', 'audio_path'])) ?? undefined,
        imageUrl: toApiFileUrl(getStringFromKeys(frame, ['image_url', 'image_path'])) ?? undefined,
        videoUrl:
          toApiFileUrl(
            getStringFromKeys(frame, ['video_url', 'video_path', 'segment_video_url', 'segment_video_path'])
          ) ?? undefined,
        composedFrameUrl:
          toApiFileUrl(
            getStringFromKeys(frame, ['composed_frame_url', 'composed_frame_path', 'frame_url', 'frame_path'])
          ) ?? undefined,
        duration: getNumberFromKeys(frame, ['segment_duration', 'duration']),
      },
    ];
  });
}

function getSnapshotSummaryItems(
  snapshot: Record<string, unknown> | undefined,
  t: ReturnType<typeof useAppTranslations>
): ConfigSummaryItem[] {
  if (!snapshot) {
    return [];
  }

  const styleId = toStringValue(snapshot.style_id);
  const ttsWorkflow = getStringFromKeys(snapshot, ['tts_workflow', 'voice_workflow']);
  const mediaWorkflow = getStringFromKeys(snapshot, ['media_workflow', 'pose_workflow']);
  const bgmMode = getStringFromKeys(snapshot, ['bgm_mode']) as 'default' | 'custom' | 'none' | undefined;
  const sceneCount = Array.isArray(snapshot.scenes) ? snapshot.scenes.length : undefined;
  const instanceType = toStringValue(snapshot.runninghub_instance_type);

  const items: ConfigSummaryItem[] = [
    {
      key: 'style',
      label: t('summary.style'),
      value: getStyleReferenceDisplayName(styleId),
    },
    {
      key: 'tts_workflow',
      label: t('summary.tts'),
      value: ttsWorkflow ? getWorkflowReferenceDisplayName(ttsWorkflow) : t('summary.notSelected'),
    },
    {
      key: 'media_workflow',
      label: t('summary.media'),
      value: mediaWorkflow ? getWorkflowReferenceDisplayName(mediaWorkflow) : t('summary.notSelected'),
    },
    {
      key: 'bgm_mode',
      label: t('summary.bgm'),
      value:
        bgmMode === 'custom'
          ? t('summary.bgmCustom')
          : bgmMode === 'default'
            ? t('summary.bgmDefault')
            : bgmMode === 'none'
              ? getBgmModeLabel(bgmMode)
              : t('summary.notSelected'),
    },
  ];

  if (typeof sceneCount === 'number') {
    items.push({
      key: 'scenes',
      label: t('summary.scenes'),
      value: t('summary.sceneCount', { count: sceneCount }),
    });
  }

  if (instanceType) {
    items.push({
      key: 'runninghub_instance_type',
      label: t('summary.runninghub'),
      value: instanceType === 'plus' ? t('summary.runninghubPlus') : t('summary.runninghubAuto'),
    });
  }

  return items;
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
  const t = useAppTranslations('libraryVideoDetail');
  const common = useAppTranslations('common');
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
      toast.success(t('cancelSuccess'));
      setIsActionDialogOpen(false);
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
          : t('cancelTaskDescription');
      toast.error(message);
    },
  });

  const deleteVideo = useMutation({
    mutationFn: (taskId: string) =>
      apiClient<DeleteLibraryVideoResponse>(`/api/library/videos/${taskId}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      toast.success(t('deleteSuccess'));
      setIsActionDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['library', 'videos'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      ]);
      router.push('/library/videos');
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : t('deleteDescription');
      toast.error(message);
    },
  });

  const task = taskQuery.data;
  const detail = detailQuery.isSuccess ? normalizeLibraryDetail(detailQuery.data, videoId) : null;
  const storyboardFrames = normalizeStoryboardFrames(detail);

  const pipeline = task ? inferPipeline(task) : null;
  const videoUrl = getVideoUrl(detail, task);
  const snapshot = getSnapshot(detail, task);
  const snapshotSummaryItems = useMemo(() => getSnapshotSummaryItems(snapshot, t), [snapshot, t]);
  const canCancelTask = task?.status === 'pending' || task?.status === 'running';
  const canDeleteVideo = !canCancelTask && Boolean(detail);
  const projectId = detail?.projectId ?? task?.project_id ?? null;
  const projectName =
    (projectsData?.items ?? []).find((project) => project.id === projectId)?.name ?? projectId ?? t('unassigned');
  const duration = detail?.duration ?? getTaskResult(task)?.duration ?? null;
  const fileSize = detail?.fileSize ?? getTaskResult(task)?.file_size ?? null;
  const taskResult = getTaskResult(task);
  const title =
    detail?.title ?? (isRecord(task?.request_params) && toStringValue(task.request_params.title)) ?? videoId;
  const createdAt = detail?.createdAt ?? task?.created_at ?? null;
  const status = task?.status ?? 'unknown';
  const detailTaskId = detail?.taskId ?? videoId;
  useVideoShortcuts({ videoRef, enabled: Boolean(videoUrl) });

  const regenerateHref = useMemo(() => {
    return task ? buildRegenerateHref(task) : undefined;
  }, [task]);

  if (detailQuery.isLoading && taskQuery.isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">{t('loading')}</div>;
  }

  if (!detail && !task) {
    return (
      <div className="p-4">
        <EmptyState
          icon={Film}
          title={t('notFoundTitle')}
          description={t('notFoundDescription')}
          action={{
            href: '/library/videos',
            label: t('backToLibrary'),
            role: 'button',
          }}
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
            {createdAt ? formatRelativeTime(createdAt) : t('unknownCreatedAt')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {videoUrl ? (
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(videoUrl);
                toast.success(t('copySuccess'));
              }}
            >
              <Copy className="size-4" />
              {common('copyLink')}
            </Button>
          ) : null}

          {videoUrl ? (
            <Button
              nativeButton={false}
              variant="outline"
              render={<a href={videoUrl} download target="_blank" rel="noreferrer" />}
            >
              <Download className="size-4" />
              {common('download')}
            </Button>
          ) : null}

          {regenerateHref ? (
            <Button
              onClick={() => {
                if (projectId) {
                  setCurrentProject({
                    id: projectId,
                    name: typeof projectName === 'string' ? projectName : String(projectId),
                  });
                }
                router.push(regenerateHref);
              }}
            >
              <RefreshCcw className="size-4" />
              {common('regenerate')}
            </Button>
          ) : null}

          {(canCancelTask || canDeleteVideo) ? (
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setIsActionDialogOpen(true)}
            >
              <Trash2 className="size-4" />
              {canCancelTask ? t('cancelTask') : common('delete')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-border/70 bg-card shadow-none">
            <CardHeader className="border-b">
              <CardTitle>{t('video')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {videoUrl ? (
                <div className="aspect-video bg-black">
                  <video ref={videoRef} src={videoUrl} controls className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center bg-muted/30 text-sm text-muted-foreground">
                  {t('noVideo')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader className="border-b">
              <CardTitle>{t('snapshot')}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {snapshot ? (
                <ConfigSummary config={snapshot} items={snapshotSummaryItems} />
              ) : (
                <p className="text-sm text-muted-foreground">{t('noSnapshot')}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader className="border-b">
              <CardTitle>{t('storyboard')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {storyboardFrames.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('storyboardEmpty')}</p>
              ) : (
                storyboardFrames.map((frame, index) => (
                  <div key={`storyboard-frame-${index}`} className="space-y-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-foreground">{t('sceneLabel', { index: index + 1 })}</h3>
                      {typeof frame.duration === 'number' ? (
                        <Badge variant="outline">
                          {t('segmentDuration')}: {frame.duration.toFixed(1)}s
                        </Badge>
                      ) : null}
                    </div>

                    {frame.narration ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('narration')}</p>
                        <p className="text-sm text-foreground">{frame.narration}</p>
                      </div>
                    ) : null}

                    {frame.imagePrompt ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('prompt')}</p>
                        <p className="text-sm text-foreground">{frame.imagePrompt}</p>
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      {frame.audioUrl ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('audio')}</p>
                          <audio className="w-full" controls preload="none" src={frame.audioUrl} />
                        </div>
                      ) : null}

                      {frame.imageUrl ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('image')}</p>
                          <img
                            src={frame.imageUrl}
                            alt={t('image')}
                            loading="lazy"
                            decoding="async"
                            className="w-full rounded-xl border border-border/60"
                          />
                        </div>
                      ) : null}

                      {frame.videoUrl ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('videoSegment')}</p>
                          <video src={frame.videoUrl} controls className="w-full rounded-xl border border-border/60" />
                        </div>
                      ) : null}

                      {frame.composedFrameUrl ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('composedFrame')}</p>
                          <img
                            src={frame.composedFrameUrl}
                            alt={t('composedFrame')}
                            loading="lazy"
                            decoding="async"
                            className="w-full rounded-xl border border-border/60"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-card shadow-none">
          <CardHeader className="border-b">
            <CardTitle>{t('metadata')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <VideoMetadataRow label={t('taskId')} value={<span className="font-mono text-xs">{detailTaskId}</span>} />
            <VideoMetadataRow
              label={t('project')}
              value={
                projectId ? (
                  <Link
                    href={`/library/videos?project_id=${encodeURIComponent(projectId)}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {projectName}
                  </Link>
                ) : (
                  t('unassigned')
                )
              }
            />
            <VideoMetadataRow label={t('duration')} value={duration ? `${duration.toFixed(1)}s` : '—'} />
            <VideoMetadataRow label={t('fileSize')} value={formatFileSize(fileSize)} />
            <VideoMetadataRow label={t('frames')} value={detail?.nFrames ?? '—'} />
            <VideoMetadataRow label={t('created')} value={createdAt ?? '—'} />
            <VideoMetadataRow label={t('pipeline')} value={detail?.pipelineLabel ?? pipeline?.label ?? '—'} />
            {taskResult?.video_path || detail?.videoPath ? (
              <VideoMetadataRow
                label={t('storedPath')}
                value={<span className="font-mono text-xs">{detail?.videoPath ?? taskResult?.video_path}</span>}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{canCancelTask ? t('cancelTask') : t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {canCancelTask ? t('cancelTaskDescription') : t('deleteDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
              {common('close')}
            </Button>
            {canCancelTask ? (
              <Button
                variant="destructive"
                onClick={() => {
                  void cancelTask.mutateAsync(detailTaskId);
                }}
                disabled={cancelTask.isPending}
              >
                {t('confirmCancel')}
              </Button>
            ) : canDeleteVideo ? (
              <Button
                variant="destructive"
                onClick={() => {
                  void deleteVideo.mutateAsync(detailTaskId);
                }}
                disabled={deleteVideo.isPending}
              >
                {t('confirmDelete')}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LibraryVideoDetailPage() {
  const t = useAppTranslations('libraryVideoDetail');

  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('loading')}</div>}>
      <LibraryVideoDetailContent />
    </Suspense>
  );
}

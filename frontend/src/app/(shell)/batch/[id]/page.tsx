'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FolderArchive, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { BatchProgressBar } from '@/components/batch/batch-progress-bar';
import { BatchStatusBadge } from '@/components/batch/batch-status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';
import { apiClient, type ApiError } from '@/lib/api-client';
import { useBatchDetail, useDeleteBatch } from '@/lib/hooks/use-batches';
import { batchPipelineLabel, getBatchChildProgressPercent, getBatchChildProgressMessage, isTerminalBatchStatus } from '@/lib/batch-utils';
import { buildResumeHref, formatRelativeTime, statusBadgeClassName, statusLabel } from '@/lib/pipeline-utils';
import type { components, paths } from '@/types/api';
import { cn } from '@/lib/utils';

type Task = components['schemas']['Task'];
const EMPTY_TASKS: Task[] = [];

function formatRuntime(task: Task): string {
  if (!task.started_at || !task.completed_at) {
    return '—';
  }

  const startedAt = Date.parse(task.started_at);
  const completedAt = Date.parse(task.completed_at);

  if (Number.isNaN(startedAt) || Number.isNaN(completedAt) || completedAt < startedAt) {
    return '—';
  }

  const durationSeconds = Math.round((completedAt - startedAt) / 1000);
  return `${durationSeconds}s`;
}

function getTaskVideoUrl(task: Task): string | undefined {
  const result = task.result;
  return result && typeof result === 'object' && result !== null && 'video_url' in result && typeof result.video_url === 'string'
    ? result.video_url
    : undefined;
}

function BatchDetailPageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const deleteBatch = useDeleteBatch();
  const [dialogMode, setDialogMode] = useState<'cancel' | 'delete' | null>(null);

  const batchId = params.id;
  const batchQuery = useBatchDetail(batchId, 5_000);

  const cancelTask = useMutation({
    mutationFn: (taskId: string) =>
      apiClient<paths['/api/tasks/{task_id}']['delete']['responses'][200]['content']['application/json']>(
        `/api/tasks/${taskId}`,
        { method: 'DELETE' }
      ),
    onSuccess: async () => {
      toast.success('Task cancelled.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['batches', 'detail', batchId] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      ]);
    },
  });

  const batch = batchQuery.data;
  const children = batch?.children ?? EMPTY_TASKS;
  const completedChildren = useMemo(
    () => children.filter((task) => task.status === 'completed' && Boolean(getTaskVideoUrl(task))),
    [children]
  );

  if (batchQuery.isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading batch detail…</div>;
  }

  if (!batch) {
    return (
      <div className="p-4">
        <EmptyState
          icon={FolderArchive}
          title="Batch not found"
          description="The requested batch could not be found or has already been removed."
          actionHref="/batch/list"
          actionLabel="Back to All Batches"
        />
      </div>
    );
  }

  const isActive = !isTerminalBatchStatus(batch.status);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <BatchStatusBadge status={batch.status} />
            <Badge variant="outline">{batchPipelineLabel(batch.pipeline)}</Badge>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">{batch.name ?? batch.id}</h1>
            <p className="text-sm text-muted-foreground">Created {formatRelativeTime(batch.created_at)}</p>
          </div>
          <div className="max-w-2xl">
            <BatchProgressBar
              total={batch.total}
              succeeded={batch.succeeded}
              failed={batch.failed}
              cancelled={batch.cancelled}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {completedChildren.length > 0 ? (
            <a href="#successful-outputs" className={cn(buttonVariants({ variant: 'outline' }))}>
              <Download className="size-4" />
              Download Outputs
            </a>
          ) : null}

          {isActive ? (
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive"
              onClick={() => setDialogMode('cancel')}
            >
              <XCircle className="size-4" />
              Cancel Batch
            </Button>
          ) : (
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive"
              onClick={() => setDialogMode('delete')}
            >
              <Trash2 className="size-4" />
              Delete Batch
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_1.2fr] gap-4 border-b border-border/70 bg-muted/20 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Task ID</span>
          <span>Status</span>
          <span>Progress</span>
          <span>Runtime</span>
          <span className="text-right">Actions</span>
        </div>

        {children.map((task) => (
          <div
            key={task.task_id}
            className="grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_1.2fr] gap-4 border-b border-border/60 px-4 py-4 last:border-none"
          >
            <div className="space-y-1">
              <div className="font-mono text-xs text-foreground">{task.task_id}</div>
              {task.batch_id ? <p className="text-xs text-muted-foreground">{task.batch_id}</p> : null}
            </div>
            <div>
              <Badge className={statusBadgeClassName(task.status)}>{statusLabel(task.status)}</Badge>
            </div>
            <div className="space-y-2">
              <Progress value={getBatchChildProgressPercent(task)} className="h-2">
                <ProgressTrack>
                  <ProgressIndicator className="bg-primary" />
                </ProgressTrack>
              </Progress>
              <p className="text-xs text-muted-foreground">{getBatchChildProgressMessage(task)}</p>
            </div>
            <div className="text-sm text-muted-foreground">{formatRuntime(task)}</div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(
                    task.status === 'pending' || task.status === 'running'
                      ? buildResumeHref(task)
                      : `/library/videos/${task.task_id}`
                  )
                }
              >
                View
              </Button>
              {(task.status === 'pending' || task.status === 'running') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive"
                  onClick={() => {
                    void cancelTask.mutateAsync(task.task_id);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {children.length === 0 ? (
        <EmptyState
          icon={FolderArchive}
          title="No child tasks yet"
          description="This batch does not currently have any visible child tasks to monitor."
          actionHref="/batch/list"
          actionLabel="Back to All Batches"
        />
      ) : null}

      {completedChildren.length > 0 ? (
        <Card id="successful-outputs" className="border-border/70 bg-card shadow-none">
          <CardHeader>
            <CardTitle>Successful Outputs</CardTitle>
            <CardDescription>
              Direct download links for completed tasks. ZIP bundling is deferred to a later phase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedChildren.map((task) => {
              const videoUrl = getTaskVideoUrl(task);

              return (
                <div key={`download-${task.task_id}`} className="flex flex-col gap-3 rounded-2xl border border-border/70 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{task.task_id}</p>
                    <p className="text-sm text-muted-foreground">Completed {formatRelativeTime(task.completed_at ?? task.created_at)}</p>
                  </div>
                  {videoUrl ? (
                    <a
                      href={videoUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: 'outline' }))}
                    >
                      <Download className="size-4" />
                      Download
                    </a>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'cancel' ? 'Cancel this batch?' : 'Delete this batch?'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'cancel'
                ? 'This will cancel unfinished child tasks and remove the batch from the active list.'
                : 'This will soft-delete the batch record. Child tasks are left untouched because the batch is already terminal.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void deleteBatch.mutateAsync(
                  { batchId, cascade: dialogMode === 'cancel' },
                  {
                    onSuccess: () => {
                      toast.success(dialogMode === 'cancel' ? 'Batch cancelled.' : 'Batch deleted.');
                      setDialogMode(null);
                      router.push('/batch/list');
                    },
                    onError: (error: ApiError) => {
                      toast.error(error.message);
                    },
                  }
                );
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BatchDetailPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading batch detail…</div>}>
      <BatchDetailPageContent />
    </Suspense>
  );
}

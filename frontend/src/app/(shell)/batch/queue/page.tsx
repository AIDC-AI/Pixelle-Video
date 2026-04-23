'use client';

import React, { Suspense, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, ListFilter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { usePolling } from '@/lib/hooks/use-polling';
import { useTaskList } from '@/lib/hooks/use-task-list';
import { useProjects } from '@/lib/hooks/use-projects';
import {
  buildResumeHref,
  formatRelativeTime,
  inferPipeline,
  isRecord,
  isTerminalTaskStatus,
  normalizeProjectFilterValue,
  projectFilterLabel,
  statusBadgeClassName,
  statusLabel,
} from '@/lib/pipeline-utils';
import { TaskDetailDrawer } from '@/components/batch/task-detail-drawer';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTable } from '@/components/shared/skeleton-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { components, paths } from '@/types/api';
import { useAppTranslations } from '@/lib/i18n';

type Task = components['schemas']['Task'];
type TaskStatus = components['schemas']['TaskStatus'];

const STATUS_FILTERS: Array<TaskStatus | 'all'> = [
  'all',
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
];
const QUEUE_GRID_CLASS = 'grid grid-cols-[1.4fr_0.8fr_1fr_1.2fr_1fr_1.2fr]';

function QueueRowActions({
  cancelLabel,
  onCancel,
  onRetry,
  onView,
  retryLabel,
  task,
  viewLabel,
}: {
  cancelLabel: string;
  onCancel: () => void;
  onRetry: () => void;
  onView: () => void;
  retryLabel: string;
  task: Task;
  viewLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={(event) => {
        event.stopPropagation();
        onView();
      }}>
        {viewLabel}
      </Button>
      {task.status === 'pending' || task.status === 'running' ? (
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/40 text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            onCancel();
          }}
        >
          {cancelLabel}
        </Button>
      ) : null}
      {task.status === 'failed' ? (
        <Button variant="outline" size="sm" onClick={(event) => {
          event.stopPropagation();
          onRetry();
        }}>
          <RefreshCw className="size-4" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

type RetryResponse = { task_id: string };

function buildRetryRequest(task: Task): { endpoint: string; payload: Record<string, unknown> } | null {
  if (!isRecord(task.request_params)) {
    return null;
  }

  const payload: Record<string, unknown> = {
    ...task.request_params,
    project_id: task.project_id ?? null,
  };

  switch (inferPipeline(task).slug) {
    case 'digital-human':
      return { endpoint: '/api/video/digital-human/async', payload };
    case 'i2v':
      return { endpoint: '/api/video/i2v/async', payload };
    case 'action-transfer':
      return { endpoint: '/api/video/action-transfer/async', payload };
    case 'custom':
      return { endpoint: '/api/video/custom/async', payload };
    case 'quick':
    default:
      return { endpoint: '/api/video/generate/async', payload };
  }
}

function BatchQueuePageContent() {
  const t = useAppTranslations('batch');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { currentProject, isHydrated, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();

  const projectFilter = normalizeProjectFilterValue(searchParams.get('project_id'), currentProject?.id);
  const rawStatusFilter = searchParams.get('status');
  const statusFilter = STATUS_FILTERS.includes((rawStatusFilter ?? 'all') as TaskStatus | 'all')
    ? ((rawStatusFilter ?? 'all') as TaskStatus | 'all')
    : 'all';
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const tasksQuery = useTaskList({
    projectFilter,
    refetchInterval: false,
    status: statusFilter,
  });
  usePolling(() => {
    void tasksQuery.refetch();
  }, 5_000, isHydrated);

  const cancelTask = useMutation({
    mutationFn: (taskId: string) =>
      apiClient<paths['/api/tasks/{task_id}']['delete']['responses'][200]['content']['application/json']>(
        `/api/tasks/${taskId}`,
        { method: 'DELETE' }
      ),
    onSuccess: async () => {
      toast.success(t('toasts.taskCancelled'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['library', 'videos'] }),
      ]);
    },
  });

  const retryTask = useMutation({
    mutationFn: async (task: Task) => {
      const retryRequest = buildRetryRequest(task);
      if (!retryRequest) {
        throw new Error('Task parameters are unavailable for retry.');
      }

      await apiClient(`/api/tasks/${task.task_id}`, { method: 'DELETE' });
      return apiClient<RetryResponse>(retryRequest.endpoint, {
        method: 'POST',
        body: JSON.stringify(retryRequest.payload),
      });
    },
    onSuccess: async () => {
      toast.success(document.documentElement.lang === 'zh-CN' ? '任务已重试。' : 'Task retried.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['library', 'videos'] }),
      ]);
    },
  });

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!searchParams.get('project_id') && currentProject?.id) {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set('project_id', currentProject.id);
      router.replace(`${pathname}?${nextSearchParams.toString()}`, { scroll: false });
    }
  }, [currentProject?.id, isHydrated, pathname, router, searchParams]);

  const updateSearchParams = (updates: Record<string, string | null | undefined>) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === 'all') {
        nextSearchParams.delete(key);
      } else {
        nextSearchParams.set(key, value);
      }
    });

    router.replace(
      nextSearchParams.toString() ? `${pathname}?${nextSearchParams.toString()}` : pathname,
      { scroll: false }
    );
  };

  const tasks = tasksQuery.data ?? [];
  const isLoading = tasksQuery.isLoading || !isHydrated;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">{t('queue.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('queue.description')}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="queue-status-filter">
              {t('shared.filters.status')}
            </label>
            <Select value={statusFilter} onValueChange={(value) => updateSearchParams({ status: value })}>
              <SelectTrigger id="queue-status-filter" aria-label={t('shared.filters.status')}>
                <SelectValue placeholder={t('shared.filters.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'all' ? t('shared.filters.allStatuses') : statusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="queue-project-filter">
              {t('shared.filters.project')}
            </label>
            <Select
              value={projectFilter}
              onValueChange={(value) => {
                const selectedProject = (projectsData?.items ?? []).find((project) => project.id === value);
                if (selectedProject) {
                  setCurrentProject({ id: selectedProject.id, name: selectedProject.name });
                }
                updateSearchParams({ project_id: value });
              }}
            >
              <SelectTrigger id="queue-project-filter" aria-label={t('shared.filters.project')}>
                <span data-slot="select-value" className="flex flex-1 text-left">
                  {projectFilterLabel(projectFilter, projectsData?.items ?? [])}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('shared.filters.allProjects')}</SelectItem>
                <SelectItem value="__unassigned__">{t('shared.filters.unassigned')}</SelectItem>
                {(projectsData?.items ?? []).map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? <SkeletonTable cellCount={6} gridClassName={QUEUE_GRID_CLASS} /> : null}

      {!isLoading && tasks.length === 0 ? (
        <EmptyState
          icon={ListFilter}
          title={t('queue.emptyTitle')}
          description={t('queue.emptyDescription', { project: projectFilterLabel(projectFilter, projectsData?.items ?? []), status: statusFilter === 'all' ? t('shared.filters.allStatuses') : statusLabel(statusFilter) })}
          action={{
            href: '/create',
            label: t('actions.goToCreate'),
            role: 'button',
          }}
        />
      ) : null}

      {!isLoading && tasks.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-none">
          <div className={`${QUEUE_GRID_CLASS} gap-4 border-b border-border/70 bg-muted/20 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground`}>
            <span>{t('queue.columns.taskId')}</span>
            <span>{t('queue.columns.status')}</span>
            <span>{t('queue.columns.pipeline')}</span>
            <span>{t('queue.columns.progress')}</span>
            <span>{t('queue.columns.created')}</span>
            <span className="text-right">{t('list.columns.actions')}</span>
          </div>

          {tasks.map((task) => {
            const pipeline = inferPipeline(task);
            const progress = task.progress?.percentage ?? (isTerminalTaskStatus(task.status) ? 100 : 0);

            return (
              <div
                key={task.task_id}
                className={`${QUEUE_GRID_CLASS} gap-4 border-b border-border/60 px-4 py-4 text-sm last:border-none`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedTaskId(task.task_id);
                  setIsDrawerOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedTaskId(task.task_id);
                    setIsDrawerOpen(true);
                  }
                }}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-xs text-foreground">{task.task_id}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        void navigator.clipboard.writeText(task.task_id);
                        toast.success(t('queue.taskIdCopied'));
                      }}
                    >
                      <Copy className="size-3.5" />
                      <span className="sr-only">{t('queue.copyTaskId')}</span>
                    </Button>
                  </div>
                  {task.project_id ? (
                  <p className="text-xs text-muted-foreground">
                      {projectFilterLabel(task.project_id, projectsData?.items ?? [])}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('shared.filters.unassigned')}</p>
                  )}
                </div>

                <div>
                  <Badge className={statusBadgeClassName(task.status)}>{statusLabel(task.status)}</Badge>
                </div>

                <div className="text-foreground">{pipeline.label}</div>

                <div className="space-y-2">
                  <Progress value={progress} className="h-2">
                    <ProgressTrack>
                      <ProgressIndicator className="bg-primary" />
                    </ProgressTrack>
                  </Progress>
                  <p className="text-xs text-muted-foreground">{task.progress?.message || statusLabel(task.status)}</p>
                </div>

                <div className="text-muted-foreground">{formatRelativeTime(task.created_at)}</div>

                <QueueRowActions
                  cancelLabel={t('actions.cancel')}
                  retryLabel={document.documentElement.lang === 'zh-CN' ? '重试' : 'Retry'}
                  task={task}
                  onCancel={() => {
                    void cancelTask.mutateAsync(task.task_id);
                  }}
                  onRetry={() => {
                    void retryTask.mutateAsync(task);
                  }}
                  onView={() => {
                    if (task.project_id) {
                      const selectedProject = (projectsData?.items ?? []).find((project) => project.id === task.project_id);
                      setCurrentProject({
                        id: task.project_id,
                        name: selectedProject?.name ?? task.project_id,
                      });
                    }

                    router.push(
                      task.status === 'pending' || task.status === 'running'
                        ? buildResumeHref(task)
                        : `/library/videos/${task.task_id}`
                    );
                  }}
                  viewLabel={t('actions.view')}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      <TaskDetailDrawer
        taskId={selectedTaskId}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onDelete={(taskId) => {
          void cancelTask.mutateAsync(taskId);
        }}
        onRetry={(taskId) => {
          const task = tasks.find((item) => item.task_id === taskId);
          if (!task) {
            return;
          }

          void retryTask.mutateAsync(task);
        }}
      />
    </div>
  );
}

export default function BatchQueuePage() {
  const t = useAppTranslations('batch');

  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('fallback.loadingQueue')}</div>}>
      <BatchQueuePageContent />
    </Suspense>
  );
}

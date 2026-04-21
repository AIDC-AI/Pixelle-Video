'use client';

import React, { Suspense, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, ListFilter } from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useTaskList } from '@/lib/hooks/use-task-list';
import { useProjects } from '@/lib/hooks/use-projects';
import {
  buildResumeHref,
  formatRelativeTime,
  inferPipeline,
  isTerminalTaskStatus,
  normalizeProjectFilterValue,
  projectFilterLabel,
  statusBadgeClassName,
  statusLabel,
} from '@/lib/pipeline-utils';
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
  onCancel,
  onView,
  task,
}: {
  onCancel: () => void;
  onView: () => void;
  task: Task;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onView}>
        View
      </Button>
      {task.status === 'pending' || task.status === 'running' ? (
        <Button variant="outline" size="sm" className="border-destructive/40 text-destructive" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

function BatchQueuePageContent() {
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

  const tasksQuery = useTaskList({
    projectFilter,
    refetchInterval: 5_000,
    status: statusFilter,
  });

  const cancelTask = useMutation({
    mutationFn: (taskId: string) =>
      apiClient<paths['/api/tasks/{task_id}']['delete']['responses'][200]['content']['application/json']>(
        `/api/tasks/${taskId}`,
        { method: 'DELETE' }
      ),
    onSuccess: async () => {
      toast.success('Task cancelled.');
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
          <h1 className="text-2xl font-bold text-foreground">Task Queue</h1>
          <p className="text-sm text-muted-foreground">
            Monitor project activity across pending, running, completed, failed, and cancelled tasks.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="queue-status-filter">
              Status
            </label>
            <Select value={statusFilter} onValueChange={(value) => updateSearchParams({ status: value })}>
              <SelectTrigger id="queue-status-filter" aria-label="Status filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'all' ? 'All Statuses' : statusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="queue-project-filter">
              Project
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
              <SelectTrigger id="queue-project-filter" aria-label="Project filter">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
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
          title="No matching tasks"
          description={`No tasks match ${statusFilter === 'all' ? 'the current filters' : statusLabel(statusFilter)} in ${projectFilterLabel(projectFilter, projectsData?.items ?? [])}.`}
          actionHref="/create"
          actionLabel="Go to Create"
        />
      ) : null}

      {!isLoading && tasks.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-none">
          <div className={`${QUEUE_GRID_CLASS} gap-4 border-b border-border/70 bg-muted/20 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground`}>
            <span>Task ID</span>
            <span>Status</span>
            <span>Pipeline</span>
            <span>Progress</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>

          {tasks.map((task) => {
            const pipeline = inferPipeline(task);
            const progress = task.progress?.percentage ?? (isTerminalTaskStatus(task.status) ? 100 : 0);

            return (
              <div
                key={task.task_id}
                className={`${QUEUE_GRID_CLASS} gap-4 border-b border-border/60 px-4 py-4 text-sm last:border-none`}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-xs text-foreground">{task.task_id}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => {
                        void navigator.clipboard.writeText(task.task_id);
                        toast.success('Task ID copied.');
                      }}
                    >
                      <Copy className="size-3.5" />
                      <span className="sr-only">Copy task ID</span>
                    </Button>
                  </div>
                  {task.project_id ? (
                    <p className="text-xs text-muted-foreground">
                      {projectFilterLabel(task.project_id, projectsData?.items ?? [])}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Unassigned</p>
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
                  task={task}
                  onCancel={() => {
                    void cancelTask.mutateAsync(task.task_id);
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
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function BatchQueuePage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading task queue…</div>}>
      <BatchQueuePageContent />
    </Suspense>
  );
}

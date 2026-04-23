'use client';

import Link from 'next/link';
import { Clock3, ListVideo } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useTaskList } from '@/lib/hooks/use-task-list';
import { useAppTranslations } from '@/lib/i18n';
import { formatRelativeTime, statusBadgeClassName, statusLabel } from '@/lib/pipeline-utils';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type Task = components['schemas']['Task'];

function shortTaskId(taskId: string): string {
  return taskId.length > 8 ? taskId.slice(0, 8) : taskId;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

function RecentTaskRow({ task, taskLabel }: { task: Task; taskLabel: string }) {
  const taskId = task.task_id;
  const shortId = shortTaskId(taskId);

  return (
    <Link
      href={`/library/videos/${taskId}`}
      aria-label={`${taskLabel} ${shortId}`}
      className="group flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground group-hover:text-primary">{shortId}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="size-3" />
          {formatRelativeTime(task.created_at)}
        </p>
      </div>
      <Badge className={cn(statusBadgeClassName(task.status), 'shrink-0')}>{statusLabel(task.status)}</Badge>
    </Link>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-md border border-dashed border-border/70 bg-background/50 px-4 py-6 text-center">
      <ListVideo className="mb-2 size-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function RecentTasksList({ projectId }: { projectId: string }) {
  const t = useAppTranslations('create');
  const { data, isError, isLoading, error } = useTaskList({ limit: 5, projectFilter: projectId });

  if (isLoading) {
    return (
      <div aria-label={t('workbench.recentTasks.loading')} className="space-y-2">
        <p className="sr-only">{t('workbench.recentTasks.loading')}</p>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonCard key={`recent-task-skeleton-${index}`} aspectClassName="hidden" className="rounded-md" rows={1} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {getErrorMessage(error, t('workbench.recentTasks.error'))}
      </div>
    );
  }

  const tasks = data ?? [];

  if (tasks.length === 0) {
    return <EmptyPanel message={t('workbench.recentTasks.empty')} />;
  }

  return (
    <div className="space-y-2">
      {tasks.slice(0, 5).map((task) => (
        <RecentTaskRow key={task.task_id} task={task} taskLabel={t('workbench.recentTasks.taskLabel')} />
      ))}
    </div>
  );
}

export function RecentTasksPanel() {
  const t = useAppTranslations('create');
  const { currentProjectId } = useCurrentProjectHydration();

  return (
    <aside className="rounded-md border border-border/70 bg-card/70 p-4 shadow-sm" aria-labelledby="recent-tasks-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="recent-tasks-title" className="text-sm font-semibold text-foreground">
          {t('workbench.recentTasks.title')}
        </h2>
        <ListVideo className="size-4 text-muted-foreground" />
      </div>

      {currentProjectId ? (
        <RecentTasksList projectId={currentProjectId} />
      ) : (
        <EmptyPanel message={t('workbench.recentTasks.emptyNoProject')} />
      )}
    </aside>
  );
}

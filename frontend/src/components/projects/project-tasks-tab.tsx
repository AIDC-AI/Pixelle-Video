'use client';

import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTable } from '@/components/shared/skeleton-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTaskList } from '@/lib/hooks/use-task-list';
import { formatRelativeTime, inferPipeline, statusBadgeClassName, statusLabel } from '@/lib/pipeline-utils';
import type { components } from '@/types/api';

type TaskStatus = components['schemas']['TaskStatus'];

export interface ProjectTasksTabProps {
  projectId: string;
}

const TASK_FILTERS: Array<TaskStatus | 'all'> = ['all', 'pending', 'running', 'completed', 'failed', 'cancelled'];

export function ProjectTasksTab({ projectId }: ProjectTasksTabProps) {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const tasksQuery = useTaskList({
    projectFilter: projectId,
    status: statusFilter,
  });

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  return (
    <Card className="border-border/70 bg-card shadow-none">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>项目任务</CardTitle>
        </div>
        <div className="w-full md:w-56">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | 'all')}>
            <SelectTrigger aria-label="任务状态筛选">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              {TASK_FILTERS.map((filter) => (
                <SelectItem key={filter} value={filter}>
                  {filter === 'all' ? '全部状态' : statusLabel(filter)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {tasksQuery.isLoading ? (
          <SkeletonTable cellCount={4} gridClassName="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto]" />
        ) : tasks.length === 0 ? (
          <EmptyState
            title="该项目还没有任务"
            description="开始一次创作或批处理之后，任务会出现在这里。"
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] gap-4 border-b border-border/70 bg-muted/30 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span>名称</span>
              <span>Pipeline</span>
              <span>状态</span>
              <span>创建时间</span>
            </div>
            {tasks.map((task) => (
              <div
                key={task.task_id}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] gap-4 border-b border-border/70 px-4 py-4 text-sm last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{task.task_id}</p>
                  <p className="truncate text-xs text-muted-foreground">{task.progress?.message ?? 'Ready'}</p>
                </div>
                <span className="text-muted-foreground">{inferPipeline(task).label}</span>
                <Badge className={statusBadgeClassName(task.status)}>{statusLabel(task.status)}</Badge>
                <span className="text-muted-foreground">{formatRelativeTime(task.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useMemo } from 'react';

import { useTaskList } from '@/lib/hooks/use-task-list';
import { inferPipeline } from '@/lib/pipeline-utils';
import type { DraftPipeline } from '@/lib/draft-store';

export function useTaskHistory(pipeline: DraftPipeline, projectId: string | null | undefined, limit = 20) {
  const tasksQuery = useTaskList({
    limit: Math.max(limit * 4, limit),
    projectFilter: projectId ?? 'all',
    refetchInterval: false,
    status: 'all',
  });

  const tasks = useMemo(
    () =>
      (tasksQuery.data ?? [])
        .filter((task) => inferPipeline(task).slug === pipeline)
        .sort(
          (left, right) =>
            Date.parse(right.created_at ?? '') - Date.parse(left.created_at ?? '')
        )
        .slice(0, limit),
    [limit, pipeline, tasksQuery.data]
  );

  return {
    isLoading: tasksQuery.isLoading,
    tasks,
  };
}

'use client';

import { useMemo, useState } from 'react';
import { History } from 'lucide-react';

import { useTaskHistory } from '@/lib/hooks/use-task-history';
import { formatRelativeTime, getTaskResult } from '@/lib/pipeline-utils';
import type { DraftPipeline } from '@/lib/draft-store';
import type { components } from '@/types/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Task = components['schemas']['Task'];

interface ParamHistoryDrawerProps {
  mapTaskToParams: (task: Task) => Record<string, unknown>;
  onApply: (params: Record<string, unknown>) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pipeline: DraftPipeline;
  projectId: string | null | undefined;
}

function summarizeParams(params: Record<string, unknown>): Array<{ key: string; value: string }> {
  return Object.entries(params)
    .filter(([, value]) => {
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      if (typeof value === 'number') {
        return true;
      }
      return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined;
    })
    .slice(0, 4)
    .map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }));
}

export function ParamHistoryDrawer({
  mapTaskToParams,
  onApply,
  onOpenChange,
  open,
  pipeline,
  projectId,
}: ParamHistoryDrawerProps) {
  const historyQuery = useTaskHistory(pipeline, projectId, 20);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const items = useMemo(
    () =>
      historyQuery.tasks.map((task) => ({
        params: mapTaskToParams(task),
        preview: getTaskResult(task)?.video_url,
        summary: summarizeParams(mapTaskToParams(task)),
        task,
      })),
    [historyQuery.tasks, mapTaskToParams]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-full max-w-[400px] translate-x-0 translate-y-0 rounded-none border-l border-border/70 p-0 sm:max-w-[400px]">
          <div className="flex h-full flex-col">
            <DialogHeader className="border-b border-border/70 px-5 py-4">
              <DialogTitle className="flex items-center gap-2">
                <History className="size-4" />
                历史参数
              </DialogTitle>
              <DialogDescription>
                从最近任务中挑选一组参数覆盖当前表单。
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {historyQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">正在加载历史记录…</p>
              ) : null}

              {!historyQuery.isLoading && items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                  还没有历史记录
                </div>
              ) : null}

              {items.map(({ params, preview, summary, task }) => (
                <button
                  key={task.task_id}
                  type="button"
                  className="w-full rounded-2xl border border-border/70 bg-card p-4 text-left"
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="flex items-start gap-3">
                    {preview ? (
                      <video src={preview} className="h-16 w-16 rounded-xl object-cover" muted />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <History className="size-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-foreground">{task.task_id}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(task.created_at)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {summary.map((item) => (
                          <p key={`${task.task_id}-${item.key}`} className="truncate text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{item.key}</span>: {item.value}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedTask)} onOpenChange={(nextOpen) => !nextOpen && setSelectedTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>覆盖当前参数？</DialogTitle>
            <DialogDescription>
              这会使用历史记录中的参数替换当前表单值。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTask(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!selectedTask) {
                  return;
                }

                onApply(mapTaskToParams(selectedTask));
                setSelectedTask(null);
                onOpenChange(false);
              }}
            >
              应用参数
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

'use client';

import { Copy, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useTaskDetail } from '@/lib/hooks/use-task-list';
import { formatFileSize, formatRelativeTime, getTaskResult, statusBadgeClassName, statusLabel } from '@/lib/pipeline-utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TaskDetailDrawerProps {
  onDelete?: (taskId: string) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  onRetry?: (taskId: string) => void | Promise<void>;
  open: boolean;
  taskId: string | null;
}

export function TaskDetailDrawer({
  onDelete,
  onOpenChange,
  onRetry,
  open,
  taskId,
}: TaskDetailDrawerProps) {
  const taskQuery = useTaskDetail(taskId ?? undefined, open && Boolean(taskId));
  const task = taskQuery.data;
  const result = getTaskResult(task);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-full max-w-[440px] translate-x-0 translate-y-0 rounded-none border-l border-border/70 p-0 sm:max-w-[440px]">
        <div className="flex h-full flex-col">
          <DialogHeader className="border-b border-border/70 px-5 py-4">
            <DialogTitle>任务详情</DialogTitle>
            <DialogDescription>
              {taskId ?? '选择一个任务查看详情。'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {taskQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">正在加载任务详情…</p>
            ) : null}

            {task ? (
              <>
                <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{task.task_id}</p>
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(task.created_at)}</p>
                    </div>
                    <Badge className={statusBadgeClassName(task.status)}>{statusLabel(task.status)}</Badge>
                  </div>

                  {result?.video_url ? (
                    <video src={result.video_url} controls className="w-full rounded-xl bg-black/80" />
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                      当前任务还没有可预览的输出。
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">进度</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {task.progress?.percentage ?? 0}% · {task.progress?.message ?? statusLabel(task.status)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">文件大小</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{formatFileSize(result?.file_size)}</p>
                    </div>
                  </div>

                  {task.error ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {task.error}
                    </div>
                  ) : null}
                </div>

                <Accordion>
                  <AccordionItem value="params">
                    <AccordionTrigger>参数摘要</AccordionTrigger>
                    <AccordionContent>
                      <pre className="overflow-x-auto rounded-xl bg-muted/20 p-3 text-xs text-foreground">
                        {JSON.stringify(task.request_params ?? {}, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/70 bg-card px-5 py-4 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (!task) {
                  return;
                }

                void navigator.clipboard.writeText(JSON.stringify(task.request_params ?? {}, null, 2));
                toast.success('参数已复制。');
              }}
            >
              <Copy className="size-4" />
              复制参数
            </Button>
            <div className="flex gap-2">
              {task && task.status === 'failed' && onRetry ? (
                <Button variant="outline" onClick={() => void onRetry(task.task_id)}>
                  <RefreshCw className="size-4" />
                  重试
                </Button>
              ) : null}
              {task && onDelete ? (
                <Button variant="outline" className="border-destructive/40 text-destructive" onClick={() => void onDelete(task.task_id)}>
                  <Trash2 className="size-4" />
                  删除
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

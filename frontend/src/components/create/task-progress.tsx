import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TaskProgressProps {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  onCancel?: () => void;
}

const statusColors = {
  pending: 'bg-[hsl(0,0%,60%)]',
  running: 'bg-[hsl(210,100%,60%)]',
  completed: 'bg-[hsl(142,70%,45%)]',
  failed: 'bg-[hsl(0,80%,60%)]',
};

const statusLabels = {
  pending: '排队中',
  running: '生成中',
  completed: '已完成',
  failed: '失败',
};

export function TaskProgress({ taskId, status, progress, currentStep, onCancel }: TaskProgressProps) {
  return (
    <Card className="bg-card border-border shadow-none">
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0 text-foreground">
        <CardTitle className="text-lg font-medium">任务进度</CardTitle>
        <Badge variant="outline" className={`${statusColors[status]} text-white border-none`}>
          {statusLabels[status]}
        </Badge>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-mono text-xs">ID: {taskId}</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2">
            <ProgressTrack>
              <ProgressIndicator className={statusColors[status]} />
            </ProgressTrack>
          </Progress>
          {currentStep && (
            <p className="text-sm text-muted-foreground text-center animate-pulse">{currentStep}</p>
          )}
        </div>

        {status === 'running' || status === 'pending' ? (
          <Button variant="destructive" className="w-full" onClick={onCancel}>
            取消任务
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

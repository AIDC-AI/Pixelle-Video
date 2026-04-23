'use client';

import React from 'react';
import { Ban } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfigSummary } from '@/components/create/config-summary';
import { TaskProgress } from '@/components/create/task-progress';
import { VideoResult } from '@/components/create/video-result';
import { useAppTranslations } from '@/lib/i18n';
import type { ConfigSummaryItem } from '@/lib/resource-display';
import type { components } from '@/types/api';

type TaskStatus = components['schemas']['TaskStatus'];

type VideoTaskResult = {
  video_url: string;
  video_path?: string;
  duration?: number;
  file_size?: number;
};

interface PipelineStatusPanelProps {
  config?: Record<string, unknown>;
  summaryItems?: ConfigSummaryItem[];
  taskId?: string;
  viewState: 'idle' | TaskStatus;
  activeTaskStatus: Extract<TaskStatus, 'pending' | 'running' | 'completed' | 'failed'>;
  progress: number;
  currentStep?: string;
  statusMessage: string;
  taskResult?: VideoTaskResult;
  onCancel: () => void | Promise<void>;
  onReset: () => void;
  aspectRatio?: 'portrait' | 'landscape';
}

export function PipelineStatusPanel({
  config,
  summaryItems,
  taskId,
  viewState,
  activeTaskStatus,
  progress,
  currentStep,
  statusMessage,
  taskResult,
  onCancel,
  onReset,
  aspectRatio = 'landscape',
}: PipelineStatusPanelProps) {
  const t = useAppTranslations('createCommon');

  return (
    <div className="flex flex-col gap-4">
      {viewState === 'idle' && config ? <ConfigSummary config={config} /> : null}

      {(viewState === 'pending' || viewState === 'running' || (viewState === 'completed' && !taskResult)) && taskId ? (
        <TaskProgress
          taskId={taskId}
          status={activeTaskStatus}
          progress={progress}
          currentStep={currentStep}
          onCancel={onCancel}
        />
      ) : null}

      {viewState === 'completed' && taskResult ? (
        <VideoResult
          videoUrl={taskResult.video_url}
          duration={taskResult.duration}
          fileSize={taskResult.file_size}
          onRegenerate={onReset}
          aspectRatio={aspectRatio}
        />
      ) : null}

      {viewState === 'failed' ? (
        <Card className="border-destructive bg-destructive/10 shadow-none">
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6 text-center">
            <div className="text-lg font-medium text-destructive">{t('generationFailed')}</div>
            <p className="text-sm text-destructive/80">{statusMessage}</p>
            <Button
              variant="outline"
              className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={onReset}
            >
              {t('reconfigure')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {viewState === 'cancelled' ? (
        <Card className="border-border bg-card shadow-none">
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Ban className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-lg font-medium text-foreground">{t('taskCancelled')}</div>
            <p className="text-sm text-muted-foreground">
              {statusMessage || t('taskCancelledDescription')}
            </p>
            <Button variant="outline" className="w-full" onClick={onReset}>
              {t('startOver')}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

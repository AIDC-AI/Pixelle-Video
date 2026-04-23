'use client';

import React, { useMemo } from 'react';
import { Cloud } from 'lucide-react';

import { WorkflowCard } from '@/components/advanced/workflow-card';
import { EmptyState } from '@/components/shared/empty-state';
import { LibraryGrid } from '@/components/library/library-grid';
import { Badge } from '@/components/ui/badge';
import { useImageWorkflows, useMediaWorkflows, useTtsWorkflows } from '@/lib/hooks/use-resources';
import { useAppTranslations } from '@/lib/i18n';
import type { components } from '@/types/api';

type WorkflowInfo = components['schemas']['WorkflowInfo'];
type SyncStatus = 'error' | 'outdated' | 'synced';

function dedupeWorkflows(items: WorkflowInfo[]): WorkflowInfo[] {
  return Array.from(new Map(items.map((workflow) => [workflow.key, workflow])).values());
}

function getRunningHubSyncStatus(workflow: WorkflowInfo): SyncStatus {
  if (!workflow.workflow_id) {
    return 'error';
  }

  if (typeof window === 'undefined') {
    return 'outdated';
  }

  const cacheTime = window.localStorage.getItem(`pixelle-runninghub-cache-${workflow.key}`);
  const workflowWithSyncMetadata = workflow as WorkflowInfo & { updated_at?: unknown };
  const updatedAt =
    typeof workflowWithSyncMetadata.updated_at === 'string' ? workflowWithSyncMetadata.updated_at : null;

  if (!cacheTime) {
    return 'outdated';
  }

  if (updatedAt && new Date(cacheTime).getTime() < new Date(updatedAt).getTime()) {
    return 'outdated';
  }

  return 'synced';
}

function syncBadgeClassName(status: SyncStatus): string {
  switch (status) {
    case 'synced':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700';
    case 'error':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    default:
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700';
  }
}

export default function RunningHubWorkflowsPage() {
  const t = useAppTranslations('workflows');
  const ttsQuery = useTtsWorkflows();
  const mediaQuery = useMediaWorkflows();
  const imageQuery = useImageWorkflows();

  const items = useMemo(
    () =>
      dedupeWorkflows([
        ...(ttsQuery.data?.workflows ?? []),
        ...(mediaQuery.data?.workflows ?? []),
        ...(imageQuery.data?.workflows ?? []),
      ]).filter((workflow) => workflow.source === 'runninghub'),
    [imageQuery.data?.workflows, mediaQuery.data?.workflows, ttsQuery.data?.workflows]
  );

  const isLoading = ttsQuery.isLoading || mediaQuery.isLoading || imageQuery.isLoading;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{t('runningHub.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('runningHub.description')}</p>
      </div>

      {isLoading ? (
        <LibraryGrid className="xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`runninghub-skeleton-${index}`} className="h-56 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          ))}
        </LibraryGrid>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <EmptyState
          icon={Cloud}
          title={t('runningHub.emptyTitle')}
          description={t('runningHub.emptyDescription')}
        />
      ) : null}

      {!isLoading && items.length > 0 ? (
        <LibraryGrid className="xl:grid-cols-3">
          {items.map((workflow) => {
            const syncStatus = getRunningHubSyncStatus(workflow);

            return (
              <div key={workflow.key} className="space-y-2">
                <div className="flex justify-end">
                  <Badge variant="outline" className={syncBadgeClassName(syncStatus)}>
                    {syncStatus}
                  </Badge>
                </div>
                <WorkflowCard workflow={workflow} />
              </div>
            );
          })}
        </LibraryGrid>
      ) : null}
    </div>
  );
}

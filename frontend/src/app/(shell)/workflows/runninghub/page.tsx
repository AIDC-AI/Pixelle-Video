'use client';

import React, { useMemo } from 'react';
import { Cloud } from 'lucide-react';

import { WorkflowCard } from '@/components/advanced/workflow-card';
import { EmptyState } from '@/components/shared/empty-state';
import { LibraryGrid } from '@/components/library/library-grid';
import { useImageWorkflows, useMediaWorkflows, useTtsWorkflows } from '@/lib/hooks/use-resources';
import type { components } from '@/types/api';

type WorkflowInfo = components['schemas']['WorkflowInfo'];

function dedupeWorkflows(items: WorkflowInfo[]): WorkflowInfo[] {
  return Array.from(new Map(items.map((workflow) => [workflow.key, workflow])).values());
}

export default function RunningHubWorkflowsPage() {
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
        <h1 className="text-2xl font-bold text-foreground">RunningHub Workflows</h1>
        <p className="text-sm text-muted-foreground">Cloud-hosted workflow endpoints delivered through the RunningHub connector.</p>
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
          title="No RunningHub workflows available"
          description="Connect a cloud workflow source to populate this catalog."
        />
      ) : null}

      {!isLoading && items.length > 0 ? (
        <LibraryGrid className="xl:grid-cols-3">
          {items.map((workflow) => (
            <WorkflowCard key={workflow.key} workflow={workflow} />
          ))}
        </LibraryGrid>
      ) : null}
    </div>
  );
}

'use client';

import React, { useMemo, useState } from 'react';
import { Layers3 } from 'lucide-react';

import { WorkflowCard } from '@/components/advanced/workflow-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { LibraryGrid } from '@/components/library/library-grid';
import { useImageWorkflows, useMediaWorkflows, useTtsWorkflows } from '@/lib/hooks/use-resources';

type WorkflowTab = 'tts' | 'media' | 'image';

const WORKFLOW_TABS: readonly { description: string; label: string; value: WorkflowTab }[] = [
  {
    value: 'tts',
    label: 'TTS',
    description: 'Voice and speech generation workflows available to the workbench.',
  },
  {
    value: 'media',
    label: 'Media',
    description: 'Image and video generation workflows currently connected to Pixelle.',
  },
  {
    value: 'image',
    label: 'Image',
    description: 'Image-specialized subsets preserved for compatibility with existing create flows.',
  },
];

export default function WorkflowsOverviewPage() {
  const [activeTab, setActiveTab] = useState<WorkflowTab>('tts');
  const ttsQuery = useTtsWorkflows();
  const mediaQuery = useMediaWorkflows();
  const imageQuery = useImageWorkflows();

  const tabItems = useMemo(() => {
    if (activeTab === 'tts') {
      return ttsQuery.data?.workflows ?? [];
    }

    if (activeTab === 'image') {
      return imageQuery.data?.workflows ?? [];
    }

    return mediaQuery.data?.workflows ?? [];
  }, [activeTab, imageQuery.data?.workflows, mediaQuery.data?.workflows, ttsQuery.data?.workflows]);

  const isLoading = ttsQuery.isLoading || mediaQuery.isLoading || imageQuery.isLoading;
  const activeDefinition = WORKFLOW_TABS.find((tab) => tab.value === activeTab) ?? WORKFLOW_TABS[0];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
        <p className="text-sm text-muted-foreground">
          Compare every connected workflow source, grouped by the runtime lane it powers inside Pixelle.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {WORKFLOW_TABS.map((tab) => (
          <Button
            key={tab.value}
            type="button"
            variant={activeTab === tab.value ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <p className="text-sm text-muted-foreground">{activeDefinition.description}</p>
      </div>

      {isLoading ? (
        <LibraryGrid>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`workflow-skeleton-${index}`} className="h-56 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          ))}
        </LibraryGrid>
      ) : null}

      {!isLoading && tabItems.length === 0 ? (
        <EmptyState
          icon={Layers3}
          title="No workflows found"
          description="No workflows are currently available for this category."
        />
      ) : null}

      {!isLoading && tabItems.length > 0 ? (
        <LibraryGrid className="xl:grid-cols-3">
          {tabItems.map((workflow) => (
            <WorkflowCard key={workflow.key} workflow={workflow} />
          ))}
        </LibraryGrid>
      ) : null}
    </div>
  );
}

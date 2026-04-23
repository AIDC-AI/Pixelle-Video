'use client';

import React, { useMemo, useState } from 'react';
import { Layers3 } from 'lucide-react';

import { WorkflowCard } from '@/components/advanced/workflow-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { LibraryGrid } from '@/components/library/library-grid';
import { useImageWorkflows, useMediaWorkflows, useTtsWorkflows } from '@/lib/hooks/use-resources';
import { useAppTranslations } from '@/lib/i18n';

type WorkflowTab = 'tts' | 'media' | 'image';

const WORKFLOW_TABS: readonly WorkflowTab[] = ['tts', 'media', 'image'];

export default function WorkflowsOverviewPage() {
  const t = useAppTranslations('workflows');
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
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{t('overview.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('overview.description')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {WORKFLOW_TABS.map((tab) => (
          <Button
            key={tab}
            type="button"
            variant={activeTab === tab ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab)}
          >
            {t(`overview.tabs.${tab}.label`)}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <p className="text-sm text-muted-foreground">{t(`overview.tabs.${activeTab}.description`)}</p>
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
          title={t('overview.emptyTitle')}
          description={t('overview.emptyDescription')}
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

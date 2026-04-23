'use client';

import Link from 'next/link';
import React, { Suspense, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AudioLines, Download, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { BulkActionBar } from '@/components/library/bulk-action-bar';
import { CompareView, type CompareAsset } from '@/components/library/compare-view';
import { LibraryFilterBar } from '@/components/library/library-filter-bar';
import { LibraryTable } from '@/components/library/library-table';
import { StarButton, useStarredAsset } from '@/components/library/star-button';
import { TagFilter } from '@/components/library/tag-filter';
import { ViewToggle, readLibraryView, writeLibraryView, type LibraryView } from '@/components/library/view-toggle';
import { WaveformPlayer } from '@/components/library/waveform-player';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTable } from '@/components/shared/skeleton-table';
import { Button, buttonVariants } from '@/components/ui/button';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useLibraryVoices } from '@/lib/hooks/use-library-assets';
import { useMultiSelect } from '@/lib/hooks/use-multi-select';
import { useProjects } from '@/lib/hooks/use-projects';
import { useAppTranslations } from '@/lib/i18n';
import {
  formatDurationClock,
  formatFileSize,
  formatRelativeTime,
  normalizeProjectFilterValue,
} from '@/lib/pipeline-utils';
import { getWorkflowReferenceDescription, getWorkflowReferenceDisplayName } from '@/lib/resource-display';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type VoiceItem = components['schemas']['VoiceItem'];

const DEFAULT_LIMIT = 16;
const TABLE_GRID_CLASS = 'grid grid-cols-[1fr_7rem_1.4fr_7rem_8rem_12rem]';

function buildReuseHref(item: VoiceItem): string {
  const params = new URLSearchParams();

  if (item.text) {
    params.set('narration', item.text);
  }

  if (item.tts_voice) {
    params.set('voice_workflow', item.tts_voice);
  }

  return `/create/digital-human${params.size > 0 ? `?${params.toString()}` : ''}`;
}

function voiceTags(item: VoiceItem): string[] {
  return [item.tts_voice, item.project_id ? 'project' : 'unassigned', item.batch_id ? 'batch' : null]
    .filter((tag): tag is string => Boolean(tag));
}

function VoiceRow({
  index,
  item,
  onSelect,
  selected,
}: {
  index: number;
  item: VoiceItem;
  onSelect: (id: string, index: number, shiftKey: boolean) => void;
  selected: boolean;
}) {
  const t = useAppTranslations('library');
  const { starred, toggleStarred } = useStarredAsset('voices', item.id);
  const voiceLabel = item.tts_voice
    ? getWorkflowReferenceDisplayName(item.tts_voice)
    : t('voices.unknownVoice');
  const voiceDetail = item.tts_voice ? getWorkflowReferenceDescription(item.tts_voice) : null;
  return (
    <div className={`${TABLE_GRID_CLASS} gap-4 border-b border-border/60 px-4 py-4 last:border-none`}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input
            aria-label={`Select ${voiceLabel}`}
            type="checkbox"
            checked={selected}
            onClick={(event) => onSelect(item.id, index, event.shiftKey)}
            onChange={() => undefined}
          />
          <StarButton size="sm" starred={starred} onToggle={toggleStarred} />
          <p className="text-sm font-medium text-foreground">{voiceLabel}</p>
        </div>
        {voiceDetail ? <p className="line-clamp-2 text-xs text-muted-foreground">{voiceDetail}</p> : null}
        <p className="line-clamp-2 text-xs text-muted-foreground">{item.text ?? t('voices.noTranscript')}</p>
      </div>

      <div className="text-sm text-foreground">{formatDurationClock(item.duration)}</div>

      <div className="min-w-0">
        <WaveformPlayer src={item.audio_url ?? item.audio_path} height={48} />
      </div>

      <div className="text-sm text-muted-foreground">{formatFileSize(item.file_size)}</div>
      <div className="text-sm text-muted-foreground">{formatRelativeTime(item.created_at)}</div>

      <div className="flex justify-end gap-2">
        <a
          href={item.audio_url ?? item.audio_path}
          download
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          <Download className="size-4" />
          {t('actions.download')}
        </a>
        <Link href={buildReuseHref(item)} className={buttonVariants({ size: 'sm' })}>
          <Sparkles className="size-4" />
          {t('actions.reuse')}
        </Link>
      </div>
    </div>
  );
}

function LibraryVoicesPageContent() {
  const t = useAppTranslations('library');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, isHydrated, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const [view, setView] = useState<LibraryView>(() => readLibraryView('voices', 'list'));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const limitParam = Number.parseInt(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT;
  const projectFilter = normalizeProjectFilterValue(searchParams.get('project_id'), currentProject?.id);
  const initialCursor = searchParams.get('cursor');

  const voicesQuery = useLibraryVoices({
    initialCursor,
    limit,
    projectFilter,
  });
  const items = useMemo(() => (voicesQuery.data?.pages ?? []).flatMap((page) => page.items ?? []), [voicesQuery.data]);
  const projects = projectsData?.items ?? [];
  const visibleItems = useMemo(
    () =>
      selectedTags.length === 0
        ? items
        : items.filter((item) => selectedTags.every((tag) => voiceTags(item).includes(tag))),
    [items, selectedTags]
  );
  const multiSelect = useMultiSelect(visibleItems.map((item) => ({ id: item.id, item })));
  const tags = useMemo(() => Array.from(new Set(items.flatMap(voiceTags))), [items]);
  const selectedVoiceItems = visibleItems.filter((item) => multiSelect.isSelected(item.id));
  const compareItems: CompareAsset[] = selectedVoiceItems.map((item) => ({
    id: item.id,
    kind: 'audio',
    metadata: {
      duration: formatDurationClock(item.duration),
      size: formatFileSize(item.file_size),
      voice: item.tts_voice,
    },
    title: item.tts_voice ?? item.id,
    url: item.audio_url ?? item.audio_path,
  }));

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!searchParams.get('project_id') && currentProject?.id) {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set('project_id', currentProject.id);
      router.replace(`${pathname}?${nextSearchParams.toString()}`, { scroll: false });
    }
  }, [currentProject?.id, isHydrated, pathname, router, searchParams]);

  const updateSearchParams = (updates: Record<string, string | null | undefined>) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === 'all') {
        nextSearchParams.delete(key);
      } else {
        nextSearchParams.set(key, value);
      }
    });

    if ('project_id' in updates) {
      nextSearchParams.delete('cursor');
    }

    router.replace(
      nextSearchParams.toString() ? `${pathname}?${nextSearchParams.toString()}` : pathname,
      { scroll: false }
    );
  };

  const handleProjectFilterChange = (value: string | null) => {
    if (!value) {
      return;
    }

    const selectedProject = projects.find((project) => project.id === value);
    if (selectedProject) {
      setCurrentProject({ id: selectedProject.id, name: selectedProject.name });
    }

    updateSearchParams({ project_id: value });
  };

  const isInitialLoading = voicesQuery.isLoading || !isHydrated;
  const isEmpty = !isInitialLoading && visibleItems.length === 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <LibraryFilterBar
        title={t('voices.title')}
        description={t('voices.description')}
        projectFilter={projectFilter}
        projects={projects}
        projectLabel={t('filters.project')}
        allProjectsLabel={t('filters.allProjects')}
        selectId="library-voices-project-filter"
        unassignedLabel={t('filters.unassigned')}
        onProjectFilterChange={handleProjectFilterChange}
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">View</span>
          <ViewToggle
            view={view}
            onViewChange={(nextView) => {
              setView(nextView);
              writeLibraryView('voices', nextView);
            }}
          />
        </div>
        <TagFilter tags={tags} selected={selectedTags} onChange={setSelectedTags} />
      </LibraryFilterBar>

      {isInitialLoading ? (
        <SkeletonTable cellCount={6} gridClassName={TABLE_GRID_CLASS} />
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon={AudioLines}
          title={projectFilter !== 'all' ? t('voices.emptyProjectTitle') : t('voices.emptyTitle')}
          description={t('voices.emptyDescription')}
          actionHref="/create"
          actionLabel={t('actions.goToCreate')}
        />
      ) : null}

      {!isInitialLoading && !isEmpty ? (
        <>
          <LibraryTable
            gridClassName={TABLE_GRID_CLASS}
            columns={[
              t('voices.columns.voice'),
              t('voices.columns.duration'),
              t('voices.columns.preview'),
              t('voices.columns.size'),
              t('voices.columns.created'),
              t('voices.columns.actions'),
            ]}
            body={
              <>
                {visibleItems.map((item, index) => (
                  <VoiceRow
                    key={item.id}
                    index={index}
                    item={item}
                    selected={multiSelect.isSelected(item.id)}
                    onSelect={(id, index, shiftKey) => multiSelect.toggle(id, { index, shiftKey })}
                  />
                ))}
              </>
            }
          />

          {voicesQuery.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  void voicesQuery.fetchNextPage();
                }}
                disabled={voicesQuery.isFetchingNextPage}
              >
                {voicesQuery.isFetchingNextPage ? t('actions.loadingMore') : t('actions.loadMore')}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      {selectedVoiceItems.length >= 2 && selectedVoiceItems.length <= 4 ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => setCompareOpen(true)}>
            Compare
          </Button>
        </div>
      ) : null}
      <BulkActionBar
        selectedCount={selectedVoiceItems.length}
        onClearSelection={multiSelect.clear}
        onDelete={() => {
          toast.info('Delete will be available when the library bulk API ships.');
          multiSelect.clear();
        }}
        onDownload={() => {
          selectedVoiceItems.forEach((item) => window.open(item.audio_url ?? item.audio_path, '_blank', 'noopener,noreferrer'));
        }}
      />
      <CompareView open={compareOpen} onOpenChange={setCompareOpen} items={compareItems} />
    </div>
  );
}

export default function LibraryVoicesPage() {
  const t = useAppTranslations('library');
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('fallback.loadingVoices')}</div>}>
      <LibraryVoicesPageContent />
    </Suspense>
  );
}

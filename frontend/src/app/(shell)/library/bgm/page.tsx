'use client';

import Link from 'next/link';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, Music4, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { BulkActionBar } from '@/components/library/bulk-action-bar';
import { CompareView, type CompareAsset } from '@/components/library/compare-view';
import { InlineAudioPlayer } from '@/components/library/inline-audio-player';
import { LibraryFilterBar } from '@/components/library/library-filter-bar';
import { LibraryTable } from '@/components/library/library-table';
import { StarButton, useStarredAsset } from '@/components/library/star-button';
import { TagFilter } from '@/components/library/tag-filter';
import { readLibraryView, ViewToggle, writeLibraryView, type LibraryView } from '@/components/library/view-toggle';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTable } from '@/components/shared/skeleton-table';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useLibraryBgm } from '@/lib/hooks/use-library-assets';
import { useMultiSelect } from '@/lib/hooks/use-multi-select';
import { useProjects } from '@/lib/hooks/use-projects';
import { useStyles } from '@/lib/hooks/use-resources';
import { useAppTranslations } from '@/lib/i18n';
import {
  formatDurationClock,
  formatFileSize,
  formatRelativeTime,
  normalizeProjectFilterValue,
} from '@/lib/pipeline-utils';
import {
  getBgmDescription,
  getBgmDisplayName,
  getBgmSourceLabel,
  getBgmTechnicalName,
  getStyleDisplayName,
} from '@/lib/resource-display';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type LibraryBGMItem = components['schemas']['LibraryBGMItem'];
type StyleSummary = components['schemas']['StyleSummary'];
type BgmSourceTab = 'builtin' | 'history';

const DEFAULT_LIMIT = 20;
const TABLE_GRID_CLASS = 'grid grid-cols-[1.2fr_7rem_8rem_8rem_12rem_9rem]';

function buildReuseHref(item: LibraryBGMItem): string {
  const params = new URLSearchParams();
  if (item.linked_style_id) {
    params.set('style_id', item.linked_style_id);
  }
  if (item.source === 'builtin' && item.linked_style_id) {
    params.set('bgm_mode', 'default');
  } else {
    params.set('bgm_mode', 'custom');
    params.set('bgm_path', item.audio_path);
  }
  return `/create/quick?${params.toString()}`;
}

function bgmTags(item: LibraryBGMItem): string[] {
  return [item.source, item.linked_style_name, item.project_id ? 'project' : 'unassigned']
    .filter((tag): tag is string => Boolean(tag));
}

function BgmRow({
  index,
  item,
  onSelect,
  selected,
}: {
  index: number;
  item: LibraryBGMItem;
  onSelect: (id: string, index: number, shiftKey: boolean) => void;
  selected: boolean;
}) {
  const t = useAppTranslations('library');
  const { starred, toggleStarred } = useStarredAsset('bgm', item.id);
  const sourceLabel = getBgmSourceLabel(item);
  const displayName = getBgmDisplayName(item);
  const description = getBgmDescription(item);
  const technicalName = getBgmTechnicalName(item);
  const linkedStyleName = item.linked_style_display_name_zh ?? item.linked_style_name;

  return (
    <div className={`${TABLE_GRID_CLASS} gap-4 border-b border-border/60 px-4 py-4 last:border-none`}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            aria-label={`Select ${displayName}`}
            type="checkbox"
            checked={selected}
            onClick={(event) => onSelect(item.id, index, event.shiftKey)}
            onChange={() => undefined}
          />
          <StarButton size="sm" starred={starred} onToggle={toggleStarred} />
          <p className="text-sm font-medium text-foreground">{displayName}</p>
          <Badge variant="outline">{sourceLabel}</Badge>
          {linkedStyleName ? <Badge variant="secondary">{linkedStyleName}</Badge> : null}
        </div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        {technicalName && technicalName !== displayName ? (
          <p className="text-xs text-muted-foreground">{technicalName}</p>
        ) : null}
        <InlineAudioPlayer src={item.audio_url ?? item.audio_path} duration={item.duration} />
      </div>
      <div className="text-sm text-foreground">{formatDurationClock(item.duration)}</div>
      <div className="text-sm text-muted-foreground">{formatFileSize(item.file_size)}</div>
      <div className="text-sm text-muted-foreground">{sourceLabel}</div>
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
        <Link href={buildReuseHref(item)} className={cn(buttonVariants({ size: 'sm' }))}>
          <Sparkles className="size-4" />
          {t('bgm.actions.useInQuick')}
        </Link>
        {item.linked_style_id ? (
          <Link
            href={`/library/styles?${new URLSearchParams({ style_id: item.linked_style_id }).toString()}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            {t('bgm.actions.openLinkedStyle')}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function LibraryBgmPageContent() {
  const t = useAppTranslations('library');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, isHydrated, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const { data: stylesData } = useStyles();
  const [sourceTab, setSourceTab] = useState<BgmSourceTab>('builtin');
  const [view, setView] = useState<LibraryView>(() => readLibraryView('bgm', 'list'));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const limitParam = Number.parseInt(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT;
  const projectFilter = normalizeProjectFilterValue(searchParams.get('project_id'), currentProject?.id);
  const styleFilter = searchParams.get('style_id') ?? '__all__';
  const initialCursor = searchParams.get('cursor');

  const bgmQuery = useLibraryBgm({
    initialCursor,
    limit,
    projectFilter,
    styleFilter: styleFilter === '__all__' ? null : styleFilter,
  });

  const items = useMemo(() => {
    const allItems = (bgmQuery.data?.pages ?? []).flatMap((page) => page.items ?? []);
    return allItems.filter((item) => (sourceTab === 'builtin' ? item.source === 'builtin' : item.source !== 'builtin'));
  }, [bgmQuery.data, sourceTab]);
  const tags = useMemo(() => Array.from(new Set(items.flatMap(bgmTags))), [items]);
  const visibleItems = useMemo(
    () =>
      selectedTags.length === 0
        ? items
        : items.filter((item) => selectedTags.every((tag) => bgmTags(item).includes(tag))),
    [items, selectedTags]
  );
  const multiSelect = useMultiSelect(visibleItems.map((item) => ({ id: item.id, item })));
  const selectedBgmItems = visibleItems.filter((item) => multiSelect.isSelected(item.id));
  const compareItems: CompareAsset[] = selectedBgmItems.map((item) => ({
    id: item.id,
    kind: 'audio',
    metadata: {
      duration: formatDurationClock(item.duration),
      source: item.source,
      style: item.linked_style_name,
    },
    title: getBgmDisplayName(item),
    url: item.audio_url ?? item.audio_path,
  }));
  const projects = projectsData?.items ?? [];
  const styles = stylesData?.styles ?? [];

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
      if (!value || value === 'all' || value === '__all__') {
        nextSearchParams.delete(key);
      } else {
        nextSearchParams.set(key, value);
      }
    });

    if ('project_id' in updates || 'style_id' in updates) {
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

  const isInitialLoading = bgmQuery.isLoading || !isHydrated;
  const isEmpty = !isInitialLoading && visibleItems.length === 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <LibraryFilterBar
        title={t('bgm.title')}
        description={t('bgm.description')}
        projectFilter={projectFilter}
        projects={projects}
        projectLabel={t('filters.project')}
        allProjectsLabel={t('filters.allProjects')}
        selectId="library-bgm-project-filter"
        unassignedLabel={t('filters.unassigned')}
        onProjectFilterChange={handleProjectFilterChange}
      >
        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">{t('bgm.sourceLabel')}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sourceTab === 'builtin' ? 'default' : 'outline'}
              onClick={() => setSourceTab('builtin')}
            >
              {t('bgm.sources.builtin')}
            </Button>
            <Button
              type="button"
              variant={sourceTab === 'history' ? 'default' : 'outline'}
              onClick={() => setSourceTab('history')}
            >
              {t('bgm.sources.history')}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">{t('bgm.styleFilterLabel')}</span>
          <select
            aria-label={t('bgm.styleFilterLabel')}
            value={styleFilter}
            onChange={(event) => updateSearchParams({ style_id: event.target.value })}
            className="h-10 min-w-48 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="__all__">{t('bgm.allStyles')}</option>
            {styles.map((style: StyleSummary) => (
              <option key={style.id} value={style.id}>
                {getStyleDisplayName(style)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">View</span>
          <ViewToggle
            view={view}
            onViewChange={(nextView) => {
              setView(nextView);
              writeLibraryView('bgm', nextView);
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
          icon={Music4}
          title={sourceTab === 'builtin' ? t('bgm.emptyBuiltinTitle') : t('bgm.emptyHistoryTitle')}
          description={t('bgm.emptyDescription')}
          actionHref="/create"
          actionLabel={t('actions.goToCreate')}
        />
      ) : null}

      {!isInitialLoading && !isEmpty ? (
        <>
          <LibraryTable
            gridClassName={TABLE_GRID_CLASS}
            columns={[
              t('bgm.columns.track'),
              t('bgm.columns.duration'),
              t('bgm.columns.size'),
              t('bgm.columns.source'),
              t('bgm.columns.created'),
              t('bgm.columns.actions'),
            ]}
            body={
              <>
                {visibleItems.map((item, index) => (
                  <BgmRow
                    key={item.id}
                    item={item}
                    index={index}
                    selected={multiSelect.isSelected(item.id)}
                    onSelect={(id, itemIndex, shiftKey) => multiSelect.toggle(id, { index: itemIndex, shiftKey })}
                  />
                ))}
              </>
            }
          />

          {bgmQuery.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  void bgmQuery.fetchNextPage();
                }}
                disabled={bgmQuery.isFetchingNextPage}
              >
                {bgmQuery.isFetchingNextPage ? t('actions.loadingMore') : t('actions.loadMore')}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      {selectedBgmItems.length >= 2 && selectedBgmItems.length <= 4 ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => setCompareOpen(true)}>
            Compare
          </Button>
        </div>
      ) : null}
      <BulkActionBar
        selectedCount={selectedBgmItems.length}
        onClearSelection={multiSelect.clear}
        onDelete={() => {
          toast.info('Delete will be available when the library bulk API ships.');
          multiSelect.clear();
        }}
        onDownload={() => {
          selectedBgmItems.forEach((item) => window.open(item.audio_url ?? item.audio_path, '_blank', 'noopener,noreferrer'));
        }}
      />
      <CompareView open={compareOpen} onOpenChange={setCompareOpen} items={compareItems} />
    </div>
  );
}

export default function LibraryBgmPage() {
  const t = useAppTranslations('library');
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('fallback.loadingBgm')}</div>}>
      <LibraryBgmPageContent />
    </Suspense>
  );
}

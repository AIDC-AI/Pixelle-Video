'use client';

import Link from 'next/link';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Copy, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { BulkActionBar } from '@/components/library/bulk-action-bar';
import { CompareView, type CompareAsset } from '@/components/library/compare-view';
import { LibraryFilterBar } from '@/components/library/library-filter-bar';
import { LibraryTable } from '@/components/library/library-table';
import { MarkdownPreview } from '@/components/library/markdown-preview';
import { StarButton, useStarredAsset } from '@/components/library/star-button';
import { TagFilter } from '@/components/library/tag-filter';
import { readLibraryView, ViewToggle, writeLibraryView, type LibraryView } from '@/components/library/view-toggle';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTable } from '@/components/shared/skeleton-table';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useLibraryScripts } from '@/lib/hooks/use-library-assets';
import { useProjects } from '@/lib/hooks/use-projects';
import { useTasksForLibrary } from '@/lib/hooks/use-library-videos';
import { useMultiSelect } from '@/lib/hooks/use-multi-select';
import { useAppTranslations } from '@/lib/i18n';
import {
  formatRelativeTime,
  inferPipeline,
  normalizeProjectFilterValue,
} from '@/lib/pipeline-utils';
import {
  getScriptPipelineLabel,
  getScriptPromptLabel,
  getScriptSummaryLabel,
  getScriptTypeLabel,
} from '@/lib/resource-display';
import type { components } from '@/types/api';

type ScriptItem = components['schemas']['ScriptItem'];

const DEFAULT_LIMIT = 20;
const TABLE_GRID_CLASS = 'grid grid-cols-[1.4fr_8rem_10rem_10rem_12rem]';

function buildReuseHref(item: ScriptItem): string {
  const params = new URLSearchParams({ narration: item.text });
  return `/create/quick?${params.toString()}`;
}

function ScriptRow({
  index,
  item,
  onSelect,
  pipelineLabel,
  selected,
}: {
  index: number;
  item: ScriptItem;
  onSelect: (id: string, index: number, shiftKey: boolean) => void;
  pipelineLabel: string;
  selected: boolean;
}) {
  const t = useAppTranslations('library');
  const [isExpanded, setIsExpanded] = useState(false);
  const { starred, toggleStarred } = useStarredAsset('scripts', item.id);

  return (
    <div className="border-b border-border/60 last:border-none">
      <div className={`${TABLE_GRID_CLASS} items-start gap-4 px-4 py-4`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              aria-label={`Select ${getScriptSummaryLabel(item)}`}
              type="checkbox"
              checked={selected}
              onClick={(event) => onSelect(item.id, index, event.shiftKey)}
              onChange={() => undefined}
            />
            <StarButton size="sm" starred={starred} onToggle={toggleStarred} />
            <p className="line-clamp-1 text-sm font-medium text-foreground">{getScriptSummaryLabel(item)}</p>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{item.text}</p>
          {item.prompt_used ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">{getScriptPromptLabel(item.prompt_used)}</p>
          ) : null}
        </div>
        <div>
          <Badge variant="outline">{getScriptTypeLabel(item)}</Badge>
        </div>
        <div className="text-sm text-muted-foreground">{formatRelativeTime(item.created_at)}</div>
        <div className="text-sm text-muted-foreground">{pipelineLabel}</div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!navigator.clipboard?.writeText) {
                return;
              }

              await navigator.clipboard.writeText(item.text);
              toast.success(t('scripts.scriptCopied'));
            }}
          >
            <Copy className="size-4" />
            {t('actions.copy')}
          </Button>
          <Link href={buildReuseHref(item)} className={buttonVariants({ size: 'sm' })}>
            <Sparkles className="size-4" />
            {t('actions.reuse')}
          </Link>
        </div>
      </div>

      <div className="px-4 pb-4">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsExpanded((value) => !value)}>
          {isExpanded ? t('scripts.hideFullScript') : t('scripts.viewFullScript')}
        </Button>
      </div>

      {isExpanded ? (
        <div className="px-4 pb-4">
          <MarkdownPreview markdown={item.text} readOnly />
        </div>
      ) : null}
    </div>
  );
}

function scriptTags(item: ScriptItem): string[] {
  return [item.script_type, item.pipeline, item.project_id ? 'project' : 'unassigned']
    .filter((tag): tag is string => Boolean(tag));
}

function LibraryScriptsPageContent() {
  const t = useAppTranslations('library');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, isHydrated, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const [view, setView] = useState<LibraryView>(() => readLibraryView('scripts', 'list'));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const limitParam = Number.parseInt(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT;
  const projectFilter = normalizeProjectFilterValue(searchParams.get('project_id'), currentProject?.id);
  const initialCursor = searchParams.get('cursor');

  const scriptsQuery = useLibraryScripts({
    initialCursor,
    limit,
    projectFilter,
  });
  const tasksQuery = useTasksForLibrary(projectFilter);
  const items = useMemo(() => (scriptsQuery.data?.pages ?? []).flatMap((page) => page.items ?? []), [scriptsQuery.data]);
  const projects = projectsData?.items ?? [];
  const tags = useMemo(() => Array.from(new Set(items.flatMap(scriptTags))), [items]);
  const visibleItems = useMemo(
    () =>
      selectedTags.length === 0
        ? items
        : items.filter((item) => selectedTags.every((tag) => scriptTags(item).includes(tag))),
    [items, selectedTags]
  );
  const multiSelect = useMultiSelect(visibleItems.map((item) => ({ id: item.id, item })));
  const selectedScriptItems = visibleItems.filter((item) => multiSelect.isSelected(item.id));
  const compareItems: CompareAsset[] = selectedScriptItems.map((item) => ({
    id: item.id,
    kind: 'image',
    metadata: {
      pipeline: item.pipeline,
      type: item.script_type,
      words: item.text.length,
    },
    title: getScriptSummaryLabel(item),
    url: null,
  }));
  const taskMap = useMemo(
    () => new Map((tasksQuery.data ?? []).map((task) => [task.task_id, task])),
    [tasksQuery.data]
  );

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

  const isInitialLoading = scriptsQuery.isLoading || tasksQuery.isLoading || !isHydrated;
  const isEmpty = !isInitialLoading && visibleItems.length === 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <LibraryFilterBar
        title={t('scripts.title')}
        description={t('scripts.description')}
        projectFilter={projectFilter}
        projects={projects}
        projectLabel={t('filters.project')}
        allProjectsLabel={t('filters.allProjects')}
        selectId="library-scripts-project-filter"
        unassignedLabel={t('filters.unassigned')}
        onProjectFilterChange={handleProjectFilterChange}
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">View</span>
          <ViewToggle
            view={view}
            onViewChange={(nextView) => {
              setView(nextView);
              writeLibraryView('scripts', nextView);
            }}
          />
        </div>
        <TagFilter tags={tags} selected={selectedTags} onChange={setSelectedTags} />
      </LibraryFilterBar>

      {isInitialLoading ? <SkeletonTable cellCount={5} gridClassName={TABLE_GRID_CLASS} /> : null}

      {isEmpty ? (
        <EmptyState
          icon={FileText}
          title={projectFilter !== 'all' ? t('scripts.emptyProjectTitle') : t('scripts.emptyTitle')}
          description={t('scripts.emptyDescription')}
          actionHref="/create"
          actionLabel={t('actions.goToCreate')}
        />
      ) : null}

      {!isInitialLoading && !isEmpty ? (
        <>
          <LibraryTable
            gridClassName={TABLE_GRID_CLASS}
            columns={[
              t('scripts.columns.summary'),
              t('scripts.columns.type'),
              t('scripts.columns.created'),
              t('scripts.columns.pipeline'),
              t('scripts.columns.actions'),
            ]}
            body={
              <>
                {visibleItems.map((item, index) => (
                  <ScriptRow
                    key={item.id}
                    index={index}
                    item={item}
                    selected={multiSelect.isSelected(item.id)}
                    onSelect={(id, itemIndex, shiftKey) => multiSelect.toggle(id, { index: itemIndex, shiftKey })}
                    pipelineLabel={getScriptPipelineLabel(
                      item,
                      item.task_id && taskMap.has(item.task_id)
                        ? inferPipeline(taskMap.get(item.task_id)).label
                        : t('shared.unknown')
                    )}
                  />
                ))}
              </>
            }
          />

          {scriptsQuery.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  void scriptsQuery.fetchNextPage();
                }}
                disabled={scriptsQuery.isFetchingNextPage}
              >
                {scriptsQuery.isFetchingNextPage ? t('actions.loadingMore') : t('actions.loadMore')}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      {selectedScriptItems.length >= 2 && selectedScriptItems.length <= 4 ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => setCompareOpen(true)}>
            Compare
          </Button>
        </div>
      ) : null}
      <BulkActionBar
        selectedCount={selectedScriptItems.length}
        onClearSelection={multiSelect.clear}
        onDelete={() => {
          toast.info('Delete will be available when the library bulk API ships.');
          multiSelect.clear();
        }}
        onDownload={() => {
          selectedScriptItems.forEach((item) => {
            const blob = new Blob([item.text], { type: 'text/markdown' });
            window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
          });
        }}
      />
      <CompareView open={compareOpen} onOpenChange={setCompareOpen} items={compareItems} />
    </div>
  );
}

export default function LibraryScriptsPage() {
  const t = useAppTranslations('library');
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('fallback.loadingScripts')}</div>}>
      <LibraryScriptsPageContent />
    </Suspense>
  );
}

'use client';

import Link from 'next/link';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Film, FolderSearch } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BulkActionBar } from '@/components/library/bulk-action-bar';
import { CompareView, type CompareAsset } from '@/components/library/compare-view';
import { StarButton, useStarredAsset } from '@/components/library/star-button';
import { TagFilter } from '@/components/library/tag-filter';
import { VideoHoverPreview } from '@/components/library/video-hover-preview';
import { readLibraryView, ViewToggle, writeLibraryView, type LibraryView } from '@/components/library/view-toggle';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useLibraryVideos, useTasksForLibrary } from '@/lib/hooks/use-library-videos';
import { useMultiSelect } from '@/lib/hooks/use-multi-select';
import { useProjects } from '@/lib/hooks/use-projects';
import {
  formatDurationClock,
  formatRelativeTime,
  inferPipeline,
  normalizeProjectFilterValue,
  projectFilterLabel,
  statusBadgeClassName,
  statusLabel,
} from '@/lib/pipeline-utils';
import type { components } from '@/types/api';

type VideoItem = components['schemas']['VideoItem'];
type Task = components['schemas']['Task'];

const DEFAULT_LIMIT = 12;
const VIDEO_LIBRARY_COPY = {
  title: 'Videos',
  description: 'Browse generated videos across projects, then reopen them for reuse or troubleshooting.',
  projectFilter: 'Project filter',
  allProjects: 'All Projects',
  unassigned: 'Unassigned',
  goToCreate: 'Go to Create',
  loadMore: 'Load More',
  loadingMore: 'Loading…',
  loadingLibrary: 'Loading library…',
};

function videoItemId(item: VideoItem): string {
  return item.task_id;
}

function videoTags(item: VideoItem, task?: Task): string[] {
  return [
    item.pipeline,
    task ? inferPipeline(task).slug : null,
    task?.status,
    item.project_id ? 'project' : 'unassigned',
  ].filter((tag): tag is string => Boolean(tag));
}

function VideoCard({
  item,
  onSelect,
  selected,
  task,
}: {
  item: VideoItem;
  onSelect: (event: React.MouseEvent<HTMLInputElement>) => void;
  selected: boolean;
  task?: Task;
}) {
  const status = task?.status ?? (item.video_url ? 'completed' : 'unknown');
  const pipeline = task ? inferPipeline(task) : { label: 'Pipeline pending', slug: 'quick' as const };
  const { starred, toggleStarred } = useStarredAsset('videos', item.task_id);

  return (
    <Link href={`/library/videos/${item.task_id}`} className="group block">
      <Card className="overflow-hidden border-border/70 bg-card shadow-none transition-all duration-150 ease-out hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg">
        <div className="relative aspect-[9/16] overflow-hidden bg-black">
          <input
            aria-label={`Select ${item.title}`}
            type="checkbox"
            checked={selected}
            className="absolute right-3 top-3 z-20 size-4"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(event);
            }}
            onChange={() => undefined}
          />
          <div className="absolute right-8 top-1 z-20">
            <StarButton size="sm" starred={starred} onToggle={toggleStarred} />
          </div>
          <VideoHoverPreview src={item.video_url} duration={item.duration} />
          {item.video_url ? (
            <video
              className="h-full w-full object-cover transition-transform duration-150 ease-out group-hover:scale-[1.02]"
              src={item.video_url}
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted/20">
              <Film className="size-16 text-muted-foreground/60" />
            </div>
          )}

          <Badge className={`absolute left-3 top-3 ${statusBadgeClassName(status)}`}>
            {statusLabel(status)}
          </Badge>
          <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
            {formatDurationClock(item.duration)}
          </div>
        </div>

        <CardContent className="space-y-2 p-4">
          <h2 className="truncate text-base font-semibold text-foreground">{item.title}</h2>
          <p className="text-xs text-muted-foreground">
            {formatRelativeTime(item.completed_at ?? item.created_at)} · {pipeline.label}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function LibraryVideosPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, isHydrated, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [projectFilterOverride, setProjectFilterOverride] = useState<string | null>(null);
  const [view, setView] = useState<LibraryView>(() => readLibraryView('videos', 'grid'));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const limitParam = Number.parseInt(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT;
  const projectFilter = normalizeProjectFilterValue(
    searchParams.get('project_id') ?? projectFilterOverride,
    currentProject?.id
  );
  const initialCursor = searchParams.get('cursor');

  const videosQuery = useLibraryVideos({
    initialCursor,
    limit,
    projectFilter,
  });
  const tasksQuery = useTasksForLibrary(projectFilter);

  const taskMap = useMemo(() => {
    return new Map((tasksQuery.data ?? []).map((task) => [task.task_id, task]));
  }, [tasksQuery.data]);

  const items = useMemo<VideoItem[]>(() => {
    return (videosQuery.data?.pages ?? []).flatMap((page) => page.items ?? []);
  }, [videosQuery.data]);
  const selectableItems = useMemo(() => items.map((item) => ({ id: videoItemId(item), item })), [items]);
  const multiSelect = useMultiSelect(selectableItems);
  const tags = useMemo(
    () => Array.from(new Set(items.flatMap((item) => videoTags(item, taskMap.get(item.task_id))))),
    [items, taskMap]
  );
  const visibleItems = useMemo(
    () =>
      selectedTags.length === 0
        ? items
        : items.filter((item) => selectedTags.every((tag) => videoTags(item, taskMap.get(item.task_id)).includes(tag))),
    [items, selectedTags, taskMap]
  );
  const selectedVideoItems = visibleItems.filter((item) => multiSelect.isSelected(videoItemId(item)));
  const compareItems: CompareAsset[] = selectedVideoItems.map((item) => {
    const task = taskMap.get(item.task_id);

    return {
      id: item.task_id,
      kind: 'video',
      metadata: {
        duration: formatDurationClock(item.duration),
        pipeline: task ? inferPipeline(task).label : item.pipeline,
        size: item.file_size,
      },
      title: item.title,
      url: item.video_url,
    };
  });

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!searchParams.get('project_id') && !projectFilterOverride && currentProject?.id) {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set('project_id', currentProject.id);
      router.replace(`${pathname}?${nextSearchParams.toString()}`, { scroll: false });
    }
  }, [currentProject?.id, isHydrated, pathname, projectFilterOverride, router, searchParams]);

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

    setProjectFilterOverride(value);
    setIsProjectMenuOpen(false);

    const selectedProject = (projectsData?.items ?? []).find((project) => project.id === value);
    if (selectedProject) {
      setCurrentProject({ id: selectedProject.id, name: selectedProject.name });
    }

    updateSearchParams({ project_id: value });
  };

  const isInitialLoading = videosQuery.isLoading || tasksQuery.isLoading || !isHydrated;
  const isEmpty = !isInitialLoading && visibleItems.length === 0;
  const emptyTitle =
    projectFilter !== 'all' ? 'This project has no generated videos yet.' : 'No videos generated yet.';
  const emptyDescription =
    projectFilter !== 'all'
      ? `No completed or indexed videos are linked to ${projectFilterLabel(projectFilter, projectsData?.items ?? [])}.`
      : 'Create a new video to start building your reusable video library.';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">{VIDEO_LIBRARY_COPY.title}</h1>
            <p className="text-sm text-muted-foreground">{VIDEO_LIBRARY_COPY.description}</p>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 md:grid-cols-[minmax(0,20rem)_1fr]">
          <div className="relative space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="library-project-filter">
              {VIDEO_LIBRARY_COPY.projectFilter}
            </label>
            <button
              id="library-project-filter"
              type="button"
              role="combobox"
              aria-label={VIDEO_LIBRARY_COPY.projectFilter}
              aria-expanded={isProjectMenuOpen}
              aria-controls="library-project-filter-listbox"
              aria-haspopup="listbox"
              className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={() => setIsProjectMenuOpen((open) => !open)}
            >
              <span>{projectFilterLabel(projectFilter, projectsData?.items ?? [])}</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>

            {isProjectMenuOpen ? (
              <div
                id="library-project-filter-listbox"
                role="listbox"
                aria-label={VIDEO_LIBRARY_COPY.projectFilter}
                className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover p-1 shadow-lg"
              >
                {[
                  { label: VIDEO_LIBRARY_COPY.allProjects, value: 'all' },
                  { label: VIDEO_LIBRARY_COPY.unassigned, value: '__unassigned__' },
                  ...((projectsData?.items ?? []).map((project) => ({
                    label: project.name,
                    value: project.id,
                  }))),
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={projectFilter === option.value}
                    className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => handleProjectFilterChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <ViewToggle
              view={view}
              onViewChange={(nextView) => {
                setView(nextView);
                writeLibraryView('videos', nextView);
              }}
            />
            <TagFilter tags={tags} selected={selectedTags} onChange={setSelectedTags} />
          </div>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonCard key={`library-skeleton-${index}`} />
          ))}
        </div>
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon={projectFilter !== 'all' ? FolderSearch : Film}
          title={emptyTitle}
          description={emptyDescription}
          actionHref="/create"
          actionLabel={VIDEO_LIBRARY_COPY.goToCreate}
        />
      ) : null}

      {!isInitialLoading && !isEmpty ? (
        <>
          <div className="flex justify-end">
            {selectedVideoItems.length >= 2 && selectedVideoItems.length <= 4 ? (
              <Button type="button" variant="outline" onClick={() => setCompareOpen(true)}>
                Compare
              </Button>
            ) : null}
          </div>
          {view === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {visibleItems.map((item, index) => (
                <VideoCard
                  key={item.task_id}
                  item={item}
                  task={taskMap.get(item.task_id)}
                  selected={multiSelect.isSelected(videoItemId(item))}
                  onSelect={(event) => multiSelect.toggle(videoItemId(item), { index, shiftKey: event.shiftKey })}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleItems.map((item, index) => (
                <div key={item.task_id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4">
                  <input
                    aria-label={`Select ${item.title}`}
                    type="checkbox"
                    checked={multiSelect.isSelected(videoItemId(item))}
                    onClick={(event) => multiSelect.toggle(videoItemId(item), { index, shiftKey: event.shiftKey })}
                    onChange={() => undefined}
                  />
                  <Link href={`/library/videos/${item.task_id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDurationClock(item.duration)}</p>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {videosQuery.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  void videosQuery.fetchNextPage();
                }}
                disabled={videosQuery.isFetchingNextPage}
              >
                {videosQuery.isFetchingNextPage ? VIDEO_LIBRARY_COPY.loadingMore : VIDEO_LIBRARY_COPY.loadMore}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      <BulkActionBar
        selectedCount={selectedVideoItems.length}
        onClearSelection={multiSelect.clear}
        onDelete={() => {
          toast.info('Delete will be available when the library bulk API ships.');
          multiSelect.clear();
        }}
        onDownload={() => {
          selectedVideoItems.forEach((item) => {
            if (item.video_url) {
              window.open(item.video_url, '_blank', 'noopener,noreferrer');
            }
          });
        }}
      />
      <CompareView open={compareOpen} onOpenChange={setCompareOpen} items={compareItems} />
    </div>
  );
}

export default function LibraryVideosPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{VIDEO_LIBRARY_COPY.loadingLibrary}</div>}>
      <LibraryVideosPageContent />
    </Suspense>
  );
}

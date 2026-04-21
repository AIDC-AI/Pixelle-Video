'use client';

import Link from 'next/link';
import React, { Suspense, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Film, FolderSearch } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useLibraryVideos, useTasksForLibrary } from '@/lib/hooks/use-library-videos';
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

function LibraryVideoSkeleton() {
  return (
    <Card className="overflow-hidden border-border/70 bg-card shadow-none">
      <div className="aspect-[9/16] animate-pulse bg-muted/70" />
      <CardContent className="space-y-3 p-4">
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted/70" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted/50" />
      </CardContent>
    </Card>
  );
}

function VideoCard({ item, task }: { item: VideoItem; task?: Task }) {
  const status = task?.status ?? (item.video_url ? 'completed' : 'unknown');
  const pipeline = task ? inferPipeline(task) : { label: 'Pipeline pending', slug: 'quick' as const };

  return (
    <Link href={`/library/videos/${item.task_id}`} className="group block">
      <Card className="overflow-hidden border-border/70 bg-card shadow-none transition-all duration-150 ease-out hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg">
        <div className="relative aspect-[9/16] overflow-hidden bg-black">
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

  const limitParam = Number.parseInt(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT;
  const projectFilter = normalizeProjectFilterValue(searchParams.get('project_id'), currentProject?.id);
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

    const selectedProject = (projectsData?.items ?? []).find((project) => project.id === value);
    if (selectedProject) {
      setCurrentProject({ id: selectedProject.id, name: selectedProject.name });
    }

    updateSearchParams({ project_id: value });
  };

  const isInitialLoading = videosQuery.isLoading || tasksQuery.isLoading || !isHydrated;
  const isEmpty = !isInitialLoading && items.length === 0;
  const emptyTitle =
    projectFilter !== 'all' ? 'This project has no generated videos yet.' : 'No videos generated yet.';
  const emptyDescription =
    projectFilter !== 'all'
      ? `No completed or indexed videos are linked to ${projectFilterLabel(projectFilter, projectsData?.items ?? [])}.`
      : 'Create a new video to start building your reusable video library.';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Videos</h1>
          <p className="text-sm text-muted-foreground">
            Browse generated videos across projects, then reopen them for reuse or troubleshooting.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 md:max-w-sm">
          <label className="text-sm font-medium text-foreground" htmlFor="library-project-filter">
            Project
          </label>
          <Select value={projectFilter} onValueChange={handleProjectFilterChange}>
            <SelectTrigger id="library-project-filter" aria-label="Project filter">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {(projectsData?.items ?? []).map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <LibraryVideoSkeleton key={`library-skeleton-${index}`} />
          ))}
        </div>
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon={projectFilter !== 'all' ? FolderSearch : Film}
          title={emptyTitle}
          description={emptyDescription}
          actionHref="/create"
          actionLabel="Go to Create"
        />
      ) : null}

      {!isInitialLoading && !isEmpty ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <VideoCard key={item.task_id} item={item} task={taskMap.get(item.task_id)} />
            ))}
          </div>

          {videosQuery.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  void videosQuery.fetchNextPage();
                }}
                disabled={videosQuery.isFetchingNextPage}
              >
                {videosQuery.isFetchingNextPage ? 'Loading…' : 'Load More'}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function LibraryVideosPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading library…</div>}>
      <LibraryVideosPageContent />
    </Suspense>
  );
}

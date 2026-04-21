'use client';

import Link from 'next/link';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, Music4, Sparkles } from 'lucide-react';

import { LibraryEmptyState } from '@/components/library/library-empty-state';
import { LibraryFilterBar } from '@/components/library/library-filter-bar';
import { LibraryTable } from '@/components/library/library-table';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useLibraryBgm } from '@/lib/hooks/use-library-assets';
import { useProjects } from '@/lib/hooks/use-projects';
import {
  formatDurationClock,
  formatFileSize,
  formatRelativeTime,
  normalizeProjectFilterValue,
} from '@/lib/pipeline-utils';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type LibraryBGMItem = components['schemas']['LibraryBGMItem'];
type BgmSourceTab = 'builtin' | 'history';

const DEFAULT_LIMIT = 20;
const TABLE_GRID_CLASS = 'grid grid-cols-[1.2fr_7rem_8rem_8rem_12rem_9rem]';

function buildReuseHref(item: LibraryBGMItem): string {
  const params = new URLSearchParams({ bgm_path: item.audio_path });
  return `/create/quick?${params.toString()}`;
}

function BgmRow({ item }: { item: LibraryBGMItem }) {
  const sourceLabel = item.source === 'builtin' ? 'Built-in' : 'My Library';

  return (
    <div className={`${TABLE_GRID_CLASS} gap-4 border-b border-border/60 px-4 py-4 last:border-none`}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{item.name}</p>
          <Badge variant="outline">{sourceLabel}</Badge>
        </div>
        <audio className="w-full max-w-sm" controls preload="none" src={item.audio_url ?? item.audio_path}>
          <track kind="captions" />
        </audio>
      </div>
      <div className="text-sm text-foreground">{formatDurationClock(item.duration)}</div>
      <div className="text-sm text-muted-foreground">{formatFileSize(item.file_size)}</div>
      <div className="text-sm text-muted-foreground">{item.source}</div>
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
          Download
        </a>
        <Link href={buildReuseHref(item)} className={cn(buttonVariants({ size: 'sm' }))}>
          <Sparkles className="size-4" />
          Use in Quick
        </Link>
      </div>
    </div>
  );
}

function LibraryBgmPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, isHydrated, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const [sourceTab, setSourceTab] = useState<BgmSourceTab>('builtin');

  const limitParam = Number.parseInt(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT;
  const projectFilter = normalizeProjectFilterValue(searchParams.get('project_id'), currentProject?.id);
  const initialCursor = searchParams.get('cursor');

  const bgmQuery = useLibraryBgm({
    initialCursor,
    limit,
    projectFilter,
  });

  const items = useMemo(() => {
    const allItems = (bgmQuery.data?.pages ?? []).flatMap((page) => page.items ?? []);
    return allItems.filter((item) => (sourceTab === 'builtin' ? item.source === 'builtin' : item.source !== 'builtin'));
  }, [bgmQuery.data, sourceTab]);
  const projects = projectsData?.items ?? [];

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

  const isInitialLoading = bgmQuery.isLoading || !isHydrated;
  const isEmpty = !isInitialLoading && items.length === 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <LibraryFilterBar
        title="BGM"
        description="Switch between built-in tracks and your generated library, then drop a track back into the Quick pipeline."
        projectFilter={projectFilter}
        projects={projects}
        selectId="library-bgm-project-filter"
        onProjectFilterChange={handleProjectFilterChange}
      >
        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">Source</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sourceTab === 'builtin' ? 'default' : 'outline'}
              onClick={() => setSourceTab('builtin')}
            >
              Built-in
            </Button>
            <Button
              type="button"
              variant={sourceTab === 'history' ? 'default' : 'outline'}
              onClick={() => setSourceTab('history')}
            >
              My Library
            </Button>
          </div>
        </div>
      </LibraryFilterBar>

      {isInitialLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`bgm-skeleton-${index}`} className="h-20 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          ))}
        </div>
      ) : null}

      {isEmpty ? (
        <LibraryEmptyState
          icon={Music4}
          title={sourceTab === 'builtin' ? 'No built-in tracks available.' : 'No personal BGM history yet.'}
          description="Built-in tracks come from the shared resources catalog; your own reused tracks appear after generation history is indexed."
        />
      ) : null}

      {!isInitialLoading && !isEmpty ? (
        <>
          <LibraryTable
            gridClassName={TABLE_GRID_CLASS}
            columns={['Track', 'Duration', 'Size', 'Source', 'Created', 'Actions']}
            body={
              <>
                {items.map((item) => (
                  <BgmRow key={item.id} item={item} />
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
                {bgmQuery.isFetchingNextPage ? 'Loading…' : 'Load More'}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function LibraryBgmPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading BGM…</div>}>
      <LibraryBgmPageContent />
    </Suspense>
  );
}

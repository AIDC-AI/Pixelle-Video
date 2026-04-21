'use client';

import Link from 'next/link';
import React, { Suspense, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AudioLines, Download, Sparkles } from 'lucide-react';

import { LibraryFilterBar } from '@/components/library/library-filter-bar';
import { LibraryTable } from '@/components/library/library-table';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTable } from '@/components/shared/skeleton-table';
import { Button, buttonVariants } from '@/components/ui/button';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useLibraryVoices } from '@/lib/hooks/use-library-assets';
import { useProjects } from '@/lib/hooks/use-projects';
import {
  formatDurationClock,
  formatFileSize,
  formatRelativeTime,
  normalizeProjectFilterValue,
} from '@/lib/pipeline-utils';
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

function VoiceRow({ item }: { item: VoiceItem }) {
  return (
    <div className={`${TABLE_GRID_CLASS} gap-4 border-b border-border/60 px-4 py-4 last:border-none`}>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{item.tts_voice ?? 'Unknown voice'}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{item.text ?? 'No transcript snapshot'}</p>
      </div>

      <div className="text-sm text-foreground">{formatDurationClock(item.duration)}</div>

      <div className="min-w-0">
        <audio className="w-full" controls preload="none" src={item.audio_url ?? item.audio_path}>
          <track kind="captions" />
        </audio>
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
          Download
        </a>
        <Link href={buildReuseHref(item)} className={buttonVariants({ size: 'sm' })}>
          <Sparkles className="size-4" />
          Reuse
        </Link>
      </div>
    </div>
  );
}

function LibraryVoicesPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, isHydrated, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();

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
  const isEmpty = !isInitialLoading && items.length === 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <LibraryFilterBar
        title="Voices"
        description="Review generated voice tracks, listen inline, and reopen the Digital Human flow with the same narration settings."
        projectFilter={projectFilter}
        projects={projects}
        selectId="library-voices-project-filter"
        onProjectFilterChange={handleProjectFilterChange}
      />

      {isInitialLoading ? (
        <SkeletonTable cellCount={6} gridClassName={TABLE_GRID_CLASS} />
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon={AudioLines}
          title={projectFilter !== 'all' ? 'This project has no voice assets yet.' : 'No voice assets indexed yet.'}
          description="Generated TTS outputs will appear here once they have been synthesized by a pipeline."
          actionHref="/create"
          actionLabel="Go to Create"
        />
      ) : null}

      {!isInitialLoading && !isEmpty ? (
        <>
          <LibraryTable
            gridClassName={TABLE_GRID_CLASS}
            columns={['Voice', 'Duration', 'Preview', 'Size', 'Created', 'Actions']}
            body={
              <>
                {items.map((item) => (
                  <VoiceRow key={item.id} item={item} />
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
                {voicesQuery.isFetchingNextPage ? 'Loading…' : 'Load More'}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function LibraryVoicesPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading voices…</div>}>
      <LibraryVoicesPageContent />
    </Suspense>
  );
}

'use client';

import Link from 'next/link';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Copy, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { LibraryEmptyState } from '@/components/library/library-empty-state';
import { LibraryFilterBar } from '@/components/library/library-filter-bar';
import { LibraryTable } from '@/components/library/library-table';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useLibraryScripts } from '@/lib/hooks/use-library-assets';
import { useProjects } from '@/lib/hooks/use-projects';
import { useTasksForLibrary } from '@/lib/hooks/use-library-videos';
import {
  formatRelativeTime,
  inferPipeline,
  normalizeProjectFilterValue,
} from '@/lib/pipeline-utils';
import type { components } from '@/types/api';

type ScriptItem = components['schemas']['ScriptItem'];

const DEFAULT_LIMIT = 20;
const TABLE_GRID_CLASS = 'grid grid-cols-[1.4fr_8rem_10rem_10rem_12rem]';

function buildReuseHref(item: ScriptItem): string {
  const params = new URLSearchParams({ narration: item.text });
  return `/create/quick?${params.toString()}`;
}

function ScriptRow({
  item,
  pipelineLabel,
}: {
  item: ScriptItem;
  pipelineLabel: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-border/60 last:border-none">
      <div className={`${TABLE_GRID_CLASS} items-start gap-4 px-4 py-4`}>
        <div className="space-y-1">
          <p className="line-clamp-2 text-sm font-medium text-foreground">{item.text}</p>
          {item.prompt_used ? <p className="line-clamp-1 text-xs text-muted-foreground">{item.prompt_used}</p> : null}
        </div>
        <div>
          <Badge variant="outline">{item.script_type}</Badge>
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
              toast.success('Script copied.');
            }}
          >
            <Copy className="size-4" />
            Copy
          </Button>
          <Link href={buildReuseHref(item)} className={buttonVariants({ size: 'sm' })}>
            <Sparkles className="size-4" />
            Reuse
          </Link>
        </div>
      </div>

      <div className="px-4 pb-4">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsExpanded((value) => !value)}>
          {isExpanded ? 'Hide full script' : 'View full script'}
        </Button>
      </div>

      {isExpanded ? (
        <div className="px-4 pb-4">
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4 text-sm leading-6 text-foreground">
            {item.text}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LibraryScriptsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, isHydrated, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();

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
  const isEmpty = !isInitialLoading && items.length === 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <LibraryFilterBar
        title="Scripts"
        description="Keep every narration and prompt draft in one place, then reopen Quick with the exact script content prefilled."
        projectFilter={projectFilter}
        projects={projects}
        selectId="library-scripts-project-filter"
        onProjectFilterChange={handleProjectFilterChange}
      />

      {isInitialLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`script-skeleton-${index}`} className="h-24 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          ))}
        </div>
      ) : null}

      {isEmpty ? (
        <LibraryEmptyState
          icon={FileText}
          title={projectFilter !== 'all' ? 'This project has no script history yet.' : 'No script history indexed yet.'}
          description="Narration and prompt history will appear here after generation or assistive writing flows complete."
        />
      ) : null}

      {!isInitialLoading && !isEmpty ? (
        <>
          <LibraryTable
            gridClassName={TABLE_GRID_CLASS}
            columns={['Summary', 'Type', 'Created', 'Pipeline', 'Actions']}
            body={
              <>
                {items.map((item) => (
                  <ScriptRow
                    key={item.id}
                    item={item}
                    pipelineLabel={
                      item.task_id && taskMap.has(item.task_id)
                        ? inferPipeline(taskMap.get(item.task_id)).label
                        : 'Unknown'
                    }
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
                {scriptsQuery.isFetchingNextPage ? 'Loading…' : 'Load More'}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function LibraryScriptsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading scripts…</div>}>
      <LibraryScriptsPageContent />
    </Suspense>
  );
}

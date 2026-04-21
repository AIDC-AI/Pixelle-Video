'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarRange, Layers3 } from 'lucide-react';
import { toast } from 'sonner';

import { BatchProgressBar } from '@/components/batch/batch-progress-bar';
import { BatchStatusBadge } from '@/components/batch/batch-status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTable } from '@/components/shared/skeleton-table';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeleteBatch, useInfiniteBatchList } from '@/lib/hooks/use-batches';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useProjects } from '@/lib/hooks/use-projects';
import { batchPipelineLabel, batchStatusLabel, isTerminalBatchStatus } from '@/lib/batch-utils';
import { formatRelativeTime, normalizeProjectFilterValue, projectFilterLabel } from '@/lib/pipeline-utils';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = ['all', 'pending', 'running', 'completed', 'failed', 'cancelled', 'partial'] as const;
const BATCH_LIST_GRID_CLASS =
  'grid grid-cols-[1.6fr_1fr_0.7fr_0.7fr_0.7fr_0.7fr_0.9fr_1fr_1.1fr]';

function toDateInput(value: string | null): string {
  return value ?? '';
}

function isWithinDateRange(value: string, from: string | null, to: string | null): boolean {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return true;
  }

  const start = from ? Date.parse(`${from}T00:00:00`) : null;
  const end = to ? Date.parse(`${to}T23:59:59`) : null;

  if (start !== null && timestamp < start) {
    return false;
  }

  if (end !== null && timestamp > end) {
    return false;
  }

  return true;
}

function BatchListPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, isHydrated, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const deleteBatch = useDeleteBatch();
  const projectOptions = projectsData?.items ?? [];

  const projectFilter = normalizeProjectFilterValue(searchParams.get('project_id'), currentProject?.id);
  const statusFilter = STATUS_OPTIONS.includes((searchParams.get('status') ?? 'all') as (typeof STATUS_OPTIONS)[number])
    ? ((searchParams.get('status') ?? 'all') as (typeof STATUS_OPTIONS)[number])
    : 'all';
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');

  const batchesQuery = useInfiniteBatchList({
    limit: 20,
    projectFilter,
    status: statusFilter,
  });

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!searchParams.get('project_id') && currentProject?.id) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set('project_id', currentProject.id);
      router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    }
  }, [currentProject?.id, isHydrated, pathname, router, searchParams]);

  const updateSearchParams = (updates: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === 'all') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });

    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  };

  const items = useMemo(() => {
    const allItems = (batchesQuery.data?.pages ?? []).flatMap((page) => page.items ?? []);
    return allItems.filter((batch) => isWithinDateRange(batch.created_at, fromDate, toDate));
  }, [batchesQuery.data?.pages, fromDate, toDate]);

  const isLoading = batchesQuery.isLoading || !isHydrated;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">All Batches</h1>
          <p className="text-sm text-muted-foreground">
            Review every batch, filter by status or project, and jump directly into the monitor view.
          </p>
        </div>
        <Link href="/batch/new" className={buttonVariants()}>
          New Batch
        </Link>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 md:grid-cols-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="batch-list-project-filter">
            Project
          </label>
          <Select
            value={projectFilter}
            onValueChange={(value) => {
              const selectedProject = (projectsData?.items ?? []).find((project) => project.id === value);
              if (selectedProject) {
                setCurrentProject({ id: selectedProject.id, name: selectedProject.name });
              }
              updateSearchParams({ project_id: value });
            }}
          >
            <SelectTrigger id="batch-list-project-filter" aria-label="Project filter">
              <span data-slot="select-value" className="flex flex-1 text-left">
                {projectFilterLabel(projectFilter, projectOptions)}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {projectOptions.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="batch-list-status-filter">
            Status
          </label>
          <Select value={statusFilter} onValueChange={(value) => updateSearchParams({ status: value })}>
            <SelectTrigger id="batch-list-status-filter" aria-label="Status filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === 'all' ? 'All Statuses' : batchStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="batch-list-from-date">
            From
          </label>
          <Input
            id="batch-list-from-date"
            aria-label="From date"
            type="date"
            value={toDateInput(fromDate)}
            onChange={(event) => updateSearchParams({ from: event.target.value || null })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="batch-list-to-date">
            To
          </label>
          <Input
            id="batch-list-to-date"
            aria-label="To date"
            type="date"
            value={toDateInput(toDate)}
            onChange={(event) => updateSearchParams({ to: event.target.value || null })}
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable cellCount={9} gridClassName={BATCH_LIST_GRID_CLASS} />
      ) : null}

      {!isLoading && items.length === 0 ? (
        <EmptyState
          icon={fromDate || toDate ? CalendarRange : Layers3}
          title="No batches match these filters"
          description={`No batches are currently visible for ${projectFilterLabel(projectFilter, projectsData?.items ?? [])}.`}
          actionHref="/batch/new"
          actionLabel="Create Batch"
        />
      ) : null}

      {!isLoading && items.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className={`${BATCH_LIST_GRID_CLASS} gap-4 border-b border-border/70 bg-muted/20 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground`}>
            <span>Name</span>
            <span>Pipeline</span>
            <span>Total</span>
            <span>Succeeded</span>
            <span>Failed</span>
            <span>Cancelled</span>
            <span>Status</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>

          {items.map((batch) => (
            <div
              key={batch.id}
              className={`${BATCH_LIST_GRID_CLASS} gap-4 border-b border-border/60 px-4 py-4 last:border-none`}
            >
              <div className="space-y-2">
                <div className="font-medium text-foreground">{batch.name ?? batch.id}</div>
                <BatchProgressBar
                  total={batch.total}
                  succeeded={batch.succeeded}
                  failed={batch.failed}
                  cancelled={batch.cancelled}
                  className="max-w-xs"
                />
              </div>
              <div className="text-sm text-foreground">{batchPipelineLabel(batch.pipeline)}</div>
              <div className="text-sm text-foreground">{batch.total}</div>
              <div className="text-sm text-[hsl(145,70%,40%)]">{batch.succeeded}</div>
              <div className="text-sm text-[hsl(3,80%,56%)]">{batch.failed}</div>
              <div className="text-sm text-muted-foreground">{batch.cancelled}</div>
              <div>
                <BatchStatusBadge status={batch.status} />
              </div>
              <div className="text-sm text-muted-foreground">{formatRelativeTime(batch.created_at)}</div>
              <div className="flex justify-end gap-2">
                <Link
                  href={`/batch/${batch.id}`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  View
                </Link>
                {!isTerminalBatchStatus(batch.status) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 text-destructive"
                    onClick={() => {
                      void deleteBatch.mutateAsync(
                        { batchId: batch.id, cascade: true },
                        {
                          onSuccess: () => {
                            toast.success('Batch cancelled.');
                          },
                        }
                      );
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {batchesQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              void batchesQuery.fetchNextPage();
            }}
            disabled={batchesQuery.isFetchingNextPage}
          >
            {batchesQuery.isFetchingNextPage ? 'Loading…' : 'Load More'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function BatchListPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading batches…</div>}>
      <BatchListPageContent />
    </Suspense>
  );
}

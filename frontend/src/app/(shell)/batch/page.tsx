'use client';

import Link from 'next/link';
import { Layers3, ListFilter, PlusCircle } from 'lucide-react';

import { BatchProgressBar } from '@/components/batch/batch-progress-bar';
import { BatchStatusBadge } from '@/components/batch/batch-status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBatchList } from '@/lib/hooks/use-batches';
import {
  batchPipelineLabel,
  getBatchProgressPercent,
  type Batch,
} from '@/lib/batch-utils';
import { formatRelativeTime } from '@/lib/pipeline-utils';
import { cn } from '@/lib/utils';

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <Card className="border-border/70 bg-card shadow-none">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function RecentBatchRow({ batch }: { batch: Batch }) {
  return (
    <Link href={`/batch/${batch.id}`} className="block">
      <div className="rounded-2xl border border-border/70 bg-card p-4 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">{batch.name ?? batch.id}</h2>
              <BatchStatusBadge status={batch.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {batchPipelineLabel(batch.pipeline)} · {formatRelativeTime(batch.created_at)}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {getBatchProgressPercent(batch)}% complete
          </div>
        </div>

        <div className="mt-4">
          <BatchProgressBar
            total={batch.total}
            succeeded={batch.succeeded}
            failed={batch.failed}
            cancelled={batch.cancelled}
          />
        </div>
      </div>
    </Link>
  );
}

export default function BatchDashboardPage() {
  const recentQuery = useBatchList({ limit: 5 });
  const summaryQuery = useBatchList({ limit: 100 });

  const recentBatches = recentQuery.data?.items ?? [];
  const summaryItems = summaryQuery.data?.items ?? [];

  const stats = {
    total: summaryItems.length,
    running: summaryItems.filter((batch) => batch.status === 'running' || batch.status === 'pending').length,
    completed: summaryItems.filter((batch) => batch.status === 'completed').length,
    failed: summaryItems.filter((batch) => batch.status === 'failed' || batch.status === 'partial').length,
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Batch Overview</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Track throughput across batch runs, then drill into the latest batches to inspect progress or results.
          </p>
        </div>

        <Link href="/batch/new" className={buttonVariants()}>
          <PlusCircle className="size-4" />
          New Batch
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Batches" value={stats.total} />
        <KpiCard label="In Progress" value={stats.running} />
        <KpiCard label="Completed" value={stats.completed} />
        <KpiCard label="Failed / Partial" value={stats.failed} />
      </div>

      <Card className="border-border/70 bg-card shadow-none">
        <CardHeader className="flex flex-col gap-3 border-b md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Recent Batches</CardTitle>
            <CardDescription>The five most recent batch submissions across all projects.</CardDescription>
          </div>
          <Link href="/batch/list" className={cn(buttonVariants({ variant: 'outline' }))}>
            View All
          </Link>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {recentQuery.isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`batch-dashboard-skeleton-${index}`}
                className="h-28 animate-pulse rounded-2xl border border-border/70 bg-muted/30"
              />
            ))
          ) : null}

          {!recentQuery.isLoading && recentBatches.length === 0 ? (
            <EmptyState
              icon={summaryItems.length === 0 ? Layers3 : ListFilter}
              title="No batches yet"
              description="Create your first batch to start monitoring grouped task progress and outcomes."
              actionHref="/batch/new"
              actionLabel="Create Batch"
            />
          ) : null}

          {!recentQuery.isLoading &&
            recentBatches.map((batch) => <RecentBatchRow key={batch.id} batch={batch} />)}
        </CardContent>
      </Card>
    </div>
  );
}

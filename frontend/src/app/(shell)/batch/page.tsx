'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Layers3, ListFilter, PlusCircle } from 'lucide-react';

import { BatchProgressBar } from '@/components/batch/batch-progress-bar';
import { BatchStatusBadge } from '@/components/batch/batch-status-badge';
import { DashboardCharts, type DashboardRange } from '@/components/batch/dashboard-charts';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonRow } from '@/components/shared/skeleton-row';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBatchList } from '@/lib/hooks/use-batches';
import { useTaskList } from '@/lib/hooks/use-task-list';
import {
  batchPipelineLabel,
  getBatchProgressPercent,
  type Batch,
} from '@/lib/batch-utils';
import { formatRelativeTime } from '@/lib/pipeline-utils';
import { cn } from '@/lib/utils';
import { useAppTranslations } from '@/lib/i18n';

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
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
  const t = useAppTranslations('batch');

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
            {t('overview.progressComplete', { percent: getBatchProgressPercent(batch) })}
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
  const t = useAppTranslations('batch');
  const [range, setRange] = useState<DashboardRange>('7d');
  const [nowSnapshot] = useState(() => Date.now());
  const recentQuery = useBatchList({ limit: 5 });
  const summaryQuery = useBatchList({ limit: 100 });
  const tasksQuery = useTaskList({ limit: 1000, projectFilter: 'all' });

  const recentBatches = recentQuery.data?.items ?? [];
  const summaryItems = summaryQuery.data?.items ?? [];
  const tasks = tasksQuery.data ?? [];

  const stats = {
    total: summaryItems.length,
    running: summaryItems.filter((batch) => batch.status === 'running' || batch.status === 'pending').length,
    completed: summaryItems.filter((batch) => batch.status === 'completed').length,
    failed: summaryItems.filter((batch) => batch.status === 'failed' || batch.status === 'partial').length,
  };

  const enhancedStats = useMemo(() => {
    const today = new Date(nowSnapshot);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const rangeDays = range === '1d' ? 1 : range === '7d' ? 7 : 30;
    const rangeStart = nowSnapshot - rangeDays * 24 * 60 * 60 * 1000;
    const rangedTasks = tasks.filter((task) => new Date(task.created_at ?? 0).getTime() >= rangeStart);
    const todayTasks = tasks.filter((task) => new Date(task.created_at ?? 0).getTime() >= startOfToday);
    const completedDurations = rangedTasks
      .filter((task) => task.started_at && task.completed_at)
      .map((task) => new Date(task.completed_at ?? 0).getTime() - new Date(task.started_at ?? 0).getTime())
      .filter((duration) => Number.isFinite(duration) && duration >= 0);
    const averageDurationMs =
      completedDurations.length > 0
        ? completedDurations.reduce((total, duration) => total + duration, 0) / completedDurations.length
        : 0;
    const durationBuckets = [
      { bucket: '<1m', count: 0 },
      { bucket: '1-5m', count: 0 },
      { bucket: '5-15m', count: 0 },
      { bucket: '15m+', count: 0 },
    ];

    completedDurations.forEach((duration) => {
      const minutes = duration / 60_000;
      if (minutes < 1) {
        durationBuckets[0].count += 1;
      } else if (minutes < 5) {
        durationBuckets[1].count += 1;
      } else if (minutes < 15) {
        durationBuckets[2].count += 1;
      } else {
        durationBuckets[3].count += 1;
      }
    });

    const succeeded = rangedTasks.filter((task) => task.status === 'completed').length;
    const failed = rangedTasks.filter((task) => task.status === 'failed' || task.status === 'cancelled').length;

    return {
      averageDuration: averageDurationMs ? `${Math.round(averageDurationMs / 1000)}s` : '0s',
      durationBuckets,
      successData: [
        { name: 'Succeeded', value: succeeded },
        { name: 'Failed', value: failed },
      ],
      todayCompleted: todayTasks.filter((task) => task.status === 'completed').length,
      todayFailed: todayTasks.filter((task) => task.status === 'failed').length,
      queued: tasks.filter((task) => task.status === 'pending' || task.status === 'running').length,
    };
  }, [nowSnapshot, range, tasks]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">{t('overview.title')}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t('overview.description')}</p>
        </div>

        <Link href="/batch/new" className={buttonVariants()}>
          <PlusCircle className="size-4" />
          {t('actions.newBatch')}
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t('overview.kpis.total')} value={stats.total} />
        <KpiCard label={t('overview.kpis.inProgress')} value={stats.running} />
        <KpiCard label={t('overview.kpis.completed')} value={stats.completed} />
        <KpiCard label={t('overview.kpis.failedOrPartial')} value={stats.failed} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Today completed" value={enhancedStats.todayCompleted} />
        <KpiCard label="Today failed" value={enhancedStats.todayFailed} />
        <KpiCard label="Queued" value={enhancedStats.queued} />
        <KpiCard label="Average duration" value={enhancedStats.averageDuration} />
      </div>

      <DashboardCharts
        range={range}
        onRangeChange={setRange}
        successData={enhancedStats.successData}
        durationData={enhancedStats.durationBuckets}
      />

      <Card className="border-border/70 bg-card shadow-none">
        <CardHeader className="flex flex-col gap-3 border-b md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>{t('overview.recentTitle')}</CardTitle>
            <CardDescription>{t('overview.recentDescription')}</CardDescription>
          </div>
          <Link href="/batch/list" className={cn(buttonVariants({ variant: 'outline' }))}>
            {t('actions.viewAll')}
          </Link>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {recentQuery.isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <SkeletonRow
                key={`batch-dashboard-skeleton-${index}`}
                cellCount={2}
                gridClassName="grid grid-cols-[1fr_10rem]"
                className="rounded-2xl border border-border/70 bg-muted/10"
                heightClassName="h-5"
              />
            ))
          ) : null}

          {!recentQuery.isLoading && recentBatches.length === 0 ? (
            <EmptyState
              icon={summaryItems.length === 0 ? Layers3 : ListFilter}
              title={t('overview.emptyTitle')}
              description={t('overview.emptyDescription')}
              action={{
                href: '/batch/new',
                label: t('actions.createBatch'),
                role: 'button',
              }}
            />
          ) : null}

          {!recentQuery.isLoading &&
            recentBatches.map((batch) => <RecentBatchRow key={batch.id} batch={batch} />)}
        </CardContent>
      </Card>
    </div>
  );
}

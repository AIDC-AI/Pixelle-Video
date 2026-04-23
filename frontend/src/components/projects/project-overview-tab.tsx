'use client';

import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ProjectPreview } from '@/components/projects/project-preview';
import { formatRelativeTime, inferPipeline, statusBadgeClassName, statusLabel } from '@/lib/pipeline-utils';
import type { components } from '@/types/api';

type Batch = components['schemas']['Batch'];
type ProjectOverviewResponse = components['schemas']['ProjectOverviewResponse'];
type Task = components['schemas']['Task'];
type VideoItem = components['schemas']['VideoItem'];

function StatCard({
  description,
  title,
  value,
}: {
  description: string;
  title: string;
  value: string;
}) {
  return (
    <Card className="border-border/70 bg-card shadow-none">
      <CardContent className="space-y-2 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function RecentBatchList({ batches }: { batches: Batch[] }) {
  if (batches.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无最近批处理。</p>;
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => (
        <div key={batch.id} className="rounded-xl border border-border/70 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">{batch.name ?? batch.id}</p>
              <p className="text-xs text-muted-foreground">
                {batch.pipeline} · {formatRelativeTime(batch.updated_at)}
              </p>
            </div>
            <Badge className={statusBadgeClassName(batch.status)}>{statusLabel(batch.status)}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentTaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无最近任务。</p>;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div key={task.task_id} className="rounded-xl border border-border/70 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">{task.task_id}</p>
              <p className="text-xs text-muted-foreground">
                {inferPipeline(task).label} · {formatRelativeTime(task.created_at)}
              </p>
            </div>
            <Badge className={statusBadgeClassName(task.status)}>{statusLabel(task.status)}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentVideoList({ videos }: { videos: VideoItem[] }) {
  if (videos.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无最近视频。</p>;
  }

  return (
    <div className="space-y-3">
      {videos.map((video) => (
        <Link
          key={video.task_id}
          href={`/library/videos/${video.task_id}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3 transition-colors hover:bg-muted/30"
        >
          <div>
            <p className="font-medium text-foreground">{video.title}</p>
            <p className="text-xs text-muted-foreground">{formatRelativeTime(video.completed_at ?? video.created_at)}</p>
          </div>
          <span className="text-xs text-muted-foreground">{video.task_id}</span>
        </Link>
      ))}
    </div>
  );
}

export interface ProjectOverviewTabProps {
  continueHref: string;
  overview: ProjectOverviewResponse;
}

export function ProjectOverviewTab({ continueHref, overview }: ProjectOverviewTabProps) {
  const stats = overview.stats;
  const recent = overview.recent;
  const completedCount = stats?.completed_task_count ?? 0;
  const taskCount = stats?.task_count ?? 0;
  const successRate = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;
  const assetCount =
    (stats?.video_count ?? 0) +
    (stats?.image_count ?? 0) +
    (stats?.voice_count ?? 0) +
    (stats?.bgm_count ?? 0) +
    (stats?.script_count ?? 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="任务数" value={`${taskCount}`} description="项目累计任务" />
        <StatCard title="成功率" value={`${successRate}%`} description="已完成任务占比" />
        <StatCard title="素材数" value={`${assetCount}`} description="视频、图片、语音与脚本" />
        <StatCard
          title="最近更新"
          value={formatRelativeTime(overview.project.updated_at)}
          description="来自项目更新时间"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Card className="border-border/70 bg-card shadow-none">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_220px]">
            <div className="space-y-3">
              <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">项目概览</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{overview.project.name}</p>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Continue building this project, review recent activity, and jump back into the most relevant creation flow.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={continueHref} className={buttonVariants({ variant: 'default' })}>
                  继续创作
                </Link>
                <Link href="/batch" className={buttonVariants({ variant: 'outline' })}>
                  批量处理
                </Link>
                <Link href="/library/videos" className={buttonVariants({ variant: 'outline' })}>
                  资源库
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
              <ProjectPreview
                name={overview.project.name}
                pipelineHint={overview.project.pipeline_hint}
                previewKind={overview.project.preview_kind}
                previewUrl={overview.project.preview_url}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-none">
          <CardHeader>
            <CardTitle>资源摘要</CardTitle>
            <CardDescription>Quick snapshot of the project’s current footprint.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
              <span className="text-muted-foreground">批处理</span>
              <span className="font-medium text-foreground">{stats?.batch_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
              <span className="text-muted-foreground">视频</span>
              <span className="font-medium text-foreground">{stats?.video_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
              <span className="text-muted-foreground">图片</span>
              <span className="font-medium text-foreground">{stats?.image_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
              <span className="text-muted-foreground">语音 / BGM / 脚本</span>
              <span className="font-medium text-foreground">
                {(stats?.voice_count ?? 0) + (stats?.bgm_count ?? 0) + (stats?.script_count ?? 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-border/70 bg-card shadow-none">
          <CardHeader>
            <CardTitle>最近批处理</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentBatchList batches={recent?.batches ?? []} />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-none">
          <CardHeader>
            <CardTitle>最近任务</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTaskList tasks={recent?.tasks ?? []} />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-none">
          <CardHeader>
            <CardTitle>最近视频</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentVideoList videos={recent?.videos ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

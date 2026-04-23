'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { ErrorState } from '@/components/shared/error-state';
import { SkeletonDetail } from '@/components/shared/skeleton-detail';
import { ProjectOverviewTab } from '@/components/projects/project-overview-tab';
import { ProjectSettingsTab } from '@/components/projects/project-settings-tab';
import { ProjectTasksTab } from '@/components/projects/project-tasks-tab';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDeleteProject, useProjectOverview } from '@/lib/hooks/use-projects';
import { formatRelativeTime } from '@/lib/pipeline-utils';
import { useCurrentProjectStore } from '@/stores/current-project';

type ProjectTab = 'overview' | 'tasks' | 'videos' | 'settings';

function getCreateHref(pipelineHint?: string | null): string {
  switch (pipelineHint) {
    case 'quick':
      return '/create/quick';
    case 'digital-human':
      return '/create/digital-human';
    case 'i2v':
      return '/create/i2v';
    case 'action-transfer':
      return '/create/action-transfer';
    case 'custom':
      return '/create/custom';
    default:
      return '/create';
  }
}

function getActiveTab(tab: string | null): ProjectTab {
  return tab === 'tasks' || tab === 'videos' || tab === 'settings' ? tab : 'overview';
}

export default function ProjectWorkbenchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clearCurrentProject = useCurrentProjectStore((state) => state.clearCurrentProject);
  const overviewQuery = useProjectOverview(params.id);
  const deleteProject = useDeleteProject();
  const activeTab = getActiveTab(searchParams.get('tab'));

  const project = overviewQuery.data?.project;
  const continueHref = useMemo(() => getCreateHref(project?.pipeline_hint), [project?.pipeline_hint]);

  const handleDelete = async () => {
    if (!project) {
      return;
    }

    await deleteProject.mutateAsync({ projectId: project.id, cascade: true });
    clearCurrentProject();
    router.replace('/projects');
  };

  if (overviewQuery.isLoading) {
    return <SkeletonDetail />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <ErrorState
        variant="page"
        title="Failed to load project"
        description={overviewQuery.error?.message ?? 'The project overview is unavailable right now.'}
        onRetry={() => void overviewQuery.refetch()}
      />
    );
  }

  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/projects" className="hover:text-foreground">
              全部项目
            </Link>
            <span>/</span>
            <span className="text-foreground">{project?.name}</span>
          </nav>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-foreground">{project?.name}</h1>
            <p className="text-sm text-muted-foreground">Updated {formatRelativeTime(project?.updated_at)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={continueHref} className={buttonVariants({ variant: 'default' })}>
            打开创作
          </Link>
          <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={deleteProject.isPending}>
            删除
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextSearchParams = new URLSearchParams(searchParams.toString());
          if (value === 'overview') {
            nextSearchParams.delete('tab');
          } else {
            nextSearchParams.set('tab', value);
          }
          const queryString = nextSearchParams.toString();
          router.replace(queryString ? `/projects/${params.id}?${queryString}` : `/projects/${params.id}`);
        }}
      >
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <ProjectOverviewTab overview={overview} continueHref={continueHref} />
        </TabsContent>

        <TabsContent value="tasks" className="pt-4">
          <ProjectTasksTab projectId={params.id} />
        </TabsContent>

        <TabsContent value="videos" className="pt-4">
          <Card className="border-border/70 bg-card shadow-none">
            <CardContent className="space-y-3 p-6">
              {(overview.recent?.videos ?? []).map((video) => (
                <Link
                  key={video.task_id}
                  href={`/library/videos/${video.task_id}`}
                  className="block rounded-xl border border-border/70 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <p className="font-medium text-foreground">{video.title}</p>
                  <p className="text-xs text-muted-foreground">{video.task_id}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
          <ProjectSettingsTab project={overview.project} onDeleted={() => router.replace('/projects')} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { ProjectCard } from '@/components/projects/project-card';
import { ProjectNameDialog } from '@/components/projects/project-name-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateProject, useDeleteProject, useProjects, useUpdateProject } from '@/lib/hooks/use-projects';
import { useAppTranslations } from '@/lib/i18n';
import { useCurrentProjectStore } from '@/stores/current-project';
import type { components } from '@/types/api';

type Project = components['schemas']['Project'];

function ProjectsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useAppTranslations('projects');
  const common = useAppTranslations('common');
  const { data, isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const currentProjectId = useCurrentProjectStore((state) => state.currentProjectId);
  const setCurrentProjectId = useCurrentProjectStore((state) => state.setCurrentProjectId);

  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setCreateOpen(true);
      router.replace('/projects');
    }
  }, [router, searchParams]);

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const items = data?.items ?? [];
    if (!normalized) {
      return items;
    }

    return items.filter((project) =>
      [project.name, project.id, project.pipeline_hint ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [data?.items, query]);

  const handleCreate = async (name: string) => {
    const project = await createProject.mutateAsync({ name });
    setCurrentProjectId(project.id);
    setCreateOpen(false);
    toast.success(t('toasts.created'));
  };

  const handleRename = async (name: string) => {
    if (!renameTarget) {
      return;
    }

    await updateProject.mutateAsync({
      projectId: renameTarget.id,
      body: { name },
    });
    setRenameTarget(null);
    toast.success(t('toasts.renamed'));
  };

  const handleDelete = async (project: Project) => {
    await deleteProject.mutateAsync({ projectId: project.id, cascade: true });
    if (currentProjectId === project.id) {
      setCurrentProjectId(null);
    }
    toast.success(t('toasts.deleted'));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('page.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('page.description')}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={query}
            placeholder={t('page.searchPlaceholder')}
            className="w-full sm:w-80"
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="button" onClick={() => setCreateOpen(true)}>
            {common('create')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={`project-card-skeleton-${index}`} aspectClassName="aspect-[16/10]" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          title={query ? t('empty.filtered') : t('empty.title')}
          description={query ? 'Try a different keyword or clear the filter.' : t('empty.description')}
          action={
            query
              ? {
                  label: 'Clear search',
                  onClick: () => setQuery(''),
                }
              : {
                  label: common('create'),
                  onClick: () => setCreateOpen(true),
                }
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isCurrent={project.id === currentProjectId}
              onRename={() => setRenameTarget(project)}
              onDelete={() => void handleDelete(project)}
            />
          ))}
        </div>
      )}

      <ProjectNameDialog
        open={createOpen}
        title={t('dialogs.createTitle')}
        submitLabel={common('create')}
        pending={createProject.isPending}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />

      {renameTarget ? (
        <ProjectNameDialog
          open
          title={t('dialogs.renameTitle')}
          submitLabel={common('save')}
          initialValue={renameTarget.name}
          pending={updateProject.isPending}
          onOpenChange={(open) => {
            if (!open) {
              setRenameTarget(null);
            }
          }}
          onSubmit={handleRename}
        />
      ) : null}
    </div>
  );
}

export default function ProjectsPage() {
  const common = useAppTranslations('common');

  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{common('loading')}</div>}>
      <ProjectsPageContent />
    </Suspense>
  );
}

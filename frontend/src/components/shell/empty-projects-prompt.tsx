'use client';

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient, type ApiError } from '@/lib/api-client';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useProjects } from '@/lib/hooks/use-projects';
import { useAppTranslations } from '@/lib/i18n';
import type { components, paths } from '@/types/api';

type Project = components['schemas']['Project'];

const DISMISSED_KEY = 'empty-project-cleanup-dismissed';
const STALE_PROJECT_MS = 24 * 60 * 60 * 1000;

function isStaleEmptyProject(project: Project): boolean {
  if (project.task_count !== 0 || !project.created_at) {
    return false;
  }

  const createdAt = Date.parse(project.created_at);
  if (Number.isNaN(createdAt)) {
    return false;
  }

  return Date.now() - createdAt > STALE_PROJECT_MS;
}

export function EmptyProjectsPrompt() {
  const t = useAppTranslations('shell');
  const queryClient = useQueryClient();
  const { currentProject, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData, isLoading } = useProjects();
  const [dismissed, setDismissed] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    const raw = window.sessionStorage.getItem(DISMISSED_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
    } catch {
      window.sessionStorage.removeItem(DISMISSED_KEY);
      return [];
    }
  });

  const staleProjects = useMemo(() => {
    return (projectsData?.items ?? []).filter(
      (project) =>
        project.id !== currentProject?.id &&
        !dismissed.includes(project.id) &&
        isStaleEmptyProject(project)
    );
  }, [currentProject?.id, dismissed, projectsData?.items]);

  const deleteProjects = useMutation<
    paths['/api/projects/{project_id}']['delete']['responses'][200]['content']['application/json'],
    ApiError,
    string[]
  >({
    mutationFn: async (projectIds) => {
      let lastResponse: paths['/api/projects/{project_id}']['delete']['responses'][200]['content']['application/json'] | null = null;

      for (const projectId of projectIds) {
        lastResponse = await apiClient<
          paths['/api/projects/{project_id}']['delete']['responses'][200]['content']['application/json']
        >(`/api/projects/${projectId}`, { method: 'DELETE' });

        if (currentProject?.id === projectId) {
          setCurrentProject(null);
        }
      }

      if (!lastResponse) {
        throw {
          status: 400,
          code: 'EMPTY_PROJECT_SELECTION',
          message: t('emptyProjects.noneSelected'),
        } satisfies ApiError;
      }

      return lastResponse;
    },
    onSuccess: async (_, projectIds) => {
      toast.success(t('emptyProjects.cleanedUp', { count: projectIds.length }));
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (isLoading || staleProjects.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6 border-border/70 bg-card shadow-none">
      <CardContent className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {t('emptyProjects.title', { count: staleProjects.length })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('emptyProjects.description')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const nextDismissed = [...dismissed, ...staleProjects.map((project) => project.id)];
              setDismissed(nextDismissed);
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(nextDismissed));
              }
            }}
          >
            {t('emptyProjects.maybeLater')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              deleteProjects.mutate(staleProjects.map((project) => project.id));
            }}
            disabled={deleteProjects.isPending}
          >
            <Trash2 className="size-4" />
            {t('emptyProjects.cleanUp')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

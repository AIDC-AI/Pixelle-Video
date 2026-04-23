'use client';

import Link from 'next/link';
import { ChevronDown, FolderKanban, Plus, Rows3 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useProjects } from '@/lib/hooks/use-projects';
import { useAppTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type Project = components['schemas']['Project'];

function sortRecentProjects(projects: Project[]): Project[] {
  return [...projects]
    .sort((left, right) => (right.updated_at ?? '').localeCompare(left.updated_at ?? ''))
    .slice(0, 5);
}

export function ProjectBar() {
  const t = useAppTranslations('create');
  const { currentProject, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const [isOpen, setIsOpen] = useState(false);

  const recentProjects = useMemo(() => sortRecentProjects(projectsData?.items ?? []), [projectsData?.items]);
  const currentProjectName = currentProject?.name ?? currentProject?.id ?? null;

  const selectProject = (project: Project) => {
    setCurrentProject(project);
    setIsOpen(false);
  };

  return (
    <section
      aria-label={t('workbench.projectBar.current')}
      className="flex min-h-12 flex-col gap-3 rounded-md border border-border/70 bg-card/70 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      {currentProjectName ? (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FolderKanban className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {t('workbench.projectBar.current')}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{currentProjectName}</p>
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <FolderKanban className="size-4" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{t('workbench.projectBar.empty')}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {currentProjectName ? (
          <div className="relative">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-haspopup="menu"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}
              onClick={() => setIsOpen((value) => !value)}
            >
              {t('workbench.projectBar.switchProject')}
              <ChevronDown className={cn('size-3.5 transition-transform', isOpen ? 'rotate-180' : undefined)} />
            </button>

            {isOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-56 rounded-md border border-border/70 bg-popover p-1 text-popover-foreground shadow-lg"
              >
                {recentProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    role="menuitem"
                    aria-label={project.name}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                      project.id === currentProject?.id ? 'font-medium text-primary' : 'text-foreground'
                    )}
                    onClick={() => selectProject(project)}
                  >
                    <span className="truncate">{project.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{project.task_count}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <Link
          href="/projects?create=1"
          className={cn(buttonVariants({ variant: currentProjectName ? 'secondary' : 'default', size: 'sm' }), 'rounded-md')}
        >
          <Plus className="size-3.5" />
          {t('workbench.projectBar.newProject')}
        </Link>
        {currentProjectName ? (
          <Link href="/projects" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'rounded-md')}>
            <Rows3 className="size-3.5" />
            {t('workbench.projectBar.openProject')}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

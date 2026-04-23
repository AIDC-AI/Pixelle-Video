'use client';

import { useState, useMemo } from 'react';
import { FolderKanban, ChevronDown, Plus, Search, MoreHorizontal, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProjectNameDialog } from '@/components/projects/project-name-dialog';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useProjects, useCreateProject, useDeleteProject, useUpdateProject } from '@/lib/hooks/use-projects';
import { useAppTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type Project = components['schemas']['Project'];

interface ProjectSwitcherProps {
  isCollapsed: boolean;
}

export function ProjectSwitcher({ isCollapsed }: ProjectSwitcherProps) {
  const t = useAppTranslations('shell');
  const { currentProject, setCurrentProject, isHydrated } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const projects = projectsData?.items ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const handleSelect = (project: Project) => {
    setCurrentProject({ id: project.id });
    setIsOpen(false);
    setSearch('');
  };

  const handleCreate = async (name: string) => {
    createProject.mutate(
      { name },
      {
        onSuccess: (newProject) => {
          setCurrentProject({ id: newProject.id });
          setCreateDialogOpen(false);
          setHighlightedId(newProject.id);
          setTimeout(() => setHighlightedId(null), 1500);
          toast.success(t('topbar.project.created' as Parameters<typeof t>[0]));
        },
      }
    );
  };

  const handleRename = async (name: string) => {
    if (!renameTarget) return;
    updateProject.mutate(
      { projectId: renameTarget.id, body: { name } },
      { onSuccess: () => setRenameTarget(null) }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteProject.mutate(
      { projectId: deleteTarget.id, cascade: true },
      {
        onSuccess: () => {
          toast.success(t('projectSwitcher.deleted' as Parameters<typeof t>[0]));
          setDeleteTarget(null);
        },
      }
    );
  };

  return (
    <div className="px-3 mb-4" data-testid="project-switcher">
      <button
        data-testid="project-switcher-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted',
          isCollapsed && 'justify-center px-0'
        )}
      >
        <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
        {!isCollapsed && (
          <>
            <span className="flex-1 truncate text-left font-medium">
              {!isHydrated ? (
                <span className="inline-block h-4 w-20 animate-pulse rounded bg-muted" />
              ) : currentProject ? (
                currentProject.name
              ) : (
                t('projectSwitcher.selectProject' as Parameters<typeof t>[0])
              )}
            </span>
            <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
          </>
        )}
      </button>

      {isOpen && (
        <div className="mt-1 rounded-lg border bg-popover p-2 shadow-md" data-testid="project-switcher-panel">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('projectSwitcher.searchPlaceholder' as Parameters<typeof t>[0])}
              className="w-full rounded-md border bg-transparent py-1.5 pl-7 pr-2 text-xs focus:outline-ring"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                {t('projectSwitcher.noProject' as Parameters<typeof t>[0])}
              </p>
            ) : (
              filtered.map((project) => (
                <div
                  key={project.id}
                  data-project-id={project.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-muted',
                    currentProject?.id === project.id && 'bg-accent text-accent-foreground',
                    highlightedId === project.id && 'animate-highlight'
                  )}
                  onClick={() => handleSelect(project)}
                >
                  <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{project.name}</span>
                  <span className="text-[10px] text-muted-foreground">{project.task_count}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-background"
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameTarget(project); }}>
                        {t('projectSwitcher.rename' as Parameters<typeof t>[0])}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(project); }}
                        className="text-destructive focus:text-destructive"
                      >
                        {t('projectSwitcher.delete' as Parameters<typeof t>[0])}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>

          <div className="mt-2 flex items-center gap-2 border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 flex-1 justify-start gap-2 text-xs"
              onClick={() => { setCreateDialogOpen(true); setIsOpen(false); }}
            >
              <Plus className="h-3 w-3" />
              {t('projectSwitcher.newProject' as Parameters<typeof t>[0])}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-2 text-xs"
              render={<Link href="/projects" onClick={() => setIsOpen(false)} />}
            >
                <Settings2 className="h-3 w-3" />
              {t('projectSwitcher.manageAll' as Parameters<typeof t>[0])}
            </Button>
          </div>
        </div>
      )}

      <ProjectNameDialog
        open={createDialogOpen}
        title={t('projectSwitcher.createTitle' as Parameters<typeof t>[0])}
        submitLabel={t('projectSwitcher.createSubmit' as Parameters<typeof t>[0])}
        pending={createProject.isPending}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreate}
      />

      {renameTarget && (
        <ProjectNameDialog
          open={true}
          title={t('projectSwitcher.renameTitle' as Parameters<typeof t>[0])}
          submitLabel={t('projectSwitcher.renameSubmit' as Parameters<typeof t>[0])}
          initialValue={renameTarget.name}
          pending={updateProject.isPending}
          onOpenChange={(open) => { if (!open) setRenameTarget(null); }}
          onSubmit={handleRename}
        />
      )}

      {deleteTarget && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('projectSwitcher.deleteConfirmTitle' as Parameters<typeof t>[0])}</DialogTitle>
              <DialogDescription>
                {deleteTarget.task_count > 0
                  ? t('projectSwitcher.deleteConfirmDescription' as Parameters<typeof t>[0], {
                      name: deleteTarget.name,
                      taskCount: deleteTarget.task_count,
                    })
                  : t('projectSwitcher.deleteConfirmDescriptionEmpty' as Parameters<typeof t>[0], {
                      name: deleteTarget.name,
                    })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                {t('topbar.actions.cancel' as Parameters<typeof t>[0])}
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteProject.isPending}>
                {t('projectSwitcher.delete' as Parameters<typeof t>[0])}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useCurrentProjectStore } from '@/stores/current-project';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Moon, Sun, Search, Bell, User, Clapperboard, ChevronDown, Plus } from 'lucide-react';
import { useProjects, useCreateProject } from '@/lib/hooks/use-projects';
import { cn } from '@/lib/utils';
import type { ApiError } from '@/lib/api-client';

export function Topbar() {
  const { currentProject, setCurrentProject } = useCurrentProjectStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const unsub = useCurrentProjectStore.persist.onFinishHydration(() => setIsHydrated(true));
    if (useCurrentProjectStore.persist.hasHydrated()) {
      setIsHydrated(true);
    } else {
      useCurrentProjectStore.persist.rehydrate();
    }
    return () => unsub();
  }, []);

  const { data: projectsData } = useProjects();
  const createProject = useCreateProject();

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as ApiError).message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    return 'Failed to create project';
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    createProject.mutate(
      { name: newProjectName.trim() },
      {
        onSuccess: (newProject) => {
          setCurrentProject({ id: newProject.id, name: newProject.name });
          setIsDialogOpen(false);
          setNewProjectName('');
          toast.success('Project created successfully');
        },
        onError: (error: unknown) => {
          toast.error(getErrorMessage(error));
        }
      }
    );
  };

  return (
    <header className="flex items-center justify-between px-6 h-14 border-b bg-background">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 font-bold text-foreground">
          <div className="w-5 h-5 bg-foreground text-background rounded flex items-center justify-center text-[11px]">
            <Clapperboard className="w-3 h-3" />
          </div>
          <span>Pixelle</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 gap-2 text-xs font-normal")}>
            {!isHydrated ? (
              <span className="w-24 h-4 bg-muted animate-pulse rounded-md" />
            ) : currentProject ? currentProject.name : 'Select Project'}
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {projectsData?.items?.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setCurrentProject({ id: p.id, name: p.name })}
              >
                {p.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setIsDialogOpen(true)} onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-3 h-3 mr-2" />
              New Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <input
                type="text"
                placeholder="Project Name"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-ring"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateProject} disabled={createProject.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 flex justify-center">
        <Button variant="outline" size="sm" className="w-64 justify-start text-muted-foreground h-8">
          <Search className="w-3 h-3 mr-2" />
          <span>Search or type a command...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {mounted ? (theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />) : <div className="w-4 h-4" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="w-4 h-4" />
          <span className="sr-only">Notifications</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <User className="w-4 h-4" />
          <span className="sr-only">User Menu</span>
        </Button>
      </div>
    </header>
  );
}

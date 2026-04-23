'use client';

import React, { useState } from 'react';
import { AlertCircle, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppTranslations } from '@/lib/i18n';
import { useCreateProject } from '@/lib/hooks/use-projects';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProjectRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectRequiredDialog({ open, onOpenChange }: ProjectRequiredDialogProps) {
  const t = useAppTranslations('createCommon');
  const shellT = useAppTranslations('shell');
  const createProject = useCreateProject();
  const { setCurrentProject } = useCurrentProjectHydration();
  const [projectName, setProjectName] = useState('');

  const handleCreate = () => {
    const trimmed = projectName.trim();
    if (!trimmed) return;

    createProject.mutate(
      { name: trimmed },
      {
        onSuccess: (newProject) => {
          setCurrentProject({ id: newProject.id });
          setProjectName('');
          onOpenChange(false);
          toast.success(shellT('topbar.project.created' as Parameters<typeof shellT>[0]));
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">{t('projectRequiredTitle')}</DialogTitle>
          <DialogDescription className="text-center">
            {t('projectRequiredDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            placeholder={shellT('topbar.project.namePlaceholder' as Parameters<typeof shellT>[0])}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
        </div>
        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={createProject.isPending || !projectName.trim()}
          >
            <FolderKanban className="size-4" />
            {shellT('projectSwitcher.createSubmit' as Parameters<typeof shellT>[0])}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

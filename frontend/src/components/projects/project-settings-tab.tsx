'use client';

import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeleteProject, useUpdateProject } from '@/lib/hooks/use-projects';
import { useCurrentProjectStore } from '@/stores/current-project';
import type { components } from '@/types/api';

type Project = components['schemas']['Project'];

export interface ProjectSettingsTabProps {
  onDeleted?: () => void;
  project: Project;
}

export function ProjectSettingsTab({ onDeleted, project }: ProjectSettingsTabProps) {
  const nameId = useId();
  const coverId = useId();
  const setCurrentProjectId = useCurrentProjectStore((state) => state.setCurrentProjectId);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [name, setName] = useState(project.name);
  const [coverUrl, setCoverUrl] = useState(project.cover_url ?? '');

  useEffect(() => {
    setName(project.name);
    setCoverUrl(project.cover_url ?? '');
  }, [project.cover_url, project.name]);

  const dirty = name.trim() !== project.name || coverUrl !== (project.cover_url ?? '');

  const handleSave = async () => {
    await updateProject.mutateAsync({
      projectId: project.id,
      body: {
        name: name.trim(),
        cover_url: coverUrl.trim() ? coverUrl.trim() : null,
      },
    });
    toast.success('项目设置已保存');
  };

  const handleDelete = async () => {
    await deleteProject.mutateAsync({ projectId: project.id, cascade: true });
    setCurrentProjectId(null);
    onDeleted?.();
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card shadow-none">
        <CardHeader>
          <CardTitle>项目设置</CardTitle>
          <CardDescription>Update the project name and cover without leaving the workbench.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor={nameId}>项目名称</Label>
            <Input id={nameId} value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={coverId}>封面链接</Label>
            <Input id={coverId} value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} />
          </div>

          {updateProject.isError ? (
            <ErrorState
              variant="inline"
              title="保存失败"
              description={updateProject.error.message}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSave} disabled={!dirty || updateProject.isPending}>
              保存
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card shadow-none">
        <CardHeader>
          <CardTitle>危险操作</CardTitle>
          <CardDescription>Deleting a project also clears its current-project selection.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteProject.isPending}>
            删除
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

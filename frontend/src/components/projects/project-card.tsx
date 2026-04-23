'use client';

import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectPreview } from '@/components/projects/project-preview';
import { formatRelativeTime } from '@/lib/pipeline-utils';
import type { components } from '@/types/api';

type Project = components['schemas']['Project'];

export interface ProjectCardProps {
  isCurrent?: boolean;
  onDelete?: () => void;
  onRename?: () => void;
  project: Project;
}

export function ProjectCard({ isCurrent = false, onDelete, onRename, project }: ProjectCardProps) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card shadow-none transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
      <Link href={`/projects/${project.id}`} className="block" aria-label={`Open project ${project.name}`}>
        <div className="aspect-[16/10] overflow-hidden border-b border-border/70 bg-muted/20">
          <ProjectPreview
            name={project.name}
            pipelineHint={project.pipeline_hint}
            previewKind={project.preview_kind}
            previewUrl={project.preview_url}
          />
        </div>
      </Link>

      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Link href={`/projects/${project.id}`} className="truncate text-base font-semibold text-foreground hover:text-primary">
                {project.name}
              </Link>
              {isCurrent ? <Badge variant="secondary">当前项目</Badge> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {project.task_count} tasks · {formatRelativeTime(project.updated_at)}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" onClick={onRename} aria-label="编辑">
              <Pencil className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label="删除">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

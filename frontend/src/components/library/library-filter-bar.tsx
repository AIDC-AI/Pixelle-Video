'use client';

import React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { projectFilterLabel } from '@/lib/pipeline-utils';
import type { components } from '@/types/api';

type Project = components['schemas']['Project'];

interface LibraryFilterBarProps {
  children?: React.ReactNode;
  description: string;
  projectFilter: string;
  projectLabel?: string;
  projects: Project[];
  selectId: string;
  title: string;
  onProjectFilterChange: (value: string | null) => void;
}

export function LibraryFilterBar({
  children,
  description,
  projectFilter,
  projectLabel = 'Project',
  projects,
  selectId,
  title,
  onProjectFilterChange,
}: LibraryFilterBarProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 md:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor={selectId}>
            {projectLabel}
          </label>
          <Select value={projectFilter} onValueChange={onProjectFilterChange}>
            <SelectTrigger id={selectId} aria-label={projectLabel}>
              <span data-slot="select-value" className="flex flex-1 text-left">
                {projectFilterLabel(projectFilter, projects)}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {children ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div> : null}
      </div>
    </div>
  );
}

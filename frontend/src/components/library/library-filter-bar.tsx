'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { projectFilterLabel } from '@/lib/pipeline-utils';
import type { components } from '@/types/api';

type Project = components['schemas']['Project'];

interface LibraryFilterBarProps {
  allProjectsLabel?: string;
  children?: React.ReactNode;
  description: string;
  projectFilter: string;
  projectLabel?: string;
  projects: Project[];
  selectId: string;
  title: string;
  unassignedLabel?: string;
  onProjectFilterChange: (value: string | null) => void;
}

export function LibraryFilterBar({
  allProjectsLabel = 'All Projects',
  children,
  description,
  projectFilter,
  projectLabel = 'Project',
  projects,
  selectId,
  title,
  unassignedLabel = 'Unassigned',
  onProjectFilterChange,
}: LibraryFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);

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
          <div className="relative">
            <button
              id={selectId}
              type="button"
              role="combobox"
              aria-label={projectLabel}
              aria-expanded={isOpen}
              aria-controls={`${selectId}-listbox`}
              aria-haspopup="listbox"
              className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={() => setIsOpen((open) => !open)}
            >
              <span>{projectFilterLabel(projectFilter, projects)}</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>

            {isOpen ? (
              <div
                id={`${selectId}-listbox`}
                role="listbox"
                aria-label={projectLabel}
                className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover p-1 shadow-lg"
              >
                {[
                  { label: allProjectsLabel, value: 'all' },
                  { label: unassignedLabel, value: '__unassigned__' },
                  ...projects.map((project) => ({ label: project.name, value: project.id })),
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={projectFilter === option.value}
                    className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      setIsOpen(false);
                      onProjectFilterChange(option.value);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {children ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div> : null}
      </div>
    </div>
  );
}

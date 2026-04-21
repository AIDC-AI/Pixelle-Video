'use client';

import type { LucideIcon } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';

interface LibraryEmptyStateProps {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  icon: LucideIcon;
  title: string;
}

export function LibraryEmptyState({
  actionHref = '/create',
  actionLabel = 'Go to Create',
  description,
  icon,
  title,
}: LibraryEmptyStateProps) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      actionHref={actionHref}
      actionLabel={actionLabel}
    />
  );
}

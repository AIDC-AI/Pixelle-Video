'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface LibraryTableProps {
  body: ReactNode;
  columns: ReactNode[];
  gridClassName: string;
}

export function LibraryTable({ body, columns, gridClassName }: LibraryTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div
        className={cn(
          'gap-4 border-b border-border/70 bg-muted/20 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
          gridClassName
        )}
      >
        {columns.map((column, index) => (
          <span key={`library-column-${index}`}>{column}</span>
        ))}
      </div>
      {body}
    </div>
  );
}

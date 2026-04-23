import type React from 'react';

import { cn } from '@/lib/utils';

interface MasonryGridProps {
  children: React.ReactNode;
  className?: string;
}

export function MasonryGrid({ children, className }: MasonryGridProps) {
  return (
    <div className={cn('columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4', className)}>
      {children}
    </div>
  );
}

export function MasonryGridItem({ children, className }: MasonryGridProps) {
  return <div className={cn('mb-4 break-inside-avoid', className)}>{children}</div>;
}

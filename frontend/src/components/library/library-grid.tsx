'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface LibraryGridProps {
  children: ReactNode;
  className?: string;
}

export function LibraryGrid({ children, className }: LibraryGridProps) {
  return <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}

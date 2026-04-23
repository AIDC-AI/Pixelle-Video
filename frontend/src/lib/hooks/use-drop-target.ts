'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

export type DropTargetType = 'create' | 'library' | 'other';

export function getDropTargetType(pathname: string | null): DropTargetType {
  if (pathname?.startsWith('/create')) {
    return 'create';
  }
  if (pathname?.startsWith('/library')) {
    return 'library';
  }
  return 'other';
}

export function hasFileTransfer(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) {
    return false;
  }

  return Array.from(dataTransfer.types ?? []).includes('Files');
}

export function useDropTarget() {
  const pathname = usePathname();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const targetType = useMemo(() => getDropTargetType(pathname), [pathname]);

  return {
    files,
    isDragging,
    setFiles,
    setIsDragging,
    targetType,
  };
}

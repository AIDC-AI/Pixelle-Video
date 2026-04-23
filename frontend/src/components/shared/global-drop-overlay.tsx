'use client';

import React, { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

import { useDropTarget, hasFileTransfer, type DropTargetType } from '@/lib/hooks/use-drop-target';
import { useAppTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface GlobalDropOverlayProps {
  children: React.ReactNode;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

function parseAcceptList(accept: string): string[] {
  return accept
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesAcceptedType(file: File, accept: string): boolean {
  const acceptedTypes = parseAcceptList(accept);
  if (acceptedTypes.length === 0) {
    return true;
  }

  const fileName = file.name.toLowerCase();
  return acceptedTypes.some((acceptedType) => {
    if (acceptedType.endsWith('/*')) {
      const prefix = acceptedType.slice(0, acceptedType.indexOf('/'));
      return file.type.startsWith(`${prefix}/`);
    }
    if (acceptedType.startsWith('.')) {
      return fileName.endsWith(acceptedType.toLowerCase());
    }
    return file.type === acceptedType;
  });
}

function assignFilesToInput(input: HTMLInputElement, files: File[]): void {
  if (typeof DataTransfer !== 'undefined') {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
  } else {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: files,
    });
  }

  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function selectCreateInput(files: File[]): HTMLInputElement | null {
  const fileInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="file"]:not(:disabled)')
  );

  return fileInputs.find((input) => files.every((file) => matchesAcceptedType(file, input.accept))) ?? null;
}

async function uploadLibraryFiles(files: File[]): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/uploads`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(response.statusText || 'Upload failed.');
      }
    })
  );
}

export function GlobalDropOverlay({ children }: GlobalDropOverlayProps) {
  const t = useAppTranslations('shell');
  const queryClient = useQueryClient();
  const { isDragging, setFiles, setIsDragging, targetType } = useDropTarget();
  const dragDepthRef = useRef(0);

  useEffect(() => {
    const resetDragState = () => {
      dragDepthRef.current = 0;
      setIsDragging(false);
    };

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFileTransfer(event.dataTransfer)) {
        return;
      }

      dragDepthRef.current += 1;
      setIsDragging(true);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasFileTransfer(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
      setIsDragging(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFileTransfer(event.dataTransfer)) {
        return;
      }

      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDrop = (event: DragEvent) => {
      if (!hasFileTransfer(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      resetDragState();

      const droppedFiles = Array.from(event.dataTransfer?.files ?? []);
      setFiles(droppedFiles);
      void handleFilesForTarget(droppedFiles, targetType, queryClient, {
        createNoTarget: t('dropOverlay.createNoTarget' as Parameters<typeof t>[0]),
        libraryFailed: t('dropOverlay.libraryFailed' as Parameters<typeof t>[0]),
        librarySuccess: t('dropOverlay.librarySuccess' as Parameters<typeof t>[0], { count: droppedFiles.length }),
        noFiles: t('dropOverlay.noFiles' as Parameters<typeof t>[0]),
        wrongPage: t('dropOverlay.wrongPage' as Parameters<typeof t>[0]),
      });
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [queryClient, setFiles, setIsDragging, t, targetType]);

  return (
    <>
      {children}
      <div
        aria-hidden={!isDragging}
        className={cn(
          'pointer-events-none fixed inset-0 z-[70] flex items-center justify-center border-2 border-dashed border-primary bg-primary/10 opacity-0 backdrop-blur-[2px] transition-opacity duration-200',
          isDragging && 'opacity-100'
        )}
      >
        <div className="rounded-2xl border border-primary/30 bg-background/90 px-8 py-6 text-center shadow-2xl">
          <UploadCloud className="mx-auto mb-3 size-8 text-primary" />
          <p className="text-base font-semibold text-foreground">
            {t('dropOverlay.title' as Parameters<typeof t>[0])}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('dropOverlay.description' as Parameters<typeof t>[0])}
          </p>
        </div>
      </div>
    </>
  );
}

export async function handleFilesForTarget(
  files: File[],
  targetType: DropTargetType,
  queryClient: Pick<ReturnType<typeof useQueryClient>, 'invalidateQueries'>,
  messages: {
    createNoTarget: string;
    libraryFailed: string;
    librarySuccess: string;
    noFiles: string;
    wrongPage: string;
  }
): Promise<void> {
  if (files.length === 0) {
    toast.error(messages.noFiles);
    return;
  }

  if (targetType === 'create') {
    const input = selectCreateInput(files);
    if (!input) {
      toast.error(messages.createNoTarget);
      return;
    }

    assignFilesToInput(input, files);
    return;
  }

  if (targetType === 'library') {
    try {
      await uploadLibraryFiles(files);
      await queryClient.invalidateQueries({ queryKey: ['library'] });
      toast.success(messages.librarySuccess);
    } catch {
      toast.error(messages.libraryFailed);
    }
    return;
  }

  toast.info(messages.wrongPage);
}

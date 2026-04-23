'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Star, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface LightboxImage {
  id: string;
  prompt?: string | null;
  starred?: boolean;
  title: string;
  url: string;
}

interface LightboxProps {
  images: LightboxImage[];
  initialIndex?: number;
  onDelete?: (image: LightboxImage) => void;
  onDownload?: (image: LightboxImage) => void;
  onOpenChange: (open: boolean) => void;
  onToggleStar?: (image: LightboxImage) => void;
  open: boolean;
}

export function Lightbox({
  images,
  initialIndex = 0,
  onDelete,
  onDownload,
  onOpenChange,
  onToggleStar,
  open,
}: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const current = images[index];

  useEffect(() => {
    if (open) {
      setIndex(Math.min(initialIndex, Math.max(0, images.length - 1)));
      setZoom(1);
    }
  }, [images.length, initialIndex, open]);

  const canNavigate = images.length > 1;
  const next = () => setIndex((currentIndex) => (currentIndex + 1) % images.length);
  const previous = () => setIndex((currentIndex) => (currentIndex - 1 + images.length) % images.length);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      } else if (event.key === 'ArrowRight' && canNavigate) {
        next();
      } else if (event.key === 'ArrowLeft' && canNavigate) {
        previous();
      } else if ((event.metaKey || event.ctrlKey) && event.key === '=') {
        event.preventDefault();
        setZoom((value) => Math.min(3, value + 0.25));
      } else if ((event.metaKey || event.ctrlKey) && event.key === '-') {
        event.preventDefault();
        setZoom((value) => Math.max(0.5, value - 0.25));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canNavigate, onOpenChange, open]);

  const toolbar = useMemo(() => {
    if (!current) {
      return null;
    }

    return (
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-center gap-2 bg-black/60 p-4 text-white backdrop-blur">
        <Button type="button" variant="secondary" size="sm" onClick={() => onDownload?.(current)}>
          <Download className="size-4" />
          Download
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => onToggleStar?.(current)}>
          <Star className={current.starred ? 'size-4 fill-current' : 'size-4'} />
          Star
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={() => onDelete?.(current)}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>
    );
  }, [current, onDelete, onDownload, onToggleStar]);

  if (!open || !current) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
      className="fixed inset-0 z-[80] bg-black/95 text-white"
      onWheel={(event) => setZoom((value) => Math.min(3, Math.max(0.5, value + (event.deltaY < 0 ? 0.1 : -0.1))))}
    >
      <div className="absolute left-4 top-4 z-20 max-w-[calc(100%-6rem)]">
        <h2 className="line-clamp-1 text-lg font-semibold">{current.title}</h2>
        {current.prompt ? <p className="line-clamp-1 text-sm text-white/70">{current.prompt}</p> : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 z-20 text-white hover:bg-white/10"
        aria-label="Close lightbox"
        onClick={() => onOpenChange(false)}
      >
        <X className="size-5" />
      </Button>
      {canNavigate ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="absolute left-4 top-1/2 z-20 -translate-y-1/2 text-white hover:bg-white/10"
            aria-label="Previous image"
            onClick={previous}
          >
            <ChevronLeft className="size-7" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="absolute right-4 top-1/2 z-20 -translate-y-1/2 text-white hover:bg-white/10"
            aria-label="Next image"
            onClick={next}
          >
            <ChevronRight className="size-7" />
          </Button>
        </>
      ) : null}

      <div className="flex h-full items-center justify-center p-12 pb-24">
        <div className="relative h-full w-full max-w-6xl transition-transform" style={{ transform: `scale(${zoom})` }}>
          <Image src={current.url} alt={current.title} fill unoptimized className="object-contain" />
        </div>
      </div>

      {toolbar}
    </div>
  );
}

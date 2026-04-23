'use client';

import { FolderKanban, Image as ImageIcon, Sparkles, User, Waves, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ProjectPreviewProps {
  className?: string;
  name: string;
  pipelineHint?: string | null;
  previewKind?: 'image' | 'video' | null;
  previewUrl?: string | null;
}

function PlaceholderIcon({ pipelineHint }: { pipelineHint?: string | null }) {
  switch (pipelineHint) {
    case 'digital-human':
      return <User className="h-6 w-6" />;
    case 'i2v':
      return <ImageIcon className="h-6 w-6" />;
    case 'action-transfer':
      return <Waves className="h-6 w-6" />;
    case 'custom':
      return <Sparkles className="h-6 w-6" />;
    case 'quick':
      return <Zap className="h-6 w-6" />;
    default:
      return <FolderKanban className="h-6 w-6" />;
  }
}

export function ProjectPreview({ className, name, pipelineHint, previewKind, previewUrl }: ProjectPreviewProps) {
  if (previewUrl && previewKind === 'image') {
    return (
      <img
        src={previewUrl}
        alt={name}
        loading="lazy"
        decoding="async"
        className={cn('h-full w-full object-cover', className)}
      />
    );
  }

  if (previewUrl && previewKind === 'video') {
    return (
      <video
        src={previewUrl}
        className={cn('h-full w-full object-cover', className)}
        muted
        playsInline
        preload="metadata"
        controls={false}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center bg-gradient-to-br from-muted via-muted/80 to-background text-muted-foreground',
        className
      )}
    >
      <PlaceholderIcon pipelineHint={pipelineHint} />
    </div>
  );
}

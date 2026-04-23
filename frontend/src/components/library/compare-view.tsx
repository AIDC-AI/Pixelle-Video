'use client';

import Image from 'next/image';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface CompareAsset {
  id: string;
  kind: 'audio' | 'image' | 'video';
  metadata?: Record<string, string | number | null | undefined>;
  title: string;
  url?: string | null;
}

interface CompareViewProps {
  items: CompareAsset[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function renderPreview(item: CompareAsset) {
  if (!item.url) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl bg-muted/30 text-sm text-muted-foreground">
        No preview
      </div>
    );
  }

  if (item.kind === 'image') {
    return (
      <div className="relative h-64 overflow-hidden rounded-xl bg-muted/30">
        <Image src={item.url} alt={item.title} fill unoptimized className="object-contain" />
      </div>
    );
  }

  if (item.kind === 'video') {
    return (
      <video className="h-64 w-full rounded-xl bg-black object-contain" src={item.url} controls>
        <track kind="captions" />
      </video>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <audio className="w-full" src={item.url} controls>
        <track kind="captions" />
      </audio>
    </div>
  );
}

export function CompareView({ items, onOpenChange, open }: CompareViewProps) {
  const visibleItems = items.slice(0, 4);
  const diffKeys = Array.from(
    new Set(visibleItems.flatMap((item) => Object.keys(item.metadata ?? {})))
  );

  return (
    <Dialog open={open && visibleItems.length >= 2} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92vh] max-w-[calc(100vw-2rem)] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>Compare selected assets</DialogTitle>
          <DialogDescription>Compare 2-4 assets side by side.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {visibleItems.map((item) => (
            <article key={item.id} className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
              {renderPreview(item)}
              <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{item.title}</h3>
            </article>
          ))}
        </div>

        {diffKeys.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Parameter</th>
                  {visibleItems.map((item) => (
                    <th key={item.id} className="px-4 py-3">
                      {item.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diffKeys.map((key) => (
                  <tr key={key} className="border-t border-border/60">
                    <td className="px-4 py-3 font-medium text-foreground">{key}</td>
                    {visibleItems.map((item) => (
                      <td key={`${item.id}-${key}`} className="px-4 py-3 text-muted-foreground">
                        {item.metadata?.[key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

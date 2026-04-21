'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { LibraryTable } from '@/components/library/library-table';
import { formatRelativeTime } from '@/lib/pipeline-utils';
import { usePresets } from '@/lib/hooks/use-resources';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type PresetItem = components['schemas']['PresetItem'];
type PresetSourceTab = 'builtin' | 'user';

const TABLE_GRID_CLASS = 'grid grid-cols-[1fr_10rem_1.2fr_9rem_12rem]';

function toCreateHref(preset: PresetItem): string | null {
  const pipelineMap: Record<string, string> = {
    standard: '/create/quick',
    quick: '/create/quick',
    digital_human: '/create/digital-human',
    'digital-human': '/create/digital-human',
    i2v: '/create/i2v',
    action_transfer: '/create/action-transfer',
    'action-transfer': '/create/action-transfer',
    asset_based: '/create/custom',
    custom: '/create/custom',
  };

  const basePath = pipelineMap[preset.pipeline];
  if (!basePath) {
    return null;
  }

  const params = new URLSearchParams();
  Object.entries(preset.payload_template ?? {}).forEach(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params.set(key, String(value));
      return;
    }

    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      params.set(key, JSON.stringify(value));
    }
  });

  return params.size > 0 ? `${basePath}?${params.toString()}` : basePath;
}

export default function PresetsPage() {
  const presetsQuery = usePresets();
  const [activeTab, setActiveTab] = useState<PresetSourceTab>('builtin');
  const [selectedPreset, setSelectedPreset] = useState<PresetItem | null>(null);

  const items = useMemo(
    () => (presetsQuery.data?.presets ?? []).filter((preset) => preset.source === activeTab),
    [activeTab, presetsQuery.data?.presets]
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Presets</h1>
        <p className="text-sm text-muted-foreground">
          Review built-in presets and your own saved payload templates, then jump back into a matching pipeline when the preset scope supports it.
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant={activeTab === 'builtin' ? 'default' : 'outline'} onClick={() => setActiveTab('builtin')}>
          Built-in
        </Button>
        <Button type="button" variant={activeTab === 'user' ? 'default' : 'outline'} onClick={() => setActiveTab('user')}>
          My Presets
        </Button>
      </div>

      {presetsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`preset-skeleton-${index}`} className="h-20 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          ))}
        </div>
      ) : null}

      {!presetsQuery.isLoading && items.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title={activeTab === 'builtin' ? 'No built-in presets available' : 'No personal presets yet'}
          description="Preset creation is scheduled for a later phase, but read-only inspection is available now."
        />
      ) : null}

      {!presetsQuery.isLoading && items.length > 0 ? (
        <LibraryTable
          gridClassName={TABLE_GRID_CLASS}
          columns={['Name', 'Pipeline', 'Description', 'Created', 'Actions']}
          body={
            <>
              {items.map((preset) => {
                const createHref = toCreateHref(preset);

                return (
                  <div key={`${preset.source}-${preset.name}`} className={`${TABLE_GRID_CLASS} gap-4 border-b border-border/60 px-4 py-4 last:border-none`}>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{preset.name}</p>
                      <Badge variant="outline">{preset.source}</Badge>
                    </div>
                    <div className="text-sm text-foreground">{preset.pipeline}</div>
                    <div className="text-sm text-muted-foreground">{preset.description ?? 'No description'}</div>
                    <div className="text-sm text-muted-foreground">{formatRelativeTime(preset.created_at)}</div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedPreset(preset)}>
                        View JSON
                      </Button>
                      {createHref ? (
                        <Link href={createHref} className={cn(buttonVariants({ size: 'sm' }))}>
                          Create
                        </Link>
                      ) : (
                        <Button type="button" size="sm" disabled>
                          No create route
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          }
        />
      ) : null}

      <Dialog open={Boolean(selectedPreset)} onOpenChange={(open) => !open && setSelectedPreset(null)}>
        <DialogContent className="max-w-3xl bg-background">
          <DialogHeader>
            <DialogTitle>{selectedPreset?.name ?? 'Preset JSON'}</DialogTitle>
            <DialogDescription>Readonly payload template preview.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[70vh] overflow-auto rounded-2xl border border-border/70 bg-muted/10 p-4 text-xs leading-6 text-foreground">
            {JSON.stringify(selectedPreset?.payload_template ?? {}, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

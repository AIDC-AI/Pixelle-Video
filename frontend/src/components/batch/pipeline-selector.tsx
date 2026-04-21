'use client';

import { Activity, Image as ImageIcon, PenTool, Sparkles, User } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { PIPELINE_METADATA, type BatchPipeline } from '@/lib/batch-utils';
import { cn } from '@/lib/utils';

const PIPELINE_ICONS = {
  standard: Sparkles,
  digital_human: User,
  i2v: ImageIcon,
  action_transfer: Activity,
  asset_based: PenTool,
} as const;

const PIPELINE_ORDER: BatchPipeline[] = [
  'standard',
  'digital_human',
  'i2v',
  'action_transfer',
  'asset_based',
];

export function PipelineSelector({
  value,
  onChange,
}: {
  value: BatchPipeline;
  onChange: (value: BatchPipeline) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {PIPELINE_ORDER.map((pipeline) => {
        const metadata = PIPELINE_METADATA[pipeline];
        const Icon = PIPELINE_ICONS[pipeline];
        const isActive = pipeline === value;

        return (
          <button
            key={pipeline}
            type="button"
            className="text-left"
            onClick={() => onChange(pipeline)}
            aria-pressed={isActive}
          >
            <Card
              className={cn(
                'group flex h-full transform-gpu flex-col gap-3 border-border bg-card p-5 transition-all duration-150 ease-out hover:-translate-y-1 hover:border-primary/50 hover:shadow-md',
                isActive ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/30' : ''
              )}
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-primary/10">
                <Icon className={cn('size-8 text-muted-foreground transition-colors', isActive ? 'text-primary' : 'group-hover:text-primary')} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{metadata.label}</span>
                  <span className={cn('size-2 rounded-full bg-muted-foreground/30', isActive ? 'bg-primary' : '')} />
                </div>
                <p className="text-sm text-muted-foreground">{metadata.description}</p>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { Badge } from '@/components/ui/badge';

interface PresetDiffViewProps {
  presetA: Record<string, unknown>;
  presetB: Record<string, unknown>;
}

type DiffKind = 'added' | 'changed' | 'removed' | 'same';

function formatValue(value: unknown): string {
  if (value === undefined) {
    return '—';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

function getDiffKind(left: unknown, right: unknown): DiffKind {
  if (left === undefined) {
    return 'added';
  }

  if (right === undefined) {
    return 'removed';
  }

  return JSON.stringify(left) === JSON.stringify(right) ? 'same' : 'changed';
}

function diffClassName(kind: DiffKind): string {
  switch (kind) {
    case 'added':
      return 'border-emerald-500/40 bg-emerald-500/10';
    case 'removed':
      return 'border-destructive/40 bg-destructive/10';
    case 'changed':
      return 'border-amber-500/40 bg-amber-500/10';
    default:
      return 'border-border/70 bg-card';
  }
}

export function PresetDiffView({ presetA, presetB }: PresetDiffViewProps) {
  const keys = Array.from(new Set([...Object.keys(presetA), ...Object.keys(presetB)])).sort();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge className="bg-emerald-500/10 text-emerald-700">Added</Badge>
        <Badge className="bg-destructive/10 text-destructive">Removed</Badge>
        <Badge className="bg-amber-500/10 text-amber-700">Changed</Badge>
      </div>
      <div className="grid gap-2">
        {keys.map((key) => {
          const kind = getDiffKind(presetA[key], presetB[key]);

          return (
            <div
              key={key}
              className={`grid gap-3 rounded-xl border p-3 text-sm md:grid-cols-[12rem_1fr_1fr] ${diffClassName(kind)}`}
            >
              <div className="font-medium text-foreground">{key}</div>
              <div className="break-all text-muted-foreground">{formatValue(presetA[key])}</div>
              <div className="break-all text-foreground">{formatValue(presetB[key])}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

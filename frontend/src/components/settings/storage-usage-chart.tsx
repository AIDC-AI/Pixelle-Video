'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type RechartsModule = typeof import('recharts');

export interface StoragePathLike {
  key: string;
  total_size_bytes: number;
}

export interface StorageUsageSlice {
  bytes: number;
  color: string;
  label: string;
  type: string;
}

interface StorageUsageChartProps {
  className?: string;
  data: StorageUsageSlice[];
}

const STORAGE_COLORS: Record<string, string> = {
  video: '#38bdf8',
  image: '#34d399',
  script: '#f59e0b',
  voice: '#a78bfa',
  bgm: '#f472b6',
  other: '#94a3b8',
};

function getStorageType(key: string): string {
  switch (key) {
    case 'output':
    case 'videos':
      return 'video';
    case 'uploads':
    case 'images':
      return 'image';
    case 'temp':
    case 'scripts':
      return 'script';
    case 'voices':
    case 'voice':
    case 'audio':
      return 'voice';
    case 'bgm':
    case 'bgms':
    case 'music':
      return 'bgm';
    default:
      return 'other';
  }
}

function getStorageLabel(type: string): string {
  switch (type) {
    case 'video':
      return 'Video';
    case 'image':
      return 'Image';
    case 'script':
      return 'Scripts';
    case 'voice':
      return 'Voice';
    case 'bgm':
      return 'BGM';
    default:
      return 'Other';
  }
}

function formatBytes(value: number): string {
  if (value === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function buildStorageUsageSlices(paths: StoragePathLike[]): StorageUsageSlice[] {
  const totals = paths.reduce<Record<string, number>>((accumulator, path) => {
    const type = getStorageType(path.key);
    return {
      ...accumulator,
      [type]: (accumulator[type] ?? 0) + Math.max(0, path.total_size_bytes),
    };
  }, {});

  return Object.entries(totals)
    .filter(([, bytes]) => bytes > 0)
    .map(([type, bytes]) => ({
      bytes,
      color: STORAGE_COLORS[type] ?? STORAGE_COLORS.other,
      label: getStorageLabel(type),
      type,
    }));
}

export function StorageUsageChart({ className, data }: StorageUsageChartProps) {
  const [charts, setCharts] = useState<RechartsModule | null>(null);
  const totalBytes = data.reduce((sum, slice) => sum + slice.bytes, 0);

  useEffect(() => {
    let cancelled = false;

    void import('recharts').then((module) => {
      if (!cancelled) {
        setCharts(module);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (data.length === 0 || totalBytes === 0) {
    return (
      <div className={cn('rounded-2xl border border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground', className)}>
        No storage usage yet.
      </div>
    );
  }

  const ResponsiveContainer = charts?.ResponsiveContainer;
  const PieChart = charts?.PieChart;
  const Pie = charts?.Pie;
  const Cell = charts?.Cell;
  const Tooltip = charts?.Tooltip;

  return (
    <div className={cn('grid gap-4 rounded-2xl border border-border/70 bg-muted/10 p-4 md:grid-cols-[220px_1fr]', className)}>
      <div className="h-[180px]" aria-label="Storage usage chart">
        {ResponsiveContainer && PieChart && Pie && Cell && Tooltip ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="bytes" nameKey="label" innerRadius={48} outerRadius={72} paddingAngle={3}>
                {data.map((slice) => (
                  <Cell key={slice.type} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatBytes(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading storage chart...
          </div>
        )}
      </div>
      <div className="space-y-3">
        {data.map((slice) => (
          <div key={slice.type} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">{slice.label}</span>
            </div>
            <span className="font-mono text-sm text-muted-foreground">{formatBytes(slice.bytes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

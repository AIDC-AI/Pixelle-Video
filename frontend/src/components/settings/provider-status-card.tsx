'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Clock3, Pencil, PlugZap, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type ProviderConnectionStatus = 'valid' | 'invalid' | 'unknown' | 'checking';

interface ProviderStatusCardProps {
  description?: string;
  editLabel?: string;
  expanded?: boolean;
  logo?: ReactNode;
  maskedKey: string;
  name: string;
  onEdit: () => void;
  onTest: () => void;
  status: ProviderConnectionStatus;
  testLabel?: string;
}

const STATUS_COPY: Record<ProviderConnectionStatus, string> = {
  valid: 'Verified',
  invalid: 'Error',
  unknown: 'Unknown',
  checking: 'Checking',
};

const STATUS_CLASS_NAME: Record<ProviderConnectionStatus, string> = {
  valid: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  invalid: 'border-destructive/40 bg-destructive/10 text-destructive',
  unknown: 'border-border bg-muted text-muted-foreground',
  checking: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
};

function StatusIcon({ status }: { status: ProviderConnectionStatus }) {
  if (status === 'valid') {
    return <CheckCircle2 className="size-3.5" aria-hidden="true" />;
  }

  if (status === 'invalid') {
    return <XCircle className="size-3.5" aria-hidden="true" />;
  }

  return <Clock3 className="size-3.5" aria-hidden="true" />;
}

export function ProviderStatusCard({
  description,
  editLabel,
  expanded = false,
  logo,
  maskedKey,
  name,
  onEdit,
  onTest,
  status,
  testLabel = 'Test Connection',
}: ProviderStatusCardProps) {
  const resolvedEditLabel = editLabel ?? (expanded ? 'Hide Fields' : 'Edit');

  return (
    <Card className="border-border/70 bg-card shadow-none">
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/20 text-muted-foreground">
            {logo ?? <PlugZap className="size-5" aria-hidden="true" />}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{name}</h3>
              <Badge
                variant="outline"
                className={cn('gap-1.5 rounded-full px-2 py-0.5', STATUS_CLASS_NAME[status], {
                  'animate-pulse': status === 'checking',
                })}
              >
                <StatusIcon status={status} />
                {STATUS_COPY[status]}
              </Badge>
            </div>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            <p className="font-mono text-xs text-muted-foreground" aria-label={`${name} masked key`}>
              {maskedKey}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Button type="button" variant="outline" onClick={onTest} disabled={status === 'checking'}>
            {testLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onEdit} aria-expanded={expanded}>
            <Pencil className="size-4" aria-hidden="true" />
            {resolvedEditLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

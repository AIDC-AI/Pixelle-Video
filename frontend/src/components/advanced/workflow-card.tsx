'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type WorkflowInfo = components['schemas']['WorkflowInfo'];

function workflowSourceLabel(source: string): string {
  if (source === 'selfhost') {
    return 'Self-host';
  }

  if (source === 'runninghub') {
    return 'RunningHub';
  }

  return source;
}

interface WorkflowCardProps {
  workflow: WorkflowInfo;
}

export function WorkflowCard({ workflow }: WorkflowCardProps) {
  return (
    <Card className="border-border/70 bg-card shadow-none transition-all duration-150 ease-out hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline">{workflowSourceLabel(workflow.source)}</Badge>
          <Badge variant="outline">{workflow.name.startsWith('tts_') ? 'TTS' : 'Media'}</Badge>
        </div>
        <CardTitle className="line-clamp-2 text-lg">{workflow.display_name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="line-clamp-2 text-sm text-muted-foreground">{workflow.path}</p>
        <Link
          href={`/workflows/${encodeURIComponent(workflow.key)}`}
          className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
        >
          View Details
        </Link>
      </CardContent>
    </Card>
  );
}

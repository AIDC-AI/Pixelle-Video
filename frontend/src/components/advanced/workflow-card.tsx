'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { useAppTranslations } from '@/lib/i18n';
import {
  getWorkflowCategoryLabel,
  getWorkflowDescription,
  getWorkflowDisplayName,
  getWorkflowSourceLabel,
  getWorkflowTagLabels,
} from '@/lib/resource-display';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type WorkflowInfo = components['schemas']['WorkflowInfo'];

interface WorkflowCardProps {
  workflow: WorkflowInfo;
}

export function WorkflowCard({ workflow }: WorkflowCardProps) {
  const t = useAppTranslations('workflows');
  const sourceLabel = getWorkflowSourceLabel(workflow);
  const categoryLabel = getWorkflowCategoryLabel(workflow);
  const title = getWorkflowDisplayName(workflow);
  const description = getWorkflowDescription(workflow);
  const tags = getWorkflowTagLabels(workflow).slice(0, 3);

  return (
    <Card className="border-border/70 bg-card shadow-none transition-all duration-150 ease-out hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline">{sourceLabel}</Badge>
          <Badge variant="outline">{categoryLabel}</Badge>
        </div>
        <CardTitle className="line-clamp-2 text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="line-clamp-3 text-sm text-muted-foreground">{description}</p>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
        <Link
          href={`/workflows/${encodeURIComponent(workflow.key)}`}
          className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
        >
          {t('card.viewDetails')}
        </Link>
      </CardContent>
    </Card>
  );
}

'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { LayoutTemplate } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LibraryGrid } from '@/components/library/library-grid';
import { useTemplates } from '@/lib/hooks/use-resources';
import { useTaskList } from '@/lib/hooks/use-task-list';
import { cn } from '@/lib/utils';
import { useAppTranslations } from '@/lib/i18n';
import type { components } from '@/types/api';

type TemplateInfo = components['schemas']['TemplateInfo'];
type TemplatePipeline = 'action-transfer' | 'all' | 'custom' | 'digital-human' | 'i2v' | 'quick';

const TEMPLATE_PIPELINES: Array<{ label: string; value: TemplatePipeline }> = [
  { label: 'All', value: 'all' },
  { label: 'Quick', value: 'quick' },
  { label: 'Digital Human', value: 'digital-human' },
  { label: 'I2V', value: 'i2v' },
  { label: '舞蹈复刻', value: 'action-transfer' },
  { label: 'Custom', value: 'custom' },
];

function inferTemplatePipeline(template: TemplateInfo): Exclude<TemplatePipeline, 'all'> {
  const key = `${template.key} ${template.name} ${template.display_name}`.toLowerCase();

  if (key.includes('digital')) {
    return 'digital-human';
  }

  if (key.includes('i2v') || key.includes('image')) {
    return 'i2v';
  }

  if (key.includes('action') || key.includes('pose')) {
    return 'action-transfer';
  }

  if (key.includes('custom')) {
    return 'custom';
  }

  return 'quick';
}

export default function TemplatesPage() {
  const t = useAppTranslations('templates');
  const common = useAppTranslations('common');
  const templatesQuery = useTemplates();
  const tasksQuery = useTaskList({ limit: 1000, projectFilter: 'all' });
  const [activePipeline, setActivePipeline] = useState<TemplatePipeline>('all');
  const [search, setSearch] = useState('');
  const templates = templatesQuery.data?.templates ?? [];
  const usageCounts = useMemo(() => {
    const counts = new Map<string, number>();

    (tasksQuery.data ?? []).forEach((task) => {
      const templateKey = (task.request_params as Record<string, unknown> | null | undefined)?.frame_template;
      if (typeof templateKey === 'string') {
        counts.set(templateKey, (counts.get(templateKey) ?? 0) + 1);
      }
    });

    return counts;
  }, [tasksQuery.data]);
  const filteredTemplates = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return templates.filter((template) => {
      const pipelineMatches =
        activePipeline === 'all' || inferTemplatePipeline(template) === activePipeline;
      const searchMatches =
        !normalizedSearch ||
        `${template.key} ${template.display_name} ${template.name}`.toLowerCase().includes(normalizedSearch);

      return pipelineMatches && searchMatches;
    });
  }, [activePipeline, search, templates]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_PIPELINES.map((pipeline) => (
            <Button
              key={pipeline.value}
              type="button"
              variant={activePipeline === pipeline.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActivePipeline(pipeline.value)}
            >
              {pipeline.label}
            </Button>
          ))}
        </div>
        <Input
          aria-label="Search templates"
          placeholder="Search templates..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {templatesQuery.isLoading ? (
        <LibraryGrid className="xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`template-skeleton-${index}`} className="h-48 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          ))}
        </LibraryGrid>
      ) : null}

      {!templatesQuery.isLoading && filteredTemplates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : null}

      {!templatesQuery.isLoading && filteredTemplates.length > 0 ? (
        <LibraryGrid className="xl:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.key} className="border-border/70 bg-card shadow-none">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{template.orientation}</Badge>
                  <Badge variant="outline">{template.size}</Badge>
                  <Badge variant="secondary">{usageCounts.get(template.key) ?? 0} uses</Badge>
                </div>
                <CardTitle className="line-clamp-2 text-lg">{template.display_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('resolutionDescription', { width: template.width, height: template.height })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('templateFile', { file: template.path })}
                </p>
                <Link
                  href={`/create/quick?${new URLSearchParams({ frame_template: template.key }).toString()}`}
                  className={cn(buttonVariants(), 'w-full')}
                >
                  {common('useInQuick')}
                </Link>
              </CardContent>
            </Card>
          ))}
        </LibraryGrid>
      ) : null}
    </div>
  );
}

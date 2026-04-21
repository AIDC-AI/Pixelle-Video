'use client';

import Link from 'next/link';
import React from 'react';
import { LayoutTemplate } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LibraryGrid } from '@/components/library/library-grid';
import { useTemplates } from '@/lib/hooks/use-resources';
import { cn } from '@/lib/utils';

export default function TemplatesPage() {
  const templatesQuery = useTemplates();
  const templates = templatesQuery.data?.templates ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Start from a production-ready frame template. In the current API contract, templates feed the Quick pipeline through `frame_template`.
        </p>
      </div>

      {templatesQuery.isLoading ? (
        <LibraryGrid className="xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`template-skeleton-${index}`} className="h-48 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          ))}
        </LibraryGrid>
      ) : null}

      {!templatesQuery.isLoading && templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates available"
          description="The template catalog is empty."
        />
      ) : null}

      {!templatesQuery.isLoading && templates.length > 0 ? (
        <LibraryGrid className="xl:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.key} className="border-border/70 bg-card shadow-none">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{template.orientation}</Badge>
                  <Badge variant="outline">{template.size}</Badge>
                </div>
                <CardTitle className="line-clamp-2 text-lg">{template.display_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {template.width} × {template.height} · {template.path}
                </p>
                <Link
                  href={`/create/quick?${new URLSearchParams({ frame_template: template.key }).toString()}`}
                  className={cn(buttonVariants(), 'w-full')}
                >
                  Use in Quick
                </Link>
              </CardContent>
            </Card>
          ))}
        </LibraryGrid>
      ) : null}
    </div>
  );
}

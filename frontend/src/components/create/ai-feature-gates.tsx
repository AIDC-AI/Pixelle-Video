'use client';

import { Sparkles } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAiFeatures } from '@/lib/hooks/use-ai-features';
import { cn } from '@/lib/utils';

export function AiFeatureGates({ className }: { className?: string }) {
  const { previewEnabled, promptAssistEnabled } = useAiFeatures();

  if (!previewEnabled && !promptAssistEnabled) {
    return null;
  }

  return (
    <Card className={cn('border-dashed border-primary/40 bg-primary/5 shadow-none', className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="size-4 text-primary" />
          AI features are enabled
        </div>
        {previewEnabled ? (
          <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-sm">
            <p className="font-medium text-foreground">Real-time preview</p>
            <p className="mt-1 text-muted-foreground">Backend is not ready yet. Preview will appear here when shipped.</p>
          </div>
        ) : null}
        {promptAssistEnabled ? (
          <Button type="button" variant="outline" disabled>
            AI rewrite unavailable until backend ships
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

'use client';

import { AlertTriangle, LifeBuoy, RotateCcw } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  description?: string;
  error?: Error;
  onRetry?: () => void;
  retryLabel?: string;
  title: string;
  variant: 'inline' | 'card' | 'page';
}

export function ErrorState({
  description,
  error,
  onRetry,
  retryLabel = 'Retry',
  title,
  variant,
}: ErrorStateProps) {
  if (variant === 'inline') {
    return (
      <div className="border-b border-destructive/50 pb-2 text-xs text-destructive">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span>{title}</span>
        </div>
        {description ? <p className="mt-1 pl-5 text-destructive/90">{description}</p> : null}
      </div>
    );
  }

  const isPage = variant === 'page';

  return (
    <Card
      role="alert"
      className={cn(
        'border-border/70 bg-card shadow-none',
        isPage ? 'mx-auto max-w-2xl text-center' : 'border-l-4 border-l-destructive'
      )}
    >
      <CardHeader className={cn(isPage ? 'items-center justify-center gap-4 pb-2' : 'gap-3')}>
        <div className="flex size-14 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-4', isPage ? 'flex flex-col items-center pb-8' : undefined)}>
        <div className={cn('flex flex-wrap gap-2', isPage ? 'justify-center' : undefined)}>
          {onRetry ? (
            <Button type="button" onClick={onRetry}>
              <RotateCcw className="size-4" />
              {retryLabel}
            </Button>
          ) : null}
          {isPage ? (
            <Button type="button" variant="outline">
              <LifeBuoy className="size-4" />
              Contact support
            </Button>
          ) : null}
        </div>

        {error ? (
          <Accordion defaultValue={undefined} className="w-full text-left">
            <AccordionItem value="details">
              <AccordionTrigger>Technical details</AccordionTrigger>
              <AccordionContent>
                <pre className="overflow-x-auto rounded-xl border border-border/70 bg-muted/30 p-4 text-xs leading-5 text-foreground">
                  {error.stack ?? error.message}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}
      </CardContent>
    </Card>
  );
}

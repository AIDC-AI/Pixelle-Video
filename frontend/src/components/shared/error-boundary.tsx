'use client';

import type { ReactNode } from 'react';
import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Shell error boundary caught an error.', error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  public render(): ReactNode {
    const { error } = this.state;
    const copy = {
      backToCreate: '返回创作页',
      details: '查看详情',
      fallbackMessage: '出现了意外的渲染错误，当前视图已被中断。',
      retry: '重试',
      title: '工作台发生错误。',
    };

    if (!error) {
      return this.props.children;
    }

    return (
      <div className="py-8">
        <Card className="border-destructive/30 bg-card shadow-none">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <div className="flex size-11 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <CardTitle>{copy.title}</CardTitle>
                <CardDescription className="mt-1 text-muted-foreground">
                  {error.message || copy.fallbackMessage}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={this.handleRetry}>
                <RotateCcw className="size-4" />
                {copy.retry}
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href="/create" />}>
                <Home className="size-4" />
                {copy.backToCreate}
              </Button>
            </div>

            <Accordion defaultValue={undefined}>
              <AccordionItem value="details">
                <AccordionTrigger>{copy.details}</AccordionTrigger>
                <AccordionContent>
                  <pre className="overflow-x-auto rounded-2xl border border-border/70 bg-muted/20 p-4 text-xs leading-6 text-foreground">
                    {error.stack ?? error.message}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    );
  }
}

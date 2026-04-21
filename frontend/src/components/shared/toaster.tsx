'use client';

import { Toaster } from 'sonner';

export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      duration={4000}
      richColors
      toastOptions={{
        classNames: {
          toast:
            'border border-border/70 bg-card text-foreground shadow-lg border-l-4 border-l-primary',
          error: 'border-l-destructive',
          success: 'border-l-[hsl(var(--success))]',
          info: 'border-l-[hsl(var(--running))]',
          warning: 'border-l-[hsl(var(--pending))]',
          title: 'text-sm font-medium',
          description: 'text-xs text-muted-foreground',
          closeButton:
            'border border-border/70 bg-background text-foreground hover:bg-muted',
        },
      }}
      closeButton
    />
  );
}

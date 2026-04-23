'use client';

import { Toaster } from 'sonner';

export function AppToaster() {
  return (
    <div role="status" aria-live="polite" aria-atomic="false">
      <Toaster
        position="bottom-right"
        duration={4000}
        richColors
        containerAriaLabel="Notifications"
        toastOptions={{
          classNames: {
            toast:
              'border border-border/70 bg-card text-foreground shadow-lg border-l-4 border-l-primary',
            error: 'border-l-destructive',
            success: 'border-l-[hsl(var(--success))]',
            info: 'border-l-[hsl(var(--info))]',
            warning: 'border-l-[hsl(var(--warning))]',
            title: 'text-sm font-medium',
            description: 'text-xs text-muted-foreground',
            closeButton:
              'border border-border/70 bg-background text-foreground hover:bg-muted',
          },
        }}
        closeButton
      />
    </div>
  );
}

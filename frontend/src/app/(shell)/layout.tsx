import React from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { GlobalDropOverlay } from '@/components/shared/global-drop-overlay';
import { SkipNav } from '@/components/shared/skip-nav';

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GlobalDropOverlay>
      <SkipNav />
      <AppShell>{children}</AppShell>
    </GlobalDropOverlay>
  );
}

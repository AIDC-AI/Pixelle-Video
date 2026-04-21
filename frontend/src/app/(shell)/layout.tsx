import React from 'react';
import { AppShell } from '@/components/shell/app-shell';

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}

'use client';

import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { ShortcutHelpDialog } from '@/components/shared/shortcut-help-dialog';
import { EmptyProjectsPrompt } from './empty-projects-prompt';
import { Topbar } from './topbar';
import { Sidebar } from './sidebar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { OPEN_COMMAND_PALETTE_EVENT, OPEN_SHORTCUT_HELP_EVENT } from './command-palette';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useKeyboardShortcuts({
    onOpenCommandPalette: () => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT)),
    onToggleShortcutHelp: () => setShortcutHelpOpen((current) => !current),
    onCloseTopLayer: () => {
      setShortcutHelpOpen(false);
      setSidebarOpen(false);
    },
  });

  useEffect(() => {
    const openShortcutHelp = () => setShortcutHelpOpen(true);
    window.addEventListener(OPEN_SHORTCUT_HELP_EVENT, openShortcutHelp);

    return () => {
      window.removeEventListener(OPEN_SHORTCUT_HELP_EVENT, openShortcutHelp);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <Topbar
        onOpenShortcuts={() => setShortcutHelpOpen(true)}
        onToggleSidebar={() => setSidebarOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <Dialog open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <DialogContent
            showCloseButton={false}
            className="!left-0 !top-0 h-full !max-w-[320px] !translate-x-0 !translate-y-0 !rounded-none border-r border-border/70 p-0 sm:!max-w-[320px]"
          >
            <Sidebar />
          </DialogContent>
        </Dialog>
        <main id="main-content" className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] w-full px-6 py-6 lg:px-8">
            <ErrorBoundary>
              <EmptyProjectsPrompt />
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <ShortcutHelpDialog open={shortcutHelpOpen} onOpenChange={setShortcutHelpOpen} />
    </div>
  );
}

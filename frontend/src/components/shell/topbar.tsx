'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Search, Bell, User, Menu } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { useAppTranslations } from '@/lib/i18n';
import { CommandPalette, OPEN_COMMAND_PALETTE_EVENT } from './command-palette';
import { NotificationCenter } from './notification-center';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { BrandMark } from './brand-mark';

interface TopbarProps {
  onOpenShortcuts?: () => void;
  onToggleSidebar?: () => void;
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const shellT = useAppTranslations('shell');
  const brandT = useAppTranslations('brand') as (key: 'name') => string;
  const { unreadCount } = useNotifications();
  const [mounted, setMounted] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const openCommandPalette = () => setCommandPaletteOpen(true);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, openCommandPalette);

    return () => {
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, openCommandPalette);
    };
  }, []);

  return (
    <header className="flex items-center justify-between px-6 h-14 border-b bg-background">
      <div className="flex items-center gap-3 font-bold text-foreground">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onToggleSidebar}
          aria-label="Open sidebar"
        >
          <Menu className="w-4 h-4" />
        </Button>
        <BrandMark size="sm" />
        <span>{brandT('name')}</span>
      </div>

      <div className="flex-1 flex justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-64 justify-start text-muted-foreground"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="w-3 h-3 mr-2" />
          <span>{shellT('topbar.actions.search')}</span>
          <Kbd className="ml-auto" keys={['⌘', 'K']} />
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          aria-label={shellT('topbar.actions.toggleTheme')}
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {mounted ? (theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />) : <div className="w-4 h-4" />}
          <span className="sr-only">{shellT('topbar.actions.toggleTheme')}</span>
        </Button>
        <Button
          aria-label={shellT('topbar.actions.notifications')}
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          onClick={() => setNotificationCenterOpen(true)}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
          <span className="sr-only">{shellT('topbar.actions.notifications')}</span>
        </Button>
        <Button aria-label={shellT('topbar.actions.userMenu')} variant="ghost" size="icon" className="h-8 w-8">
          <User className="w-4 h-4" />
          <span className="sr-only">{shellT('topbar.actions.userMenu')}</span>
        </Button>
      </div>
      {commandPaletteOpen ? (
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
        />
      ) : null}
      <NotificationCenter open={notificationCenterOpen} onOpenChange={setNotificationCenterOpen} />
    </header>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Search, Bell, User } from 'lucide-react';
import { useAppTranslations } from '@/lib/i18n';
import { BrandMark } from './brand-mark';

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const t = useAppTranslations('shell');
  const brandT = useAppTranslations('brand') as (key: 'name') => string;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="flex items-center justify-between px-6 h-14 border-b bg-background">
      <div className="flex items-center space-x-2 font-bold text-foreground">
        <BrandMark size="sm" />
        <span>{brandT('name')}</span>
      </div>

      <div className="flex-1 flex justify-center">
        <Button variant="outline" size="sm" className="w-64 justify-start text-muted-foreground h-8">
          <Search className="w-3 h-3 mr-2" />
          <span>{t('topbar.actions.search')}</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {mounted ? (theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />) : <div className="w-4 h-4" />}
          <span className="sr-only">{t('topbar.actions.toggleTheme')}</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="w-4 h-4" />
          <span className="sr-only">{t('topbar.actions.notifications')}</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <User className="w-4 h-4" />
          <span className="sr-only">{t('topbar.actions.userMenu')}</span>
        </Button>
      </div>
    </header>
  );
}

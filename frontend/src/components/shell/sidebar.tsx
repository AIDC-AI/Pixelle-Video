'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  User,
  Image as ImageIcon,
  Activity,
  PenTool,
  ListOrdered,
  List,
  Library,
  Mic,
  Music,
  FileText,
  Settings2,
  LayoutTemplate,
  Box,
  Key,
  Palette,
  HardDrive,
  Info,
  ChevronLeft,
  ChevronRight,
  Zap,
  LayoutDashboard,
  PlusCircle,
  Server,
  Cloud,
  Settings
} from 'lucide-react';
import { readSidebarCollapsedPreference, SIDEBAR_PREFERENCE_EVENT, writeSidebarCollapsedPreference } from '@/lib/preferences';
import { cn } from '@/lib/utils';
import { useAppTranslations } from '@/lib/i18n';
import { ProjectSwitcher } from '@/components/shell/project-switcher';

const MENU_GROUPS = [
  {
    groupKey: 'create',
    items: [
      { href: '/create', icon: Sparkles, itemKey: 'createOverview' },
      { href: '/create/quick', icon: Zap, itemKey: 'quick' },
      { href: '/create/digital-human', icon: User, itemKey: 'digitalHuman' },
      { href: '/create/i2v', icon: ImageIcon, itemKey: 'i2v' },
      { href: '/create/action-transfer', icon: Activity, itemKey: 'actionTransfer' },
      { href: '/create/custom', icon: PenTool, itemKey: 'customAsset' },
    ],
  },
  {
    groupKey: 'batch',
    items: [
      { href: '/batch', icon: LayoutDashboard, itemKey: 'batches' },
      { href: '/batch/list', icon: ListOrdered, itemKey: 'allBatches' },
      { href: '/batch/new', icon: PlusCircle, itemKey: 'newBatch' },
      { href: '/batch/queue', icon: List, itemKey: 'taskQueue' },
    ],
  },
  {
    groupKey: 'library',
    items: [
      { href: '/library/videos', icon: Library, itemKey: 'videos' },
      { href: '/library/images', icon: ImageIcon, itemKey: 'images' },
      { href: '/library/voices', icon: Mic, itemKey: 'voices' },
      { href: '/library/bgm', icon: Music, itemKey: 'bgm' },
      { href: '/library/scripts', icon: FileText, itemKey: 'scripts' },
    ],
  },
  {
    groupKey: 'advanced',
    items: [
      { href: '/workflows', icon: Settings2, itemKey: 'workflows' },
      { href: '/workflows/self-host', icon: Server, itemKey: 'selfHost' },
      { href: '/workflows/runninghub', icon: Cloud, itemKey: 'runningHub' },
      { href: '/templates', icon: LayoutTemplate, itemKey: 'templates' },
      { href: '/presets', icon: Box, itemKey: 'modelPresets' },
    ],
  },
  {
    groupKey: 'system',
    items: [
      { href: '/settings', icon: Settings, itemKey: 'settingsOverview' },
      { href: '/settings/keys', icon: Key, itemKey: 'apiKeys' },
      { href: '/settings/appearance', icon: Palette, itemKey: 'appearance' },
      { href: '/settings/storage', icon: HardDrive, itemKey: 'storage' },
      { href: '/settings/about', icon: Info, itemKey: 'about' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const t = useAppTranslations('shell');

  useEffect(() => {
    const syncPreference = () => {
      setIsCollapsed(readSidebarCollapsedPreference());
    };

    syncPreference();
    window.addEventListener(SIDEBAR_PREFERENCE_EVENT, syncPreference as EventListener);
    return () => window.removeEventListener(SIDEBAR_PREFERENCE_EVENT, syncPreference as EventListener);
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    writeSidebarCollapsedPreference(nextState);
  };

  const allItems = MENU_GROUPS.flatMap(g => g.items);
  const activeHref = allItems
    .filter(item => pathname === item.href || pathname.startsWith(item.href + '/'))
    .reduce((longest, current) => current.href.length > longest.href.length ? current : longest, { href: '' }).href;

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card/50 backdrop-blur-sm transition-all duration-150 ease-out",
        isCollapsed ? "w-16" : "w-[260px]"
      )}
    >
      <div className="flex flex-col flex-1 py-6 overflow-y-auto overflow-x-hidden">
        <ProjectSwitcher isCollapsed={isCollapsed} />
        {MENU_GROUPS.map((group, i) => (
          <div key={i} className="mb-8 px-4">
            {!isCollapsed && (
              <h4 className="px-2 mb-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                {t(`sidebar.groups.${group.groupKey}` as Parameters<typeof t>[0])}
              </h4>
            )}
            <nav className="flex flex-col gap-2">
              {group.items.map((item) => {
                const isActive = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      isCollapsed && "justify-center"
                    )}
                    title={isCollapsed ? t(`sidebar.items.${item.itemKey}` as Parameters<typeof t>[0]) : undefined}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>{t(`sidebar.items.${item.itemKey}` as Parameters<typeof t>[0])}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <button
          onClick={toggleCollapse}
          className="flex w-full items-center justify-center p-2 rounded-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          title={isCollapsed ? t('sidebar.actions.expand') : t('sidebar.actions.collapse')}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}

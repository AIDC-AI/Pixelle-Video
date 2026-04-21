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
  ChevronRight
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MENU_GROUPS = [
  {
    label: 'Create',
    items: [
      { href: '/create/quick', icon: Sparkles, label: 'Quick Create' },
      { href: '/create/digital-human', icon: User, label: 'Digital Human' },
      { href: '/create/i2v', icon: ImageIcon, label: 'Image -> Video' },
      { href: '/create/action-transfer', icon: Activity, label: 'Action Transfer' },
      { href: '/create/custom', icon: PenTool, label: 'Custom Asset' },
    ],
  },
  {
    label: 'Batch',
    items: [
      { href: '/batch', icon: ListOrdered, label: 'Batches' },
      { href: '/batch/queue', icon: List, label: 'Task Queue' },
    ],
  },
  {
    label: 'Library',
    items: [
      { href: '/library/videos', icon: Library, label: 'Videos' },
      { href: '/library/images', icon: ImageIcon, label: 'Images' },
      { href: '/library/voices', icon: Mic, label: 'Voices' },
      { href: '/library/bgm', icon: Music, label: 'BGM' },
      { href: '/library/scripts', icon: FileText, label: 'Scripts' },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { href: '/workflows', icon: Settings2, label: 'Workflows' },
      { href: '/templates', icon: LayoutTemplate, label: 'Templates' },
      { href: '/presets', icon: Box, label: 'Presets' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings/keys', icon: Key, label: 'API Keys' },
      { href: '/settings/appearance', icon: Palette, label: 'Appearance' },
      { href: '/settings/storage', icon: HardDrive, label: 'Storage' },
      { href: '/settings/about', icon: Info, label: 'About' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sidebar-collapsed', String(nextState));
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-150 ease-out",
        isCollapsed ? "w-16" : "w-[260px]"
      )}
    >
      <div className="flex flex-col flex-1 py-4 overflow-y-auto overflow-x-hidden">
        {MENU_GROUPS.map((group, i) => (
          <div key={i} className="mb-6 px-3">
            {!isCollapsed && (
              <h4 className="px-3 mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                {group.label}
              </h4>
            )}
            <nav className="flex flex-col gap-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      isCollapsed && "justify-center"
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
      <div className="p-3 border-t">
        <button
          onClick={toggleCollapse}
          className="flex w-full items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}

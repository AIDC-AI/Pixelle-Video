'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  FileText,
  FolderKanban,
  HardDrive,
  Image as ImageIcon,
  Info,
  Key,
  LayoutDashboard,
  LayoutTemplate,
  Library,
  List,
  ListOrdered,
  Mic,
  Music,
  Palette,
  PenTool,
  PlusCircle,
  Server,
  Settings,
  Settings2,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';

import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useProjects } from '@/lib/hooks/use-projects';
import { useAppTranslations } from '@/lib/i18n';
import {
  readSidebarCollapsedPreference,
  readSidebarExpandedGroupPreference,
  SIDEBAR_PREFERENCE_EVENT,
  type SidebarExpandedGroupPreference,
  writeSidebarCollapsedPreference,
  writeSidebarExpandedGroupPreference,
} from '@/lib/preferences';
import { cn } from '@/lib/utils';

export type NavItem = {
  href: string;
  icon: typeof Sparkles;
  itemKey: string;
};

export type NavGroup = {
  groupKey: Exclude<SidebarExpandedGroupPreference, 'projects'>;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
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
      { href: '/settings/usage', icon: BarChart3, itemKey: 'usage' },
      { href: '/settings/storage', icon: HardDrive, itemKey: 'storage' },
      { href: '/settings/about', icon: Info, itemKey: 'about' },
    ],
  },
];

const DEFAULT_EXPANDED_GROUPS: SidebarExpandedGroupPreference[] = ['projects'];

function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getCreateHref(pipelineHint?: string | null): string {
  switch (pipelineHint) {
    case 'quick':
      return '/create/quick';
    case 'digital-human':
      return '/create/digital-human';
    case 'i2v':
      return '/create/i2v';
    case 'action-transfer':
      return '/create/action-transfer';
    case 'custom':
      return '/create/custom';
    default:
      return '/create';
  }
}

function SidebarItem({
  active,
  collapsed,
  href,
  icon: Icon,
  label,
}: {
  active: boolean;
  collapsed: boolean;
  href: string;
  icon: typeof Sparkles;
  label: string;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        collapsed ? 'justify-center px-2' : undefined
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className={collapsed ? 'sr-only' : undefined}>{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const t = useAppTranslations('shell');
  const { currentProject, currentProjectId } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<SidebarExpandedGroupPreference[]>(DEFAULT_EXPANDED_GROUPS);

  useEffect(() => {
    const syncPreference = () => {
      setIsCollapsed(readSidebarCollapsedPreference());
      const storedGroups = readSidebarExpandedGroupPreference();
      setExpandedGroups(storedGroups.length > 0 ? storedGroups : DEFAULT_EXPANDED_GROUPS);
    };

    syncPreference();
    window.addEventListener(SIDEBAR_PREFERENCE_EVENT, syncPreference as EventListener);

    return () => {
      window.removeEventListener(SIDEBAR_PREFERENCE_EVENT, syncPreference as EventListener);
    };
  }, []);

  const projects = useMemo(
    () =>
      [...(projectsData?.items ?? [])]
        .sort((left, right) => (right.updated_at ?? '').localeCompare(left.updated_at ?? ''))
        .slice(0, 3),
    [projectsData?.items]
  );

  const toggleCollapse = () => {
    const nextValue = !isCollapsed;
    setIsCollapsed(nextValue);
    writeSidebarCollapsedPreference(nextValue);
  };

  const toggleGroup = (group: SidebarExpandedGroupPreference) => {
    const nextGroups = expandedGroups.includes(group)
      ? expandedGroups.filter((item) => item !== group)
      : [...expandedGroups, group];
    setExpandedGroups(nextGroups);
    writeSidebarExpandedGroupPreference(nextGroups);
  };

  const isExpanded = (group: SidebarExpandedGroupPreference) => !isCollapsed && expandedGroups.includes(group);
  const continueHref = getCreateHref(currentProject?.pipeline_hint);

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border/70 bg-card/50 backdrop-blur-sm transition-[width] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
        isCollapsed ? 'w-16' : 'w-[280px]'
      )}
    >
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div>
          <div>
            {!isCollapsed ? (
              <button
                type="button"
                aria-expanded={isExpanded('projects')}
                aria-label={t(
                  isExpanded('projects') ? 'sidebar.actions.collapseGroup' : 'sidebar.actions.expandGroup',
                  { group: t('sidebar.groups.projects') }
                )}
                className="flex w-full items-center justify-between gap-2 px-1 text-left"
                onClick={() => toggleGroup('projects')}
              >
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {t('sidebar.groups.projects')}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {currentProject?.name ?? t('projectSwitcher.selectProject')}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'size-4 text-muted-foreground transition-transform',
                    isExpanded('projects') ? 'rotate-0' : '-rotate-90'
                  )}
                />
              </button>
            ) : (
              <div className="flex justify-center">
                <FolderKanban className="size-5 text-muted-foreground" />
              </div>
            )}

            {isExpanded('projects') ? (
              <div className="mt-3 space-y-3">
                <SidebarItem
                  active={isLinkActive(pathname, '/projects')}
                  collapsed={false}
                  href="/projects"
                  icon={FolderKanban}
                  label={t('sidebar.items.projectsOverview')}
                />
                <div className="space-y-2 px-1">
                  <p className="text-xs font-medium text-muted-foreground">{t('sidebar.projects.recent')}</p>
                  <div className="space-y-1">
                    {projects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className={cn(
                          'block truncate rounded-md px-2 py-1.5 text-sm transition-colors',
                          project.id === currentProjectId
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        )}
                      >
                        {project.name}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 px-1">
                  <Link
                    href="/projects?create=1"
                    className="rounded-md border border-border/70 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    {t('sidebar.projects.new')}
                  </Link>
                  <Link
                    href={continueHref}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    {t('sidebar.projects.continueCreate')}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {NAV_GROUPS.map((group) => {
            const expanded = isExpanded(group.groupKey);
            const groupLabel = t(`sidebar.groups.${group.groupKey}` as Parameters<typeof t>[0]);

            return (
              <div key={group.groupKey} className="mt-6">
                {!isCollapsed ? (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={t(
                      expanded ? 'sidebar.actions.collapseGroup' : 'sidebar.actions.expandGroup',
                      { group: groupLabel }
                    )}
                    className="flex w-full items-center justify-between gap-2 px-1 text-left"
                    onClick={() => toggleGroup(group.groupKey)}
                  >
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {groupLabel}
                    </span>
                    <ChevronDown
                      className={cn(
                        'size-4 text-muted-foreground transition-transform',
                        expanded ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                  </button>
                ) : (
                  <p className="sr-only">{groupLabel}</p>
                )}

                {(expanded || isCollapsed) ? (
                  <nav className={cn('mt-2 flex flex-col gap-1', isCollapsed ? 'mt-0' : undefined)}>
                    {group.items.map((item) => (
                      <SidebarItem
                        key={item.href}
                        active={isLinkActive(pathname, item.href)}
                        collapsed={isCollapsed}
                        href={item.href}
                        icon={item.icon}
                        label={t(`sidebar.items.${item.itemKey}` as Parameters<typeof t>[0])}
                      />
                    ))}
                  </nav>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border/70 p-3">
        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={t(isCollapsed ? 'sidebar.actions.expand' : 'sidebar.actions.collapse')}
          title={t(isCollapsed ? 'sidebar.actions.expand' : 'sidebar.actions.collapse')}
          className="flex w-full items-center justify-center rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>
    </aside>
  );
}

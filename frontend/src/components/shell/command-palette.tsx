'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Check,
  Moon,
  Search,
  Settings2,
  Sun,
  SunMoon,
  Type,
  type LucideIcon,
} from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { NAV_GROUPS, type NavItem } from '@/components/shell/sidebar';
import { useProjects } from '@/lib/hooks/use-projects';
import { useAppTranslations } from '@/lib/i18n';
import { addRecentCommand, getRecentCommands, type RecentCommand } from '@/lib/recent-commands';
import { useCurrentProjectStore } from '@/stores/current-project';
import type { components } from '@/types/api';

export const OPEN_COMMAND_PALETTE_EVENT = 'pixelle:open-command-palette';
export const OPEN_SHORTCUT_HELP_EVENT = 'pixelle:open-shortcut-help';

type Project = components['schemas']['Project'];
type PaletteMode = 'pages' | 'commands' | 'projects';

interface CommandPaletteProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

interface PageCommand {
  groupKey: string;
  item: NavItem;
  label: string;
  shortcut?: string[];
}

interface ActionCommand {
  icon: LucideIcon;
  id: string;
  label: string;
  run: () => void;
  value: string;
}

const PAGE_SHORTCUTS: Record<string, string[]> = {
  '/create': ['G', 'C'],
  '/batch': ['G', 'B'],
  '/library/videos': ['G', 'L'],
  '/workflows': ['G', 'W'],
  '/settings': ['G', 'S'],
};

function getPaletteMode(query: string): PaletteMode {
  const trimmedQuery = query.trimStart();
  if (trimmedQuery.startsWith('>')) {
    return 'commands';
  }
  if (trimmedQuery.startsWith('@')) {
    return 'projects';
  }
  return 'pages';
}

function getProjectScope(projectId: string | null): string {
  return projectId ?? 'global';
}

function withTimestamp(command: Omit<RecentCommand, 'timestamp'>): RecentCommand {
  return { ...command, timestamp: Date.now() };
}

function getRecentIcon(type: RecentCommand['type']): LucideIcon {
  if (type === 'command') {
    return Settings2;
  }
  if (type === 'project') {
    return Type;
  }
  return Search;
}

export function CommandPalette({ onOpenChange, open }: CommandPaletteProps) {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const t = useAppTranslations('shell');
  const { data: projectsData } = useProjects();
  const currentProjectId = useCurrentProjectStore((state) => state.currentProjectId);
  const setCurrentProjectId = useCurrentProjectStore((state) => state.setCurrentProjectId);
  const [query, setQuery] = useState('');
  const [recentCommands, setRecentCommands] = useState<RecentCommand[]>([]);

  const projectScope = getProjectScope(currentProjectId);

  const pageGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        groupKey: group.groupKey,
        groupLabel: t(`sidebar.groups.${group.groupKey}` as Parameters<typeof t>[0]),
        pages: group.items.map<PageCommand>((item) => ({
          groupKey: group.groupKey,
          item,
          label: t(`sidebar.items.${item.itemKey}` as Parameters<typeof t>[0]),
          shortcut: PAGE_SHORTCUTS[item.href],
        })),
      })),
    [t]
  );

  const actionCommands = useMemo<ActionCommand[]>(
    () => [
      {
        id: 'theme-light',
        icon: Sun,
        label: t('commandPalette.commands.themeLight' as Parameters<typeof t>[0]),
        value: '> theme light',
        run: () => setTheme('light'),
      },
      {
        id: 'theme-dark',
        icon: Moon,
        label: t('commandPalette.commands.themeDark' as Parameters<typeof t>[0]),
        value: '> theme dark',
        run: () => setTheme('dark'),
      },
      {
        id: 'theme-system',
        icon: SunMoon,
        label: t('commandPalette.commands.themeSystem' as Parameters<typeof t>[0]),
        value: '> theme system',
        run: () => setTheme('system'),
      },
      {
        id: 'shortcut-help',
        icon: Type,
        label: t('commandPalette.commands.shortcutHelp' as Parameters<typeof t>[0]),
        value: '> keyboard shortcuts help',
        run: () => window.dispatchEvent(new Event(OPEN_SHORTCUT_HELP_EVENT)),
      },
    ],
    [setTheme, t]
  );

  useEffect(() => {
    if (open) {
      setRecentCommands(getRecentCommands(projectScope));
      return;
    }

    setQuery('');
  }, [open, projectScope]);

  const mode = getPaletteMode(query);
  const projects = projectsData?.items ?? [];

  const closePalette = () => onOpenChange(false);

  const rememberCommand = (command: Omit<RecentCommand, 'timestamp'>) => {
    const recentCommand = withTimestamp(command);
    addRecentCommand(projectScope, recentCommand);
    setRecentCommands(getRecentCommands(projectScope));
  };

  const selectPage = (page: PageCommand) => {
    rememberCommand({ type: 'page', label: page.label, value: page.item.href });
    router.push(page.item.href);
    closePalette();
  };

  const selectAction = (command: ActionCommand) => {
    command.run();
    rememberCommand({ type: 'command', label: command.label, value: command.id });
    closePalette();
  };

  const selectProject = (project: Project) => {
    setCurrentProjectId(project.id);
    rememberCommand({ type: 'project', label: project.name, value: project.id });
    closePalette();
  };

  const selectRecent = (command: RecentCommand) => {
    if (command.type === 'page') {
      router.push(command.value);
      rememberCommand({ type: command.type, label: command.label, value: command.value });
      closePalette();
      return;
    }

    if (command.type === 'project') {
      setCurrentProjectId(command.value);
      rememberCommand({ type: command.type, label: command.label, value: command.value });
      closePalette();
      return;
    }

    const action = actionCommands.find((item) => item.id === command.value);
    if (action) {
      selectAction(action);
    }
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      label={t('commandPalette.label' as Parameters<typeof t>[0])}
      loop
    >
      <div className="relative border-b border-border/70">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <CommandInput
          value={query}
          onValueChange={setQuery}
          autoFocus
          placeholder={t('commandPalette.placeholder' as Parameters<typeof t>[0])}
        />
        <Kbd
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
          keys={['Esc']}
        />
      </div>
      <CommandList>
        <CommandEmpty>{t('commandPalette.empty' as Parameters<typeof t>[0])}</CommandEmpty>

        {mode === 'pages' && recentCommands.length > 0 ? (
          <CommandGroup heading={t('commandPalette.groups.recent' as Parameters<typeof t>[0])}>
            {recentCommands.map((command) => {
              const Icon = getRecentIcon(command.type);
              return (
                <CommandItem
                  key={`${command.type}-${command.value}`}
                  value={`${command.label} ${command.value}`}
                  onSelect={() => selectRecent(command)}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="truncate">{command.label}</span>
                  <CommandShortcut>{t(`commandPalette.types.${command.type}` as Parameters<typeof t>[0])}</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}

        {mode === 'pages'
          ? pageGroups.map((group) => (
              <CommandGroup key={group.groupKey} heading={group.groupLabel}>
                {group.pages.map((page) => {
                  const Icon = page.item.icon;
                  return (
                    <CommandItem
                      key={page.item.href}
                      value={`${page.label} ${page.item.href}`}
                      keywords={[page.groupKey, page.item.itemKey]}
                      onSelect={() => selectPage(page)}
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="truncate">{page.label}</span>
                      {page.shortcut ? <Kbd className="ml-auto" keys={page.shortcut} /> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))
          : null}

        {mode === 'commands' ? (
          <CommandGroup heading={t('commandPalette.groups.commands' as Parameters<typeof t>[0])}>
            {actionCommands.map((command) => {
              const Icon = command.icon;
              const checked =
                (command.id === 'theme-light' && theme === 'light') ||
                (command.id === 'theme-dark' && theme === 'dark') ||
                (command.id === 'theme-system' && theme === 'system');

              return (
                <CommandItem key={command.id} value={command.value} onSelect={() => selectAction(command)}>
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="truncate">{command.label}</span>
                  {checked ? <Check className="ml-auto size-4 text-primary" /> : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}

        {mode === 'projects' ? (
          <CommandGroup heading={t('commandPalette.groups.projects' as Parameters<typeof t>[0])}>
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                value={`@ ${project.name} ${project.id}`}
                onSelect={() => selectProject(project)}
              >
                <Type className="size-4 text-muted-foreground" />
                <span className="truncate">{project.name}</span>
                {project.id === currentProjectId ? <Check className="ml-auto size-4 text-primary" /> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

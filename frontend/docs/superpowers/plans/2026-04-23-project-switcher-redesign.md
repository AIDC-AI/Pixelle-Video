# 项目切换器重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目切换器从顶栏移到侧边栏顶部，改善项目命名体验。

**Architecture:** 新建 `project-switcher.tsx` 组件嵌入侧边栏顶部，使用 Popover 面板展示项目列表（搜索 + 切换 + 新建 + 管理）。顶栏移除所有项目相关代码。`ProjectRequiredDialog` 改为就地创建项目。

**Tech Stack:** Next.js, React, shadcn/ui (Popover, DropdownMenu), zustand, TanStack Query, lucide-react

**Spec:** `docs/superpowers/specs/2026-04-23-project-switcher-redesign.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/shell/project-switcher.tsx` | 侧边栏项目切换区域：入口按钮 + Popover 面板（搜索、列表、新建、管理全部） |
| Create | `src/components/shell/project-switcher.test.tsx` | project-switcher 单元测试 |
| Modify | `src/components/shell/sidebar.tsx` | 在 MENU_GROUPS 之前插入 `<ProjectSwitcher />` |
| Modify | `src/components/shell/sidebar.test.tsx` | 更新 sidebar 测试 |
| Modify | `src/components/shell/topbar.tsx` | 移除项目切换器、新建项目 Dialog 及相关 imports |
| Modify | `src/components/shell/topbar.test.tsx` | 移除项目切换器相关测试 |
| Modify | `src/components/create/project-required-dialog.tsx` | 改为就地创建项目（内嵌 ProjectNameDialog），不再跳转 /projects |
| Modify | `src/components/create/project-required-dialog.test.tsx` | 更新测试 |
| Modify | `messages/zh-CN.json` | 新增 projectSwitcher i18n key |
| Modify | `messages/en-US.json` | 新增 projectSwitcher i18n key |
| Modify | `src/app/globals.css` | 新增 animate-highlight keyframe |

---

### Task 1: 安装 Popover 组件 + 添加 highlight 动画

**Files:**
- Modify: `src/app/globals.css`
- Check: `src/components/ui/popover.tsx` (if missing, install)

- [ ] **Step 1: 检查 Popover 组件是否存在**

```bash
ls src/components/ui/popover.tsx 2>/dev/null || echo "MISSING"
```

如果 MISSING，安装：

```bash
npx shadcn@latest add popover
```

- [ ] **Step 2: 在 globals.css 添加 highlight 动画**

在 `globals.css` 的 `@layer utilities` 或文件末尾添加：

```css
@keyframes highlight-fade {
  0% { background-color: hsl(var(--accent)); }
  100% { background-color: transparent; }
}

.animate-highlight {
  animation: highlight-fade 1.5s ease-out forwards;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/popover.tsx src/app/globals.css
git commit -m "chore: add popover component and highlight animation"
```

---

### Task 2: 添加 i18n 文案

**Files:**
- Modify: `messages/zh-CN.json`
- Modify: `messages/en-US.json`

- [ ] **Step 1: 在 zh-CN.json 的 `shell` 对象内添加 `projectSwitcher` key**

在 `shell.topbar` 同级添加：

```json
"projectSwitcher": {
  "selectProject": "选择项目",
  "noProject": "暂无项目",
  "searchPlaceholder": "搜索项目...",
  "newProject": "新建项目",
  "manageAll": "管理全部",
  "rename": "重命名",
  "delete": "删除",
  "deleteConfirmTitle": "删除项目",
  "deleteConfirmDescription": "确定要删除项目 \"{name}\" 吗？关联的 {taskCount} 个任务也会被删除。",
  "deleteConfirmDescriptionEmpty": "确定要删除项目 \"{name}\" 吗？",
  "deleted": "项目已删除",
  "projectNameRequired": "请输入项目名称",
  "createTitle": "创建新项目",
  "createSubmit": "创建",
  "renameTitle": "重命名项目",
  "renameSubmit": "保存"
}
```

- [ ] **Step 2: 在 en-US.json 的 `shell` 对象内添加对应英文**

```json
"projectSwitcher": {
  "selectProject": "Select project",
  "noProject": "No projects yet",
  "searchPlaceholder": "Search projects...",
  "newProject": "New project",
  "manageAll": "Manage all",
  "rename": "Rename",
  "delete": "Delete",
  "deleteConfirmTitle": "Delete project",
  "deleteConfirmDescription": "Are you sure you want to delete \"{name}\"? {taskCount} linked tasks will also be deleted.",
  "deleteConfirmDescriptionEmpty": "Are you sure you want to delete \"{name}\"?",
  "deleted": "Project deleted",
  "projectNameRequired": "Please enter a project name",
  "createTitle": "Create new project",
  "createSubmit": "Create",
  "renameTitle": "Rename project",
  "renameSubmit": "Save"
}
```

- [ ] **Step 3: Commit**

```bash
git add messages/zh-CN.json messages/en-US.json
git commit -m "feat(i18n): add project switcher translations"
```

---

### Task 3: 创建 ProjectSwitcher 组件 — 基础结构 + 测试

**Files:**
- Create: `src/components/shell/project-switcher.tsx`
- Create: `src/components/shell/project-switcher.test.tsx`

- [ ] **Step 1: 写 project-switcher 的 failing test**

创建 `src/components/shell/project-switcher.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectSwitcher } from './project-switcher';

// Mock hooks
vi.mock('@/lib/hooks/use-current-project', () => ({
  useCurrentProjectHydration: vi.fn(() => ({
    currentProject: null,
    currentProjectId: null,
    isHydrated: true,
    setCurrentProject: vi.fn(),
    setCurrentProjectId: vi.fn(),
    clearCurrentProject: vi.fn(),
  })),
}));

vi.mock('@/lib/hooks/use-projects', () => ({
  useProjects: vi.fn(() => ({ data: { items: [] }, isLoading: false })),
  useCreateProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

describe('ProjectSwitcher', () => {
  it('renders "select project" when no project is selected', () => {
    render(<ProjectSwitcher isCollapsed={false} />);
    expect(screen.getByText('选择项目')).toBeInTheDocument();
  });

  it('renders project icon only when collapsed', () => {
    render(<ProjectSwitcher isCollapsed={true} />);
    expect(screen.queryByText('选择项目')).not.toBeInTheDocument();
    expect(screen.getByTestId('project-switcher-trigger')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/aibiancheng/Desktop/Pixelle-Video自动生成视频/frontend && npx vitest run src/components/shell/project-switcher.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: 创建 project-switcher.tsx 基础结构**

创建 `src/components/shell/project-switcher.tsx`：

```tsx
'use client';

import { useState, useMemo } from 'react';
import { FolderKanban, ChevronDown, Plus, Search, MoreHorizontal, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProjectNameDialog } from '@/components/projects/project-name-dialog';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useProjects, useCreateProject, useDeleteProject, useUpdateProject } from '@/lib/hooks/use-projects';
import { useAppTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type Project = components['schemas']['Project'];

interface ProjectSwitcherProps {
  isCollapsed: boolean;
}

export function ProjectSwitcher({ isCollapsed }: ProjectSwitcherProps) {
  const t = useAppTranslations('shell');
  const { currentProject, setCurrentProject, isHydrated } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const projects = projectsData?.items ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const handleSelect = (project: Project) => {
    setCurrentProject({ id: project.id });
    setIsOpen(false);
    setSearch('');
  };

  const handleCreate = async (name: string) => {
    createProject.mutate(
      { name },
      {
        onSuccess: (newProject) => {
          setCurrentProject({ id: newProject.id });
          setCreateDialogOpen(false);
          setHighlightedId(newProject.id);
          setTimeout(() => setHighlightedId(null), 1500);
          toast.success(t('topbar.project.created' as Parameters<typeof t>[0]));
        },
      }
    );
  };

  const handleRename = async (name: string) => {
    if (!renameTarget) return;
    updateProject.mutate(
      { projectId: renameTarget.id, body: { name } },
      { onSuccess: () => setRenameTarget(null) }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteProject.mutate(
      { projectId: deleteTarget.id, cascade: true },
      {
        onSuccess: () => {
          toast.success(t('projectSwitcher.deleted' as Parameters<typeof t>[0]));
          setDeleteTarget(null);
        },
      }
    );
  };

  return (
    <div className="px-3 mb-4" data-testid="project-switcher">
      {/* Trigger button */}
      <button
        data-testid="project-switcher-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted',
          isCollapsed && 'justify-center px-0'
        )}
      >
        <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
        {!isCollapsed && (
          <>
            <span className="flex-1 truncate text-left font-medium">
              {!isHydrated ? (
                <span className="inline-block h-4 w-20 animate-pulse rounded bg-muted" />
              ) : currentProject ? (
                currentProject.name
              ) : (
                t('projectSwitcher.selectProject' as Parameters<typeof t>[0])
              )}
            </span>
            <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
          </>
        )}
      </button>

      {/* Popover panel */}
      {isOpen && (
        <div className="mt-1 rounded-lg border bg-popover p-2 shadow-md" data-testid="project-switcher-panel">
          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('projectSwitcher.searchPlaceholder' as Parameters<typeof t>[0])}
              className="w-full rounded-md border bg-transparent py-1.5 pl-7 pr-2 text-xs focus:outline-ring"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Project list */}
          <div className="max-h-[320px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                {t('projectSwitcher.noProject' as Parameters<typeof t>[0])}
              </p>
            ) : (
              filtered.map((project) => (
                <div
                  key={project.id}
                  data-project-id={project.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-muted',
                    currentProject?.id === project.id && 'bg-accent text-accent-foreground',
                    highlightedId === project.id && 'animate-highlight'
                  )}
                  onClick={() => handleSelect(project)}
                >
                  <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{project.name}</span>
                  <span className="text-[10px] text-muted-foreground">{project.task_count}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-background"
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameTarget(project); }}>
                        {t('projectSwitcher.rename' as Parameters<typeof t>[0])}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(project); }}
                        className="text-destructive focus:text-destructive"
                      >
                        {t('projectSwitcher.delete' as Parameters<typeof t>[0])}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center gap-2 border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 flex-1 justify-start gap-2 text-xs"
              onClick={() => { setCreateDialogOpen(true); setIsOpen(false); }}
            >
              <Plus className="h-3 w-3" />
              {t('projectSwitcher.newProject' as Parameters<typeof t>[0])}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-2 text-xs" asChild>
              <Link href="/projects" onClick={() => setIsOpen(false)}>
                <Settings2 className="h-3 w-3" />
                {t('projectSwitcher.manageAll' as Parameters<typeof t>[0])}
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <ProjectNameDialog
        open={createDialogOpen}
        title={t('projectSwitcher.createTitle' as Parameters<typeof t>[0])}
        submitLabel={t('projectSwitcher.createSubmit' as Parameters<typeof t>[0])}
        pending={createProject.isPending}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreate}
      />

      {/* Rename dialog */}
      {renameTarget && (
        <ProjectNameDialog
          open={true}
          title={t('projectSwitcher.renameTitle' as Parameters<typeof t>[0])}
          submitLabel={t('projectSwitcher.renameSubmit' as Parameters<typeof t>[0])}
          initialValue={renameTarget.name}
          pending={updateProject.isPending}
          onOpenChange={(open) => { if (!open) setRenameTarget(null); }}
          onSubmit={handleRename}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('projectSwitcher.deleteConfirmTitle' as Parameters<typeof t>[0])}</DialogTitle>
              <DialogDescription>
                {deleteTarget.task_count > 0
                  ? t('projectSwitcher.deleteConfirmDescription' as Parameters<typeof t>[0], {
                      name: deleteTarget.name,
                      taskCount: deleteTarget.task_count,
                    })
                  : t('projectSwitcher.deleteConfirmDescriptionEmpty' as Parameters<typeof t>[0], {
                      name: deleteTarget.name,
                    })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                {t('topbar.actions.cancel' as Parameters<typeof t>[0])}
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteProject.isPending}>
                {t('projectSwitcher.delete' as Parameters<typeof t>[0])}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/aibiancheng/Desktop/Pixelle-Video自动生成视频/frontend && npx vitest run src/components/shell/project-switcher.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/project-switcher.tsx src/components/shell/project-switcher.test.tsx
git commit -m "feat: create ProjectSwitcher component with tests"
```

---

### Task 4: 集成 ProjectSwitcher 到 Sidebar

**Files:**
- Modify: `src/components/shell/sidebar.tsx`
- Modify: `src/components/shell/sidebar.test.tsx`

- [ ] **Step 1: 写 failing test — sidebar 渲染 project-switcher**

在 `sidebar.test.tsx` 中添加测试：

```tsx
it('renders project switcher above menu groups', () => {
  render(<Sidebar />);
  expect(screen.getByTestId('project-switcher')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/shell/sidebar.test.tsx
```

Expected: FAIL — project-switcher testid not found

- [ ] **Step 3: 在 sidebar.tsx 中插入 ProjectSwitcher**

在 `sidebar.tsx` 中：

1. 添加 import：
```tsx
import { ProjectSwitcher } from '@/components/shell/project-switcher';
```

2. 在 `<aside>` 内部、`MENU_GROUPS.map()` 之前插入：
```tsx
<ProjectSwitcher isCollapsed={isCollapsed} />
```

具体位置：在 `<div className="flex flex-col flex-1 py-4 overflow-y-auto overflow-x-hidden">` 内部的最前面。

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/shell/sidebar.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/sidebar.tsx src/components/shell/sidebar.test.tsx
git commit -m "feat: integrate ProjectSwitcher into sidebar"
```

---

### Task 5: 瘦身 Topbar — 移除项目切换器

**Files:**
- Modify: `src/components/shell/topbar.tsx`
- Modify: `src/components/shell/topbar.test.tsx`

- [ ] **Step 1: 从 topbar.tsx 移除以下内容**

移除的 imports：
- `useCurrentProjectStore`
- `useProjects`, `useCreateProject`
- `useCurrentProjectHydration`
- `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`, `DropdownMenuSeparator`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`
- `ChevronDown`, `Plus`

移除的 state 和逻辑：
- `currentProject`, `setCurrentProject`
- `isHydrated` 及其 hydration useEffect
- `projectsData`, `createProject`
- `isDialogOpen`, `newProjectName`
- `getErrorMessage`, `handleCreateProject`

移除的 JSX：
- 整个 `<DropdownMenu>` 项目切换器块
- 整个 `<Dialog>` 新建项目弹窗块

保留的 topbar 结构：
```tsx
<header className="flex items-center justify-between px-6 h-14 border-b bg-background">
  {/* Left: logo only */}
  <div className="flex items-center space-x-2 font-bold text-foreground">
    <div className="w-5 h-5 bg-foreground text-background rounded flex items-center justify-center text-[11px]">
      <Clapperboard className="w-3 h-3" />
    </div>
    <span>天幕</span>
  </div>

  {/* Center: search */}
  <div className="flex-1 flex justify-center">
    {/* existing search button */}
  </div>

  {/* Right: theme, notifications, user */}
  <div className="flex items-center space-x-2">
    {/* existing buttons */}
  </div>
</header>
```

- [ ] **Step 2: 更新 topbar.test.tsx**

移除所有与项目切换器相关的测试用例：
- 项目下拉菜单渲染测试
- 项目切换测试
- 新建项目 Dialog 测试
- hydration 相关测试

保留：
- 品牌 logo 渲染测试
- 搜索按钮测试
- 主题切换测试
- 通知和用户按钮测试

- [ ] **Step 3: Run all shell tests**

```bash
npx vitest run src/components/shell/
```

Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/topbar.tsx src/components/shell/topbar.test.tsx
git commit -m "refactor: remove project switcher from topbar"
```

---

### Task 6: 改造 ProjectRequiredDialog — 就地创建项目

**Files:**
- Modify: `src/components/create/project-required-dialog.tsx`
- Modify: `src/components/create/project-required-dialog.test.tsx`

- [ ] **Step 1: 写 failing test**

在 `project-required-dialog.test.tsx` 中添加：

```tsx
it('allows creating a project inline without navigating away', async () => {
  const user = userEvent.setup();
  render(<ProjectRequiredDialog open={true} onOpenChange={vi.fn()} />);
  
  const input = screen.getByPlaceholderText(/项目名称/);
  await user.type(input, '我的新项目');
  await user.click(screen.getByRole('button', { name: /创建/ }));
  
  // Should call createProject mutation
  expect(mockCreateProject.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ name: '我的新项目' }),
    expect.any(Object)
  );
});
```

（需要 mock `useCreateProject`）

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/create/project-required-dialog.test.tsx
```

- [ ] **Step 3: 改造 project-required-dialog.tsx**

将当前的"跳转到 /projects"行为改为内嵌创建表单：

1. 添加 imports：`useCreateProject` from `@/lib/hooks/use-projects`，`useCurrentProjectHydration` from `@/lib/hooks/use-current-project`，`Input` from `@/components/ui/input`
2. 添加 state：`projectName`（string）
3. Dialog 内容改为：
   - 图标 + 标题 + 描述（保留）
   - 新增：项目名称 Input
   - Footer 按钮改为："取消" + "创建并继续"
4. 创建成功后：调用 `setCurrentProject`，然后 `onOpenChange(false)`

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/create/project-required-dialog.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/create/project-required-dialog.tsx src/components/create/project-required-dialog.test.tsx
git commit -m "feat: inline project creation in ProjectRequiredDialog"
```

---

### Task 7: 全量测试 + 类型检查

**Files:** None (verification only)

- [ ] **Step 1: TypeScript 类型检查**

```bash
cd /Users/aibiancheng/Desktop/Pixelle-Video自动生成视频/frontend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 2: 运行全部测试**

```bash
npx vitest run
```

Expected: ALL PASS

- [ ] **Step 3: 如果有失败，修复后 commit**

```bash
git add -A
git commit -m "fix: resolve test/type issues from project switcher migration"
```

---

### Task 8: 清理 topbar 中残留的 i18n key（可选）

**Files:**
- Modify: `messages/zh-CN.json`
- Modify: `messages/en-US.json`

- [ ] **Step 1: 检查 `shell.topbar.project` 下的 key 是否还有其他组件引用**

```bash
grep -rn "topbar.project" src/ --include="*.tsx" --include="*.ts"
```

如果只有 project-switcher 在用（通过 `topbar.project.created`），可以将这些 key 迁移到 `projectSwitcher` 下统一管理。如果还有其他引用，保留不动。

- [ ] **Step 2: 如有迁移，更新引用并 commit**

```bash
git add messages/ src/
git commit -m "refactor(i18n): consolidate project-related translations"
```



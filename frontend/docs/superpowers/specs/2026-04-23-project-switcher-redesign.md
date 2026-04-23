# 项目切换器重设计

## 背景

当前项目切换器以 DropdownMenu 形式放在顶栏，存在两个核心问题：

1. **位置不当** — 项目是天幕创作工作台的一等公民，不应挤在顶栏的小下拉里
2. **命名丑陋** — 项目名自动生成为 `{pipeline}-project-{timestamp}-{hash}` 格式，用户无法辨识

## 方案决策

采用**侧边栏顶部项目切换器**方案（对比了顶栏 Command Palette 和独立页面方案后选定）。

核心理由：项目是全局上下文，放在侧边栏最顶部符合"先选项目，再操作"的心智模型，同时释放顶栏空间。

## 设计详情

### 1. 顶栏瘦身

- 移除项目切换器 DropdownMenu 和新建项目 Dialog
- 顶栏只保留：`[天幕 logo]` — `[⌘K 搜索]` — `[主题切换] [通知] [用户]`
- `topbar.tsx` 不再依赖 `useCurrentProjectStore`、`useProjects`、`useCreateProject`

### 2. 侧边栏项目切换区

位于侧边栏最顶部，在"创作"分组之上。

**展开态：**
- 显示当前项目名 + pipeline 图标 + 下拉箭头
- 点击展开内联面板

**折叠态：**
- 只显示项目图标（FolderKanban）
- hover tooltip 显示项目名
- 点击展开面板

**内联面板内容：**
- 搜索框（前端过滤，面板展开时自动聚焦）
- 项目列表（每项：名称 + pipeline 图标 + task 数量 + 创建时间相对值）
- 每个项目右侧 `...` 菜单：重命名、删除
- 底部"新建项目"按钮 + "管理全部"链接（跳转 `/projects`）
- 面板最大高度 400px，超出滚动

**键盘支持：**
- 上下箭头选择项目，Enter 确认，Esc 关闭面板
- 点击面板外部自动关闭
- 切换项目后面板自动关闭

### 3. 项目命名改造

**手动新建（侧边栏面板"新建项目"按钮）：**
- 弹出 `ProjectNameDialog`，名称为必填项
- 可选择关联的 pipeline 类型

**自动创建（创作页首次生成视频时触发）：**
- 前端构造默认名：`{pipeline中文名} - {YYYY-MM-DD HH:mm}`（如 `快速创作 - 2026-04-23 11:30`）
- 默认名跟随当前 i18n 语言设置
- 创建成功后侧边栏项目区短暂高亮新项目名，用户可点击直接重命名

**重命名：**
- 项目面板 `...` 菜单中的"重命名"选项
- 复用已有 `ProjectNameDialog` 组件

### 4. 组件拆分

**新增：**
- `src/components/shell/project-switcher.tsx` — 侧边栏项目切换区域（入口按钮 + 展开面板）

**修改：**
- `src/components/shell/topbar.tsx` — 移除所有项目相关代码
- `src/components/shell/sidebar.tsx` — 在 MENU_GROUPS 之前插入 `<ProjectSwitcher isCollapsed={isCollapsed} />`

**复用：**
- `ProjectNameDialog` — 新建/重命名弹窗
- `ProjectPreview` — 项目列表中的 pipeline 图标

**删除：**
- topbar 中的新建项目 Dialog（职责转移到 project-switcher）

### 5. 数据流

- `useCurrentProjectStore`（zustand + persist）继续作为全局状态源
- `useProjects()` / `useCreateProject()` / `useDeleteProject()` / `useUpdateProject()` 全部复用
- 项目面板搜索为纯前端过滤

### 6. 边界情况

- **无项目**：项目区显示"暂无项目"占位 + "新建项目"按钮
- **当前项目被删除**：`currentProjectId` 自动清空，回到"请选择项目"状态
- **删除有关联 task 的项目**：确认对话框提示 cascade 删除
- **`EmptyProjectsPrompt`**：保留，继续在 `/projects` 页面展示

### 7. i18n

所有新增文案加入 `messages/zh-CN.json` 和 `messages/en-US.json`。

### 8. 不涉及的范围

- 后端 API 无改动（前端构造默认名）
- `/projects` 列表页和 `/projects/[id]` 详情页不在本次范围
- `api.d.ts` 中的 Pixelle 注释不改（跟随后端 schema）

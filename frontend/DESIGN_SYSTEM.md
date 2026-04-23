# Pixelle-Video Design System

This document outlines the visual design system and tokens used in the Pixelle-Video frontend application. Our visual style prioritizes a **"high-end, simple, premium"** aesthetic.

## 1. Design Philosophy
- **Minimalism & Restraint**: Avoid unnecessary decorations. Less is more.
- **Clarity**: High contrast for text, subtle contrast for boundaries.
- **Lightweight**: Use very thin borders and extremely soft shadows. No heavy layers.
- **Systematic**: Strictly adhere to the defined spacing and color tokens.

## 2. Typography
We use a combination of Latin and CJK fonts to ensure excellent readability and aesthetics across languages.

- **Latin / Western**: `Inter`
- **CJK / Chinese**: `Noto Sans SC`
- **Configuration**: Applied globally via `next/font/google` and CSS variables (`--font-inter`, `--font-noto-sans-sc`).
- **Base Style**: `antialiased` is enabled globally.

## 3. Color Palette
Our color system centers on a neutral gray scale for structural elements and a sophisticated deep purple-blue for emphasis. High saturation is deliberately avoided.

### Light Mode
- **Background**: Neutral Gray `#f8f9fa` / `hsl(210, 20%, 98%)`
- **Card/Popover**: Pure White `#ffffff` / `hsl(0, 0%, 100%)`
- **Primary (Accent)**: Deep Purple-Blue `hsl(245, 60%, 45%)`
- **Foreground (Text)**: Dark Gray `hsl(220, 10%, 15%)`
- **Borders**: Light Gray `hsl(220, 10%, 90%)`

### Dark Mode
- **Background**: Deep Gray `hsl(220, 10%, 6%)`
- **Card/Popover**: Elevated Gray `hsl(220, 10%, 9%)`
- **Primary (Accent)**: Muted Purple-Blue `hsl(245, 60%, 65%)`
- **Foreground (Text)**: Near White `hsl(0, 0%, 95%)`
- **Borders**: Dark Border `hsl(220, 10%, 16%)`

## 4. Spacing & Grid
- **Baseline Grid**: We adhere strictly to an **8px** baseline grid.
- **Implementation**: Padding, margins, and gaps should scale in multiples of 4px and preferably 8px (e.g., `p-2`, `p-4`, `mb-8`, `gap-2`).
- **Consistency**: Components like Sidebars and Topbars employ consistent vertical and horizontal padding reflecting this scale.

## 5. Shape & Texture
- **Border Radius**: Small and sharp. We use `0.375rem` (6px, Tailwind `rounded-md`) as the default radius for menu items and standard interactive components because it aligns with Shadcn defaults and the actual sidebar item shape. Keep `rounded-sm` (`0.25rem` / 4px) for very small controls only.
- **Borders**: Borders act as subtle delimiters rather than hard outlines. Kept extremely thin (`border-border`, `opacity-50`, or similar).
- **Shadows**: Soft and faint. Heavily customized `--shadow-sm` and `--shadow-md` override default tailwind shadows to guarantee a light, premium lift.
- **Gradients**: Prohibited unless contextually critical for brand accents; solid colors are strongly preferred.

## 6. Implementation Notes
- **Styling Framework**: Tailwind CSS with CSS Variables.
- **UI Components**: Shadcn/ui (overridden by global design tokens).
- **Refactoring Strategy**: When building new components, use Tailwind's `/opacity` (e.g., `bg-card/50 backdrop-blur-sm`) to create sophisticated glass-like textures seamlessly.

## 7. Brand Identity

### Name

- Primary (zh-CN): 像影
- Full form: 像影 Pixelle
- English: Pixelle
- Semantics: 像素 + 影像（pixels becoming imagery）

### Mark

- Visual concept: a frame containing a gradient sky — "pixels lighting up inside the frame"
- Implementation: `src/components/shell/brand-mark.tsx`
- Shape: thin rectangular stroke + top-half linear gradient fill
- Gradient (light): from `hsl(245, 60%, 55%)` to `hsl(220, 70%, 85%)`
- Gradient (dark): from `hsl(245, 60%, 70%)` to `hsl(220, 70%, 45%)`
- Sizes: sm(16) / md(20) / lg(32) / xl(64) — in px
- Usage: Topbar uses sm; About page uses xl; avoid other sizes without design review

## 8. Navigation Hierarchy

Sidebar navigation uses spacing and typographic hierarchy instead of nested cards. The global aside may keep its subtle `bg-card/50 backdrop-blur-sm` material, but individual groups and the project area should not add rounded card shells, borders, or extra background panels.

- Group label style: `text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground`
- Group separation: use vertical spacing (`mt-6`) instead of boxed sections
- Menu item shape: `rounded-md`, matching the standard interactive radius
- Collapsed state: hide labels visually while preserving accessible labels through titles, `sr-only` text, and existing ARIA controls

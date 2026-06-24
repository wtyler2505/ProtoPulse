# ProtoPulse — Design System Rules for Figma MCP Integration

Rules for translating Figma designs into ProtoPulse code via the Figma Model Context
Protocol server. Generated from a codebase analysis (2026-06-24); keep it in sync when the
design system shifts.

> **Critical first rule — two design systems, pick the right target.** ProtoPulse has **two**
> React frontends with **different palettes**. Map Figma designs to the **legacy `client/`**
> app (the shipping product: shadcn/ui + Tailwind v4, cyan "cyberpunk" theme). Do **not**
> target `packages/app` (the engine schematic editor) — it's a bespoke canvas tool with
> hand-rolled CSS and a different blue palette, and has no component library to map onto.

## 1. Token Definitions

**Source of truth:** `client/src/index.css` — TailwindCSS **v4** (CSS-first, no
`tailwind.config.js`). Tokens live in a `@theme` block as CSS custom properties.

```css
/* client/src/index.css */
@import "tailwindcss";
@import "tw-animate-css";
@custom-variant dark (&:where(.dark, .dark *));   /* class-based dark mode */

@theme {                                          /* NOTE: NOT @theme inline — intentional */
  --font-display: 'Rajdhani', sans-serif;
  --font-sans:    'Inter', sans-serif;
  --font-mono:    'JetBrains Mono', monospace;

  --color-background: hsl(225 20% 3%);            /* dark-first */
  --color-primary:    hsl(190 100% 43%);          /* brand cyan */
  --color-secondary:  hsl(260 100% 65%);          /* electric purple */
  --color-editor-accent: #00F0FF;
  --color-destructive: hsl(0 85% 55%);
  --color-border;  --color-input;  --color-ring;
  --color-focus-ring: …;                          /* palette-independent, a11y */
}
```

**Rules for Figma → tokens:**
- Colors are **HSL**, exposed as `--color-*`. A Figma color maps to a `bg-*`/`text-*`/`border-*`
  utility, **never** a raw hex in JSX. If a needed color has no token, add a `--color-*` to
  `@theme` first.
- `@theme` is deliberately **without `inline`** so runtime theming works
  (`client/src/lib/theme-context.tsx` → `applyThemeColors` does `style.setProperty` on
  `<html>`). Don't add `inline`.
- Dark is the default; light/dark toggles via a `.dark`/`.light` class on `<html>` (the
  `ThemeProvider`), not the OS media query.
- **No transformation pipeline** (no Style Dictionary). Tokens are authored directly in CSS;
  Tailwind v4 generates `var(--color-*)`-backed utilities.

## 2. Component Library

**Location:** `client/src/components/ui/` — **shadcn/ui, "new-york" style** (~96 files: Radix
primitives + ProtoPulse-specific like `ConfidenceBadge`, `CommandPalette`). Config in
**`components.json`** (repo root):

```jsonc
{ "style": "new-york", "tailwind": { "baseColor": "neutral", "cssVariables": true },
  "iconLibrary": "lucide",
  "aliases": { "ui": "@/components/ui", "utils": "@/lib/utils",
               "components": "@/components", "hooks": "@/hooks" } }
```

**Architecture — the canonical pattern (replicate this for any new component):**

```tsx
// client/src/components/ui/button.tsx
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center … focus-visible:ring-2 \
   focus-visible:ring-[var(--color-focus-ring)] active:scale-[0.98] \
   motion-reduce:active:scale-100 hover-elevate active-elevate-2",
  { variants: { variant: { default: "bg-primary text-primary-foreground …",
                           outline: "…", ghost: "…" }, size: { … } },
    defaultVariants: { variant: "default", size: "default" } },
)
```

- **Variants → CVA** (`class-variance-authority`), never ad-hoc conditional class strings.
- **`asChild` → Radix `Slot`** for polymorphism.
- Custom interaction utilities `hover-elevate` / `active-elevate-2` — use these for elevation,
  not bespoke shadows.
- Always respect `motion-reduce:` and use `--color-focus-ring` for focus.
- **Living docs already exist:** `client/src/lib/design-system-docs.ts` — a searchable
  registry of tokens/components/icons/motion with Tailwind examples. **Read it before
  generating UI**; it is the in-repo design reference.

## 3. Frameworks & Libraries

| Concern | Choice |
|---|---|
| UI | **React 19.2** (`rsc: false` — client components) |
| Build/bundler | **Vite 7** + `@vitejs/plugin-react` |
| Styling | **TailwindCSS v4** (`@tailwindcss/vite`) + `tailwind-merge` + `clsx` + CVA |
| Primitives | **Radix UI** (full suite) via shadcn |
| Data/state | `@tanstack/react-query`, `react-hook-form`; engine editor uses **Zustand** |
| Specialized | `@xyflow/react` (node graphs), `@react-three/fiber` + `drei` (3D), `embla` |
| Test | Vitest 4 + Testing Library |

**`cn()` merge helper** (`client/src/lib/utils.ts`) — always merge classes through it:

```ts
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

## 4. Asset Management
- Static assets: **`client/public/assets/`**, referenced by root-absolute path (`/assets/…`).
- Path alias **`@` → `client/src`** (`vite.config.ts`). Import app modules via `@/…`, not deep
  relative paths.
- No CDN/image-optimization pipeline beyond Vite's bundling; fonts are the one external
  dependency — Google Fonts, preconnected and linked in `client/index.html`
  (Rajdhani / Inter / JetBrains Mono).

## 5. Icon System
- **`lucide-react`** exclusively (`iconLibrary: "lucide"`). Import named PascalCase icons,
  render as components, size via Tailwind:

  ```tsx
  import { Stethoscope } from "lucide-react"
  <Stethoscope className="size-4" />   // shadcn auto-applies [&_svg]:size-4 inside buttons
  ```

- Naming convention elsewhere (vault frontmatter, dashboards) uses `lucide-<kebab>` (e.g.
  `lucide-stethoscope`) — but **in React, use the PascalCase named export.**
- For Figma icon nodes: resolve to the nearest lucide equivalent rather than exporting SVG;
  only export SVG when no lucide match exists.

## 6. Styling Approach
- **Utility-first Tailwind v4** with token-backed utilities (`bg-primary`,
  `text-muted-foreground`, `border-border`). No CSS Modules, no styled-components/emotion in
  the legacy app.
- **Global styles:** only `client/src/index.css` (tokens + base + the `hover-elevate`
  utilities + `tw-animate-css`).
- **Responsive:** Tailwind breakpoint prefixes (`sm: md: lg:`); the app is desktop-first (a
  dense EDA tool). `react-resizable-panels` drives layout regions.
- **Engine editor exception** (`packages/app/src/styles.css`): a single plain-CSS file with
  its own `:root` vars (`--bg:#0b0e14; --accent:#58a6ff`), `className` strings, no Tailwind.
  Don't bring Figma UI here.

## 7. Project Structure

```
client/src/
  components/
    ui/            ← shadcn primitives + design-system components (Figma target)
    <feature>/     ← circuit-editor/, panels/, etc.
  lib/             ← utils.ts (cn), theme-context.tsx, design-system-docs.ts
  hooks/           ← @/hooks
  pages/           ← route-level views (ProjectWorkspace.tsx, …)
  index.css        ← tokens + globals
  App.tsx, main.tsx
packages/app/src/  ← engine editor (Zustand state/, panels/, sim/) — NOT a Figma target
```

- Feature components live in their own folder under `components/`; shared primitives in
  `components/ui/`.
- New UI → put primitives in `components/ui/`, compose feature views in
  `components/<feature>/` or `pages/`.

## Figma-MCP workflow rules (summary)
1. **Target the legacy `client/` system.** Generate shadcn-style components into
   `client/src/components/ui/` (or feature folders), using Radix + CVA + `cn()`.
2. **Tokens, not literals.** Map Figma colors/spacing/type to `--color-*` / Tailwind
   utilities; add a `@theme` token first if missing.
3. **Icons → `lucide-react`** PascalCase named imports.
4. **Read `client/src/lib/design-system-docs.ts`** for the authoritative token/pattern
   reference before producing UI.
5. **Honor a11y/motion conventions** (`--color-focus-ring`, `focus-visible:ring-2`,
   `motion-reduce:`).

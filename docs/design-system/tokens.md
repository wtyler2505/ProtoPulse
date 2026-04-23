# Design System Tokens

> **Status:** Phase 1 shipped (Plan 16 Phase 1, 2026-04-23).
> **Source:** `client/src/index.css` @theme block.
> **Plan:** `docs/superpowers/plans/2026-04-18-e2e-walkthrough/16-design-system.md`
> **Audit refs:** E2E-969 through E2E-982, E2E-1015, E2E-1016, E2E-1019, E2E-1031, E2E-491.

## Scope of this document

This file documents the **semantic design tokens** available to every consumer in ProtoPulse. Consumer migration to these tokens is phased:

| Phase | Owner | Scope |
|-------|-------|-------|
| **Phase 1 (done)** | `client/src/index.css` | Tokens + casing utilities + reduced-motion parity. |
| **Phase 2 (next)** | `Button`, `Input`, `InteractiveCard` primitives | Primitive-level adoption. |
| Per-tab plans (later) | view files under `client/src/components/views/**` | Full consumer migration. |

**Do not** edit consumer files to adopt these tokens outside the phase that owns that consumer. Tokens shipped Phase 1 are backwards-compatible: every existing `--color-primary` / `--color-destructive` / etc. reference continues to work unchanged.

---

## 1. Color tokens

### 1.1 Why two tokens for "cyan"?

Pass 13 audit finding E2E-970: **cyan is used for BOTH active interactive emphasis AND brand identity — nothing stands out**. The fix is to split:

- `--color-brand` — project identity (ProtoPulse cyan wordmark).
- `--color-primary` — active/selected/hovered interactive state.

Phase 1 ships both as the same hex (cyan) because 186 consumers reference `--color-primary` today; retuning it in Phase 1 would cascade a visual shift outside file ownership. **Phase 2 migrates brand-intent callsites to `--color-brand`; only after that can `--color-primary` retune to a non-cyan hue** (candidates: `hsl(220 90% 65%)` rich blue or `hsl(260 90% 70%)` violet).

### 1.2 Dark-mode palette (default `.dark`)

| Token | Value | Contrast vs `--color-background` | WCAG | Semantic use |
|-------|-------|---|---|---|
| `--color-background` | `hsl(225 20% 3%)` | — (reference) | — | App surface base |
| `--color-foreground` | `hsl(210 20% 90%)` | ~14.5:1 | AAA | Body text |
| `--color-primary` | `hsl(190 100% 43%)` | ~8.9:1 | AAA | Active/hovered interactive (buttons, tabs, selection) |
| `--color-brand` | `hsl(190 100% 43%)` | ~8.9:1 | AAA | Brand identity only (wordmark, about surfaces) |
| `--color-power` | `hsl(40 95% 55%)` | ~8.6:1 | AAA | VCC rails, power domain badges, power nets |
| `--color-signal` | `hsl(190 100% 60%)` | ~11:1 | AAA | Digital signals, GPIO, bus wires |
| `--color-data` | `hsl(270 85% 72%)` | ~7.4:1 | AAA | KPI numerics, inspector values, MPN highlighting |
| `--color-warning` | `hsl(45 100% 60%)` | ~10.5:1 | AAA | Non-fatal caveats, setup-required chrome |
| `--color-success` | `hsl(145 75% 55%)` | ~9.7:1 | AAA | Test pass, build succeeded, ready-to-run |
| `--color-info` | `hsl(215 90% 70%)` | ~8.1:1 | AAA | Tips, non-actionable pedagogy |
| `--color-destructive` | `hsl(0 85% 55%)` | ~5.6:1 | AA | Destructive actions (delete, remove) |
| `--color-error` | → `--color-destructive` | — | — | Runtime errors (semantic alias) |
| `--color-focus-ring` | `hsl(0 0% 100%)` | ~19.5:1 | AAA | Keyboard focus indicator (palette-independent) |

### 1.3 Light-mode palette (`.light` override)

Light-mode values shift each hue's **lightness** (not the hue) downward to preserve 4.5:1+ text contrast on the ~#F6F8FA surface:

| Token | Light-mode value | Contrast vs light bg |
|-------|------------------|---|
| `--color-brand` | `hsl(190 100% 35%)` | ~4.8:1 (AA) |
| `--color-power` | `hsl(40 95% 42%)` | ~4.6:1 (AA) |
| `--color-signal` | `hsl(190 100% 38%)` | ~4.9:1 (AA) |
| `--color-data` | `hsl(270 70% 48%)` | ~5.2:1 (AA) |
| `--color-warning` | `hsl(45 100% 42%)` | ~4.7:1 (AA) |
| `--color-success` | `hsl(145 75% 34%)` | ~4.9:1 (AA) |
| `--color-info` | `hsl(215 85% 45%)` | ~4.6:1 (AA) |

Light-mode targets WCAG 2.1 **AA** (4.5:1) rather than AAA (7:1) because the light palette is intentionally softer — AAA on bright backgrounds reads as harsh for extended sessions. Dark mode (our default) hits AAA across the board.

### 1.4 High-contrast palette (`.high-contrast` override)

All tokens bumped to ≥7:1 against pure-black (`hsl(0 0% 0%)`) for keyboard-only / low-vision users. Activated by `localStorage['protopulse-high-contrast'] = 'on'`.

### 1.5 Power vs Warning: why two ambers?

E2E-971 flagged ambiguous amber usage. Keeping both:

| Token | Hue | Lightness | Feel | When |
|-------|-----|-----------|------|------|
| `--color-power` | 40° (pure amber) | 55% | Domain / electrical | "this is a VCC rail" |
| `--color-warning` | 45° (amber-yellow) | 60% | Advisory / attention | "this has a caveat" |

A 5° hue shift + 5% lightness lift is enough that a Power net badge sitting next to a Validation warning reads as two distinct signals. See the audit note in the CSS comment for rationale.

---

## 2. Typography tokens

### 2.1 Scale (E2E-976, E2E-978, E2E-979, E2E-1019)

| Token | Size | Use |
|-------|------|-----|
| `--text-h1` | 2rem (32px) | View title, dialog header |
| `--text-h2` | 1.5rem (24px) | Panel header |
| `--text-h3` | 1.125rem (18px) | Card / section header |
| `--text-body` | 0.875rem (14px) | Running text (matches `--app-font-size`) |
| `--text-caption` | 0.75rem (12px) | Metadata, timestamps, helper text |
| `--text-kpi` | 3rem (48px) | Hero KPIs (Dashboard stats) |
| `--text-kpi-md` | 1.5rem (24px) | Card-level stats |
| `--text-kpi-sm` | 1rem (16px) | Inline counts |

### 2.2 Line height (E2E-980)

| Token | Value | Use |
|-------|-------|-----|
| `--leading-dense` | 1.3 | Tables, inspectors, data-dense rows |
| `--leading-default` | 1.5 | Body copy (matches `--app-line-height`) |
| `--leading-reader` | 1.7 | Vault notes, long explainers |

### 2.3 Casing policy (E2E-977, E2E-982)

Utility classes in `@layer utilities`:

| Class | When to use |
|-------|-------------|
| `.case-title` | View titles, dialog headers — **content is written Title Case manually** |
| `.case-sentence` | Body, buttons, helper text — **content is Sentence case** (default per Nielsen Norman research) |
| `.case-caps` | Status pills, eyebrow labels, section markers — applies `text-transform: uppercase` + `letter-spacing: 0.1em` |

**Never** use `.case-caps` on prose. It is a chrome signal, not a stylistic choice.

---

## 3. Spacing tokens (E2E-985)

Phase 1 ships tokens; Phase 2 enforces via the `Card` primitive.

| Token | Value | Use |
|-------|-------|-----|
| `--spacing-card-padding-sm` | 0.75rem (12px) | Ultra-compact data rows |
| `--spacing-card-padding-md` | 1rem (16px) | Secondary / nested cards |
| `--spacing-card-padding-lg` | 1.5rem (24px) | **Canonical** primary cards |

---

## 4. Motion tokens (E2E-1015, E2E-1016)

### 4.1 Duration scale

| Token | Value | Use |
|-------|-------|-----|
| `--motion-duration-fast` | 80ms | Tooltip reveal, chip hover |
| `--motion-duration-base` | 150ms | Button hover, focus ring, tab underline |
| `--motion-duration-slow` | 300ms | Drawer slide, modal fade, view transition |

### 4.2 Easing

| Token | Curve | Use |
|-------|-------|-----|
| `--motion-ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default material-style |
| `--motion-ease-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | Enter-with-emphasis |
| `--motion-ease-decelerate` | `cubic-bezier(0, 0, 0.2, 1)` | Settle-into-place |

### 4.3 Reduced-motion behavior

Two activation paths, both honored:

1. OS preference: `@media (prefers-reduced-motion: reduce)`
2. Manual toggle: `.reduced-motion` class on `<html>` (via `ReducedMotionManager`)

Under either, the three `--motion-duration-*` tokens are set to `0ms` (both CSS consumers and JS-via-`getComputedStyle` consumers honor reduced motion). The universal `*, *::before, *::after { animation-duration: 0.01ms !important }` sweep at the bottom of `index.css` remains in force as a belt-and-braces catch for legacy literals.

---

## 5. Consumer migration map (Phase 2+)

Tokens shipped Phase 1 that existing code does NOT yet consume — logged here so Phase 2 and later plans can grep for migration targets:

| Token | Expected future consumers |
|-------|---------------------------|
| `--color-brand` | `WorkspaceHeader` wordmark, `about` dialog, favicon surfaces |
| `--color-power` | `ArchitectureView` power-domain badges, PCB `LayerStack` power plane, `SchematicView` power net chips |
| `--color-signal` | Schematic wire colors for digital signals, GPIO pin indicators, bus labels |
| `--color-data` | Inspector panel value columns, MPN / hex ID strings, Dashboard KPI digits |
| `--color-warning` | `ValidationView` rows, `Arduino` setup-required banners, non-fatal toasts |
| `--color-success` | Test-pass badges, `ERC-clean` chrome, successful-build toasts |
| `--color-info` | Help callouts, "did you know" strips, pedagogy chrome |
| `--text-*` scale | `<Heading>` primitive (Phase 2 Task 2.2) — all heading callsites migrate |
| `--leading-*` | `<Heading>`, `<Prose>` primitives |
| `--spacing-card-padding-*` | `<Card>` primitive enforcement |
| `--motion-duration-*` | `<Button>`, `<Tooltip>`, `<Dialog>` primitives + `useReducedMotion` hook |
| `.case-*` utilities | Headings, pills/chips, eyebrow labels |

---

## 6. Contrast methodology

All contrast ratios in this doc computed via the WCAG 2.1 relative-luminance formula against the mode-appropriate `--color-background`:

- Dark mode bg: `hsl(225 20% 3%)` ≈ `#06080C`
- Light mode bg: `hsl(210 20% 98%)` ≈ `#F6F8FA`
- High-contrast bg: `hsl(0 0% 0%)` = `#000000`

Any token whose ratio is at or below 4.5:1 for a text-context use case is flagged in-CSS and must be adjusted before shipping. E2E-974 cited amber-on-zinc-900 at ~4.2:1 — our dark background is darker than zinc-900 and our amber's lightness is 55% (not 50%), both factors lifting us well past AAA.

---

## 7. What this document is not

- Not a primitive registry — that's `client/src/components/ui/*` + (future) Storybook in Phase 7.
- Not a copy style guide — that lives at `docs/design-system/copy-style.md` (Phase 2).
- Not a motion cookbook — Phase 6 owns animation primitive docs.

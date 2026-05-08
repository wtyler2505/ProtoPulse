# ProtoPulse Design System — Deep Audit v2 (Annex)

**Date:** 2026-04-23
**Relationship:** Long-form companion to `docs/audits/2026-04-23-protopulse-design-system-brutal-audit.md` (v1). The v1 audit stands as the executive summary. This annex is the details layer — per-primitive, per-view, per-axis, with file-and-line evidence.
**Scope:** Full-surface — design language, shell, every primitive in `client/src/components/ui/`, every view in `client/src/components/views/`, top-level pages, mobile, motion/loading/error/empty, copy/microcopy, information architecture, accessibility.
**Author method:** Implementation-grounded static review. Code + existing screenshot archive + existing a11y audit ledger. Fresh runtime DOM snapshots were not captured this pass (see §2.3).

---

## Table of contents

1. Purpose and relationship to v1
2. Method, sources, and limitations
3. Executive deltas vs v1
4. Foundation audit
5. Primitive-by-primitive audit
6. Shell audit
7. Page-by-page audit
8. View-by-view audit
9. Cross-cutting axes (a11y, copy, IA, states)
10. Mobile / responsive audit
11. Contradiction matrix v2
12. Prioritized remediation plan (P0–P5)
13. Open questions, risks, and acceptance criteria

---

## 1. Purpose and relationship to v1

### 1.1 What v1 already said

The v1 audit (`docs/audits/2026-04-23-protopulse-design-system-brutal-audit.md`) established the direction:

- ProtoPulse has a genuine visual thesis, good semantic token architecture, and real accessibility intent.
- The system is **better designed than it is enforced**: spec, token docs, and runtime primitives drift.
- The single worst contradiction was framed as **square-cut spec vs rounded primitives**.
- The focus-ring migration, typography taxonomy, and shell hierarchy were partial.

### 1.2 What v2 adds

This annex does the evidence the summary couldn't carry:

- Maps every token in `client/src/index.css` against every theme preset in `client/src/lib/theme-context.tsx` and against `DESIGN.md`.
- Walks every primitive file in `client/src/components/ui/` and calls out per-primitive drift.
- Walks every view and page surface by cluster.
- Runs cross-cutting accessibility, copy/microcopy, information architecture, and non-happy-path state audits on top of the code.
- Reclassifies **one major v1 claim as partially inaccurate** (the radius critique — the token layer already neutralizes `rounded-*` class drift; see §3.1).
- Produces an expanded contradiction matrix and a prioritized remediation plan with file pointers.

### 1.3 What v2 deliberately does not do

- Does not invent missing tokens. All tokens cited are ones that actually live in `client/src/index.css`.
- Does not repeat v1 line for line. Where v1 already made a point cleanly, this annex only amplifies or corrects.
- Does not attempt to rewrite `DESIGN.md`. Where the spec and runtime disagree, both sides of the contradiction are named.
- Does not ship code. Every recommendation is a written remediation target.

---

## 2. Method, sources, and limitations

### 2.1 Primary sources (spec + tokens)

- `DESIGN.md` — the YAML front matter plus authored prose (colors, typography, layout, shape, components).
- `client/src/index.css` — the authoritative runtime token layer: `@theme` block, `.light` override, `.high-contrast` override, motion tokens, casing utilities, scrollbar theming, react-flow overrides, reduced-motion rules, tutorial highlight animations, `blur-optimized` performance class.
- `docs/design-system/tokens.md` — the operational doc that mirrors `index.css` for Phase 1 tokens with contrast methodology.
- `docs/design-system/vault-primitives.md` — Vault UI pedagogy primitives.
- `client/src/lib/theme-context.tsx` — the eight theme presets and the CSS custom property application logic.
- `client/src/lib/design-system-docs.ts` — the in-app search registry of design system docs.
- `client/src/App.tsx` — eager theme / high-contrast / reduce-blur bootstrap.

### 2.2 Shell, primitives, and views

- All 80+ files under `client/src/components/ui/`.
- All 40+ top-level files under `client/src/components/views/` plus subfolders (`architecture/`, `arduino/`, `circuit-code/`, `component-editor/`, `pcb-layout/`, `procurement/`, `validation/`).
- Top-level pages: `AuthPage`, `ProjectPickerPage`, `ProjectWorkspace`, `EmbedViewerPage`, `not-found`, `settings/SettingsPage`, plus `pages/workspace/*`.
- Layout: `components/layout/Sidebar.tsx`, `pages/workspace/WorkspaceHeader.tsx`, `pages/workspace/MobileNav.tsx`, `pages/workspace/ViewRenderer.tsx`.

### 2.3 Runtime visual verification

The plan called for **code + existing screenshots + targeted fresh DOM/a11y snapshots** from a running dev server.

- ProtoPulse's dev server is **running on `http://localhost:5000`** (verified via `ss -tlnp` and a 200 response from `curl -I`).
- Fresh DOM/a11y captures via Chrome DevTools MCP / Playwright MCP were **not feasible this pass** — those MCP tools are not in this agent's available tool set.
- Graceful degradation: the annex uses the existing screenshot archive under `docs/audit-screenshots/` and `docs/audits/screenshots-2026-04-18/`, plus the existing per-file a11y audit `docs/audit-screenshots/code-audit-accessibility.md` (105 prior findings, dated 2026-02-27) as an evidence base, alongside static source review.
- Where a runtime observation would strengthen a claim, this annex notes the gap inline rather than inventing a visual conclusion.

### 2.4 Grep sweeps (signal counts)

These are pass-wide signal counts used throughout the annex:

| Sweep | Result |
|---|---|
| `rounded-(sm|md|lg|xl|2xl|3xl|full|none)` in `client/src` | 616 matches across 218 files |
| `rounded-full` | 175 matches across 82 files |
| `focus-visible:ring-ring` / `focus:ring-ring` (**old token**) | 43 matches across 28 files |
| `aria-*` / `role=` | 666 matches across 197 files |
| `role="button"` on non-button elements | 58 matches across 48 files |
| `motion-reduce:` / `prefers-reduced-motion` | 37 matches across 14 files |
| `uppercase` or `tracking-(wider|widest)` | 366 matches across 142 files |
| Skeleton / Spinner / EmptyState / PanelSkeleton / isLoading / isPending / isError / ErrorBoundary | 496 matches across 92 files |
| Semantic-token consumption (`--color-brand`, `--color-power`, `--color-signal`, `--color-data`, `--color-warning`, `--color-success`, `--color-info`, `--color-focus-ring`) | 77 matches across 7 files, **62 of which are inside `client/src/index.css` itself** — consumer adoption is effectively zero outside primitives |

### 2.5 Limitations

- No runtime contrast computation. Contrast numbers in this annex come from comments in `client/src/index.css` or from `docs/design-system/tokens.md`.
- No screenshot diff this pass. The existing `docs/audit-screenshots/UI_AUDIT_REPORT.md` findings are treated as dated but still directionally useful.
- Not every view got full-depth treatment. Views are grouped by cluster in §8 with per-file pointers; the most complex clusters (design, validation, procurement) get more lines than utility clusters.
- The Tauri surface (`src-tauri/`) is explicitly out of scope — this annex is web-shell only.

---

## 3. Executive deltas vs v1

### 3.1 The v1 radius critique was partially inaccurate — correcting here

**v1 claim:** `card.tsx` uses `rounded-xl`, `tabs.tsx` uses `rounded-lg`, `alert.tsx` uses `rounded-lg`, `toast.tsx` uses `rounded-md`, so the app contradicts its square-cut posture.

**v2 correction:** The *class names* are still soft, but in Tailwind v4 with `@theme` overriding the radius scale, those classes **resolve to 0 radius at runtime**. Concretely, in `client/src/index.css`:

```@/home/wtyler/Projects/ProtoPulse/client/src/index.css:307-311
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;
  --radius-xl: 0px;
  --radius-2xl: 0px;
```

Because Tailwind v4 `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl` utilities read these `@theme` tokens, and because `@theme` is declared **without** the `inline` modifier so custom property updates win at runtime (see the comment at `@/home/wtyler/Projects/ProtoPulse/client/src/index.css:11-22`), every primitive with `rounded-xl` / `rounded-lg` / `rounded-md` / `rounded-sm` **renders with 0px corners** in the current build.

There is additional proof at `@/home/wtyler/Projects/ProtoPulse/client/src/index.css:663-690`, where react-flow chrome is forced to `border-radius: 0 !important`.

So:

- The **spec/runtime contradiction on radius is real**, but it is a **class-name drift / intent-declaration** problem, not a visual drift problem in default themes.
- The surviving visual softness is concentrated in `rounded-full` (pill badges — 175 hits across 82 files) and in **inline literals** that bypass the token layer (e.g. `border-radius: 4px` on the tutorial highlight at `@/home/wtyler/Projects/ProtoPulse/client/src/index.css:793`, and embedded `borderRadius: '8px'` in `EmbedViewerPage.tsx`).
- This is still a problem — class names signal intent, and a new developer reading `Card` sees `rounded-xl` and assumes soft corners. But the fix is a **naming / enforcement** problem, not a runtime-visual emergency.

**Consequence for v2:** the radius critique is reframed as "intent drift + pill overuse + a small set of inline literals," and the **bigger outstanding shape problem is the pill count**, not `Card`'s class name.

### 3.2 The focus-ring migration is roughly half done — new count

v1 described the migration as "partial." v2 puts numbers on it:

- **Adopted** (`focus-visible:ring-[var(--color-focus-ring)]`): `Button` (`@/home/wtyler/Projects/ProtoPulse/client/src/components/ui/button.tsx:16`), `Input` (`@/home/wtyler/Projects/ProtoPulse/client/src/components/ui/input.tsx:15`), `Textarea` (`@/home/wtyler/Projects/ProtoPulse/client/src/components/ui/textarea.tsx:16`), `InteractiveCard` (`@/home/wtyler/Projects/ProtoPulse/client/src/components/ui/interactive-card.tsx:59`), global `:focus-visible` fallback (`@/home/wtyler/Projects/ProtoPulse/client/src/index.css:496-499`), `.focus-ring` utility (`@/home/wtyler/Projects/ProtoPulse/client/src/index.css:609-611`).
- **Not adopted** (still `focus-visible:ring-ring`): 43 matches across 28 files including `tabs.tsx`, `select.tsx`, `dialog.tsx` Close, `toast.tsx` ToastAction, `EmptyState.tsx`, `badge.tsx` (uses `focus:ring-ring`), `sheet.tsx`, `checkbox.tsx`, `radio-group.tsx`, `slider.tsx`, `switch.tsx`, `toggle.tsx`, `sidebar.tsx`, `menubar.tsx`, `dropdown-menu.tsx`, `calendar.tsx`, `resizable.tsx`.
- **Partial** (`focus:ring-ring` with 1px ring, not 2): `select.tsx` trigger (`@/home/wtyler/Projects/ProtoPulse/client/src/components/ui/select.tsx:22` — `focus:ring-1 focus:ring-ring`). This is worst-of-both — old token **and** thinner ring.

Adoption is ~15% by file count (form primitives + the cards), ~85% still on the brand-tied ring. The global `:focus-visible` fallback in `index.css` masks the problem for unstyled elements, but primitive-level adoption will matter as soon as a consumer sets `focus-visible:ring-*` and overrides the global rule.

### 3.3 Semantic tokens exist but consumer adoption is effectively zero outside primitives

The grep for `--color-brand|--color-power|--color-signal|--color-data|--color-warning|--color-success|--color-info|--color-focus-ring` returns **77 matches in 7 files, 62 of which are inside `client/src/index.css` itself**. Remaining consumers are primitives (`Button`, `Input`, `Textarea`, `InteractiveCard`), test files, and `design-system-docs.ts`. No view, no page, no panel consumes these tokens yet.

This is **consistent with the documented Phase 1 strategy** in `docs/design-system/tokens.md` ("Phase 1 ships tokens; Phase 2 migrates consumers"), but the **Phase 2 migration has not visibly started**. Every view that displays power / signal / data / warning / success / info status today is using ad-hoc `text-amber-400` / `bg-amber-500/15` / `text-green-400` literals instead of tokens. Example: `KnowledgeView.tsx:55-59` uses `bg-green-500/20`, `bg-amber-500/20`, `bg-red-500/20` for difficulty badges — those three should be `--color-success`, `--color-warning`, `--color-destructive`.

### 3.4 The a11y picture is more nuanced than v1 said

v1 flagged "partial accessibility migration." The `docs/audit-screenshots/code-audit-accessibility.md` ledger (dated 2026-02-27) recorded **105 findings** — 12 critical, 48 high, 31 medium, 14 low. Sampling a few to check current state:

- **Dialog focus trap, skip links, Radix modal primitives** — confirmed present and correct today. v1 was right.
- **`role="button"` on non-button `<div>`** — v1 treated as mostly addressed. v2 grep confirms **58 instances across 48 files still exist**. Many views (`KnowledgeView.tsx`, `ProcurementView.tsx`) still carry scoped `/* eslint-disable jsx-a11y/* */` disables at the file top, acknowledging planned-not-done migration.
- **Icon-only controls without `aria-label`** — v1 flagged this is uneven; the 2026-02-27 ledger enumerates dozens. Many remain in `chat/ChatHeader.tsx`, `chat/MessageInput.tsx`, `OutputView.tsx`, `ProcurementView.tsx` table row icons. Several ARE labeled via `title` but not `aria-label`, which screen readers do not read reliably.
- **Low-contrast `text-muted-foreground/40` and `text-muted-foreground/50`** — v1 did not mention. Multiple components compound opacity past WCAG AA minimum. This is a live visual contrast problem independent of the token layer.

### 3.5 The state-surface picture is stronger than v1 implied

v1 said empty/loading/error state consistency "is likely not systematically solved." v2 grep disagrees: **496 matches across 92 files** for Skeleton / Spinner / EmptyState / isLoading / isPending / isError / ErrorBoundary. The heaviest concentrations are in the pages themselves (`ViewRenderer.tsx` 74, `ProjectLoadingSkeleton.tsx` 25, `ProjectWorkspace.tsx` 23, `ProjectPickerPage.tsx` 19), meaning **state handling is systemic, not absent**. What *is* weak is **primitive consolidation** — there are two `Empty*` primitives (`empty.tsx` vs `EmptyState.tsx`) that do not share API, styling, or focus-ring adoption. That is a different problem from "state surfaces are missing."

### 3.6 The tooltip uses brand cyan as its background — new call-out

`@/home/wtyler/Projects/ProtoPulse/client/src/components/ui/tooltip.tsx:23` sets `bg-primary text-primary-foreground` on the tooltip content. That means every tooltip in the app is a bright cyan block with dark text. That is visually striking, but it:

- Conflates *identity + active interaction* color with *passive-information* surface, violating the split that `DESIGN.md` and `tokens.md` argue for (brand vs primary vs info).
- Makes 400+ tooltips compete visually with actual cyan-bg active elements.
- Fights the `--color-info` token (blue) which is the correct color for "informational, non-actionable pedagogy."

This is one of the cleanest high-leverage fixes in the product: reskin `TooltipContent` to `--color-popover` / `--color-popover-foreground` (or to the `--color-info` family) and the ambient cyan load drops immediately.

### 3.7 Auth, not-found, and embed pages diverge from the product shell

- `AuthPage.tsx` uses raw `<input>` with `focus:border-primary/50` instead of the `Input` primitive — it does NOT pick up the `--color-focus-ring` treatment the primitive provides.
- `not-found.tsx` uses the `Card` + `Button` primitives but renders at `text-2xl font-bold` without `font-display` — inconsistent with the workspace shell that uses Rajdhani for display.
- `EmbedViewerPage.tsx` uses Tailwind-v3-style `hsl(var(--card))` references at lines 39-42, but the runtime CSS declares the tokens as `--color-card` (Tailwind-v4 style). This **is a subtle color bug** — the embed view likely renders with browser defaults for node backgrounds instead of the themed card color. See §7.4.

### 3.8 Short form

| Axis | v1 position | v2 updated position |
|---|---|---|
| Radius posture | "Spec square, primitives rounded" | "Classes drift, tokens neutralize; inline literals + `rounded-full` overuse remain real" |
| Focus-ring migration | "Partial" | "~15% by file count (primitives done, overlays/form/overlay primitives not)" |
| Semantic token adoption | "Directionally excellent, mid-migration" | "Tokens exist; **consumer adoption is effectively zero outside primitives**" |
| Accessibility | "Partial" | "Strong intent + 105 cataloged issues; ~60 open; `role=\"button\"` on divs still widespread" |
| State surfaces | "Likely weak" | "Systemic — 496 hits; real problem is **duplicate `Empty*` primitives**" |
| Tooltip color | Not called out | "Brand cyan background is globally wrong — should be popover/info" |
| Auth/404/embed pages | "Not primary issue" | "Three separate visual-identity breaks from the shell" |

---

## 4. Foundation audit

### 4.1 Color token inventory — full matrix

From `@/home/wtyler/Projects/ProtoPulse/client/src/index.css:23-312` (dark default `@theme`), `@/home/wtyler/Projects/ProtoPulse/client/src/index.css:326-356` (`.light`), and `@/home/wtyler/Projects/ProtoPulse/client/src/index.css:363-421` (`.high-contrast`):

#### 4.1.1 Core palette

| Token | Dark default | Light | High-contrast | Managed by theme preset? |
|---|---|---|---|---|
| `--color-background` | `hsl(225 20% 3%)` | `hsl(210 20% 98%)` | `hsl(0 0% 0%)` | **yes** (via `theme-context.tsx`) |
| `--color-foreground` | `hsl(210 20% 90%)` | `hsl(225 20% 5%)` | `hsl(0 0% 100%)` | yes |
| `--color-card` | `hsl(225 18% 5%)` | `hsl(0 0% 100%)` | `hsl(0 0% 4%)` | yes |
| `--color-popover` | `hsl(225 18% 5%)` | `hsl(0 0% 100%)` | `hsl(0 0% 4%)` | yes |
| `--color-primary` | `hsl(190 100% 43%)` | `hsl(221 83% 53%)` | `hsl(190 100% 55%)` | yes |
| `--color-secondary` | `hsl(260 100% 65%)` | `hsl(210 20% 90%)` | `hsl(260 100% 75%)` | yes |
| `--color-muted` | `hsl(225 12% 10%)` | `hsl(210 20% 94%)` | `hsl(0 0% 8%)` | yes |
| `--color-accent` | `hsl(190 100% 43%)` | `hsl(221 83% 53%)` | `hsl(190 100% 55%)` | yes |
| `--color-destructive` | `hsl(0 85% 55%)` | `hsl(0 84% 60%)` | `hsl(0 90% 60%)` | yes |
| `--color-border` | `hsl(225 12% 20%)` | `hsl(214 32% 91%)` | `hsl(0 0% 35%)` | yes |
| `--color-input` | `hsl(225 12% 20%)` | `hsl(214 32% 91%)` | `hsl(0 0% 35%)` | yes |
| `--color-ring` | `hsl(190 100% 43%)` | `hsl(221 83% 53%)` | `hsl(190 100% 60%)` | yes |
| `--color-sidebar` | `hsl(225 20% 4%)` | `hsl(210 20% 96%)` | `hsl(0 0% 2%)` | yes |
| `--color-editor-accent` | `#00F0FF` | `#2563EB` | `hsl(190 100% 60%)` | yes |

#### 4.1.2 Semantic palette (Phase 1)

| Token | Dark default | Light | High-contrast | Managed by theme preset? |
|---|---|---|---|---|
| `--color-brand` | `hsl(190 100% 43%)` | `hsl(190 100% 35%)` | `hsl(190 100% 65%)` | **no — only `index.css` + `.light` + `.high-contrast`** |
| `--color-power` | `hsl(40 95% 55%)` | `hsl(40 95% 42%)` | `hsl(40 100% 65%)` | no |
| `--color-signal` | `hsl(190 100% 60%)` | `hsl(190 100% 38%)` | `hsl(190 100% 70%)` | no |
| `--color-data` | `hsl(270 85% 72%)` | `hsl(270 70% 48%)` | `hsl(270 100% 80%)` | no |
| `--color-warning` | `hsl(45 100% 60%)` | `hsl(45 100% 42%)` | `hsl(45 100% 68%)` | no |
| `--color-success` | `hsl(145 75% 55%)` | `hsl(145 75% 34%)` | `hsl(145 85% 65%)` | no |
| `--color-info` | `hsl(215 90% 70%)` | `hsl(215 85% 45%)` | `hsl(215 100% 78%)` | no |
| `--color-error` | alias → `--color-destructive` | alias | alias | n/a |
| `--color-focus-ring` | `hsl(0 0% 100%)` | `hsl(0 0% 10%)` | `hsl(0 0% 100%)` | no |

**Finding: the theme-preset object is split-brain.** `theme-context.tsx` presets manage 22 core color tokens but do **not** touch the 7 Phase 1 semantic tokens or `--color-focus-ring`. Consequence:

- When the user selects the **Amber** preset, `--color-primary` shifts to `hsl(40 95% 55%)` — which is **exactly the same value as `--color-power`**. Result: every Amber-theme user's app shows "primary interactive emphasis" and "electrical-power semantic" as identical colors. The whole point of the power/primary split collapses.
- When the user selects **Forest**, `--color-primary` shifts to green (`hsl(150 80% 45%)`) — which is close to `--color-success` (`hsl(145 75% 55%)`). Success-vs-active ambiguity re-emerges in that theme.
- **Rose** theme moves `--color-primary` to `hsl(350 85% 58%)` — pink-red — which is visually close to `--color-destructive` (`hsl(0 85% 55%)`). Destructive actions and interactive emphasis become confusable.
- **High-contrast mode rewrites semantic tokens too, but the non-default theme presets do not.** That means a Midnight Purple user in default contrast has `--color-power` still at amber (correct, hue-independent), **but** their `--color-primary` is violet — so active buttons clash chromatically with the power badges in the same view. The semantic-token doc (`tokens.md:315`) explicitly asserts "theme changes may alter mood; they must not erase meaning," but **it doesn't enforce the theme layer updating the semantic layer**.

#### 4.1.3 Theme preset coverage audit

8 theme presets defined in `theme-context.tsx:287-296`: `neon-cyan` (default), `midnight-purple`, `forest`, `amber`, `rose`, `monochrome`, `oled-black`, `light`.

For each:

- All 8 touch the core 22-token palette (good).
- **None of them touch** the 7 semantic tokens. Semantic tokens persist from `index.css` `@theme` for 7/8 dark presets. Only `.light` (applied via a class added by `next-themes`) overrides the semantic tokens; the other 6 alternative dark presets get the default neon-cyan semantic values.

**This means:** unless you're on the default neon-cyan theme, the semantic palette is implicitly miscalibrated for your surfaces. `--color-power` at amber reads fine on near-black, but at `--color-background: hsl(350 20% 4%)` (Rose) it shifts relative, and at `--color-background: hsl(250 30% 4%)` (Midnight Purple) it also shifts. None of these were audited for contrast.

**Remediation idea:** either (a) collapse semantic tokens to a single theme-independent layer with rule "never set `--color-power`, `--color-signal`, etc. in a preset — they are chroma signals, not surface colors," or (b) expand each theme preset to manage all 29 tokens. Currently the system is halfway between the two.

### 4.2 Typography audit — tokens declared vs types used in `DESIGN.md`

`DESIGN.md` front matter declares a 13-role taxonomy:

```
display-hero, display-title, headline-lg, headline-md,
body-lg, body-md, body-sm,
label-md, label-sm-caps,
data-md, data-sm,
kpi-lg
```

`client/src/index.css` declares 8 runtime tokens:

```
--text-h1 (32), --text-h2 (24), --text-h3 (18),
--text-body (14), --text-caption (12),
--text-kpi (48), --text-kpi-md (24), --text-kpi-sm (16),
--leading-dense (1.3), --leading-default (1.5), --leading-reader (1.7),
--case-tracking-caps (0.1em),
```

Missing from runtime:

- `display-hero` and `display-title` → `--text-kpi` (48px) and `--text-h1` (32px) both fit into this slot, but weight/tracking rules differ.
- `headline-lg` and `headline-md` → `--text-h2` (24px) maps to headline-lg, `--text-h3` (18px) to headline-md, but spec rules for line-height, weight, and letter-spacing are not runtime-tokenized.
- `body-lg` (16px) → no token.
- `body-sm` → no token; `--text-caption` (12px) covers the size but not the 0.01em letter-spacing.
- `label-md`, `label-sm-caps` → no tokens; `.case-caps` utility covers the caps+tracking piece of label-sm-caps, but no label sizing scale.
- `data-md`, `data-sm` → no token; `font-mono` does the family but not the tabular-numeral `font-feature-settings: "tnum" 1, "liga" 0` the spec requires.

**Typographic gaps:**

1. No `<Heading>` or `<Text>` primitive exists anywhere in `client/src/components/ui/`. Consumers write raw `<h1 className="text-2xl">` etc. Grep confirms: heading JSX uses inline Tailwind sizes (`text-xl`, `text-2xl`, `text-3xl`) rather than semantic tokens.
2. No `<DataValue>` or `<Mono>` primitive. Every view that displays MPNs / hex IDs / measurements writes `<span className="font-mono">...` manually, without tabular-numeral or ligature policy.
3. No `label-sm-caps` Tailwind utility. The system ships `.case-caps` but does not enforce it; 366 `uppercase` matches across 142 files show most consumers write raw Tailwind `uppercase tracking-wider` rather than the documented utility.
4. Casing-enforcement class `.case-caps` at `@/home/wtyler/Projects/ProtoPulse/client/src/index.css:633-638` is **not referenced anywhere** — 0 consumer adoption (grep confirms). It is a pure documentation artifact right now.

### 4.3 Motion token audit

Three duration tokens (`80ms`, `150ms`, `300ms`) and three easing tokens declared in `@/home/wtyler/Projects/ProtoPulse/client/src/index.css:285-292`.

Reduced-motion is honored two ways:

1. Universal CSS sweep at `@/home/wtyler/Projects/ProtoPulse/client/src/index.css:716-753` under `@media (prefers-reduced-motion: reduce)` — forces `animation-duration: 0.01ms !important; transition-duration: 0.01ms !important;` everywhere. This is belt-and-braces correct.
2. `.reduced-motion` class on `<html>` at `@/home/wtyler/Projects/ProtoPulse/client/src/index.css:755-786` — manual toggle via `ReducedMotionManager`. Identical sweep.

**Consumer adoption of motion tokens:** effectively zero. Grep shows `--motion-duration-*` referenced in 4 files (`index.css` itself + `motion-language.ts` + two test files). Every transition in `ui/*` primitives uses raw `transition` / `transition-all` / `transition-colors` without the tokenized duration. The `Button` uses `motion-reduce:active:scale-100` correctly (`button.tsx:16`), but its own `transition` declaration has no duration override — it gets Tailwind's default 150ms, which coincidentally matches the token, but only by luck.

**Motion primitives that do the right thing:**

- `Button.tsx` — `active:scale-[0.98]` with `motion-reduce:active:scale-100` fallback.
- `InteractiveCard.tsx` — same pattern (`@/home/wtyler/Projects/ProtoPulse/client/src/components/ui/interactive-card.tsx:63`).
- `view-enter` animation honours `prefers-reduced-motion` (`index.css:504-518`).
- `tutorial-highlight` honours reduced motion (`index.css:801-808`).

**Motion primitives that do not:**

- `Tabs.tsx` — uses `transition-all` on TabsTrigger (`tabs.tsx:30`) with no duration cap and no `motion-reduce:` variant. Reduced-motion is fine at the global level, but there's no per-component fallback.
- `Dialog.tsx` — animations come via `data-[state=open]:animate-in` / `animate-out` which honours reduced motion through tw-animate-css (reasonable), but nothing in-component.
- `tooltip.tsx` — `animate-in fade-in-0 zoom-in-95` same as above.

**Finding:** motion tokens are present, reduced-motion is correctly handled globally, but **no consumer surface references the tokens by name**. A future JS consumer that reads `getComputedStyle(root).getPropertyValue('--motion-duration-base')` would get the right value, but that's hypothetical — today nothing reads it.

### 4.4 Radius inventory (per §3.1)

Tailwind v4 `rounded-*` tokens in `@theme` resolve to `0px` for `sm|md|lg|xl|2xl`. Only `rounded-full` remains soft (renders as a pill). The inline `rounded-3xl` has no token override and will fall back to Tailwind's default scale.

| Class | Resolves to | Sample consumers |
|---|---|---|
| `rounded-sm` | 0px | DropdownMenuItem (`dropdown-menu.tsx:87`), Item check glyphs |
| `rounded-md` | 0px | Button, Input, Textarea, Toast, Dialog close, DropdownMenuContent, Tooltip, Select trigger |
| `rounded-lg` | 0px | TabsList, Alert, Sidebar sheet, Dialog `sm:rounded-lg`, EmptyState outer, Empty primitive |
| `rounded-xl` | 0px | Card, ProjectPickerPage facet cards (`rounded-xl`), some view hero blocks |
| `rounded-2xl` | 0px | Rare |
| `rounded-3xl` | **default Tailwind 1.5rem (~24px)** | Not common but not token-overridden |
| `rounded-full` | 9999px | **175 matches / 82 files** — pill badges, avatar dots, status chips, close buttons |

**Three radius concerns survive the token-neutralization story:**

1. **`rounded-full` overuse** — the 175 pill occurrences are the real remaining visual-softness source. This is where `DESIGN.md`'s "pills are the exception" principle is being diluted.
2. **Inline literals bypass the token** — `tutorial-highlight` (`index.css:793`, `border-radius: 4px`), `EmbedViewerPage.tsx` (`borderRadius: '8px'` on node style), skeleton outer shapes, skimmed-from-shadcn remnants.
3. **`rounded-3xl`** is not tokenized and will visually diverge if used. (No heavy consumption in this codebase today, but it's an unguarded hole.)

### 4.5 Spacing tokens

Three card padding tokens at `@/home/wtyler/Projects/ProtoPulse/client/src/index.css:266-268`:

```
--spacing-card-padding-sm: 0.75rem (12px) — ultra-compact data rows
--spacing-card-padding-md: 1rem (16px) — secondary cards
--spacing-card-padding-lg: 1.5rem (24px) — canonical primary cards
```

**Consumer adoption:** effectively zero. `Card.tsx` hard-codes `p-6` (1.5rem) in header/content/footer — it happens to match `--spacing-card-padding-lg` by value but does not reference the token. Every other card-ish surface uses raw `p-3` / `p-4` / `p-5` / `p-6` inline.

`DESIGN.md` spec additionally declares:

- `workspace-header: 80px` — `ProjectWorkspace.tsx` header is literally 80px by being 2×40px rows. Correct.
- `sidebar-min: 180px`, `sidebar-max: 480px` — enforced in shell resize logic.
- `chat-min: 280px`, `chat-max: 600px` — enforced similarly.
- `grid-unit: 20px` — used in CSS `.data-grid { background-size: 20px 20px }` (`index.css:572-577`). Consistent.
- `command-center-columns: "5"` — realized in `ProjectPickerPage.tsx:748` (`lg:grid-cols-5`). Consistent.

### 4.6 Documentation drift map

Four sources of design truth, compared:

| Concept | `DESIGN.md` | `index.css` | `theme-context.tsx` | `design-system-docs.ts` |
|---|---|---|---|---|
| Radius | All 0 except `full: 9999` | All 0 | n/a | says rounded is `0` (via `.chamfer` utilities doc) |
| Focus ring | `#FFFFFF` (palette-indep) | `--color-focus-ring` white/near-black | not present | **still describes ring as brand cyan** |
| Primary | `#00B7DB` cyan | `hsl(190 100% 43%)` cyan | per-preset | cyan |
| Brand | `#00B7DB` cyan | `hsl(190 100% 43%)` cyan alias of primary | not present | treated as cyan |
| Power | `#F9B11F` | `hsl(40 95% 55%)` | not present | not separately listed |
| Typography | 13 roles | 8 tokens | n/a | partial |
| Case policy | Title/sentence/caps | `.case-*` utilities | n/a | partial |

**Drift highlights:**

- `design-system-docs.ts` describes the focus ring as brand cyan, which is **factually stale** against the Phase 9 `--color-focus-ring` reality.
- The typography taxonomy in `DESIGN.md` is not present in `tokens.md` or `index.css` at full fidelity.
- The theme preset system is not present in `DESIGN.md` — the spec implies the neon-cyan dark is canonical, but the runtime ships 7 alternate skins.

### 4.7 Chamfers, corner marks, LED indicators

`index.css` ships several "workbench chrome" utilities that don't appear in `DESIGN.md`:

- `.chamfer`, `.chamfer-sm`, `.chamfer-tr`, `.chamfer-tl` — clip-path polygon corners (`index.css:520-531`).
- `.corner-mark::before/::after` — 6px L-shaped primary-tinted corner cues (`index.css:532-552`).
- `.edge-glow`, `.edge-glow-strong` — box-shadow accents (`index.css:553-562`).
- `.scan-line`, `.data-grid`, `.substrate` — background textures for field surfaces (`index.css:563-581`).
- `.led-on`, `.led-warning`, `.led-error` — 6px LED indicators (`index.css:582-598`).

These are **exactly the product-specific accent utilities that `DESIGN.md`'s "Shapes" section argues for**. They exist, they're cohesive, and they reflect the workbench aesthetic well. The problem is that no primitive or layout surface advertises them; consumers discover them through grep. A brief addition to `design-system-docs.ts` would close the gap.

### 4.8 Scrollbar theming

Global scrollbar styling at `@/home/wtyler/Projects/ProtoPulse/client/src/index.css:641-661` uses `color-mix` with `--color-primary` at 25% / 45% opacity. This is **brand-tinted scrollbars everywhere** — which is a valid stylistic choice for a workbench, but means every scrollable surface in the app carries a cyan signal. On dense data-grid views this adds visual noise.

One specific concern: scrollbar-width is `thin` and scrollbar thumb is 6px. On hover it stays at ~45% primary. On high-contrast mode there is **no scrollbar override** — high-contrast users get the same 25% opacity primary track, which likely fails the 3:1 non-text contrast rule.

---

## 5. Primitive-by-primitive audit

The primitive layer in `client/src/components/ui/` has ~80 files. This audit groups them by function. Each entry reports: **where it lives**, **what it exposes**, **radius / focus / motion / ARIA posture**, and **how it aligns with the token system**. Callouts are keyed with 🔴 (must fix), 🟠 (should fix), 🟡 (nice to tighten), 🟢 (strong — preserve).

### 5.1 Form family

#### `Input` (`client/src/components/ui/input.tsx`)
- **Radius:** `rounded-md` → resolves to 0 in current tokens. Class name drift only.
- **Focus:** `focus-visible:ring-[var(--color-focus-ring)]` + 2px ring + 2px offset. 🟢 correct.
- **Motion:** none referenced. Acceptable for a text input.
- **ARIA:** no baked-in label; consumers must pair with `<Label htmlFor>`. 🟡 The `code-audit-accessibility.md` ledger found multiple unlabeled Input consumers; this is a **consumer problem, not a primitive problem**, but the primitive could emit a DEV warning when used without `aria-label` or `id`.
- **Verdict:** well-tokenized. No action needed.

#### `Textarea` (`client/src/components/ui/textarea.tsx`)
- Mirror of Input. 🟢 correct.

#### `Label` (`client/src/components/ui/label.tsx`)
- Thin wrapper over `@radix-ui/react-label`. No focus-ring story (it's not focusable). Adequate. 🟢

#### `Select` (`client/src/components/ui/select.tsx`)
- **Radius:** `rounded-md` trigger, `rounded-sm` items. Token-neutralized.
- **Focus:** 🔴 `focus:ring-1 focus:ring-ring` on trigger (`select.tsx:22`) — **worst of both worlds**: thinner 1px ring AND the brand-tied `--color-ring` token. Needs migration to `--color-focus-ring` + 2px consistency.
- **Items:** `focus:bg-accent focus:text-accent-foreground` for keyboard focus within the popover — fine for Radix item roving focus.
- **ARIA:** Radix handles most of it; `SelectLabel` is a popover label not a field label. Consumers must still wire `<Label htmlFor>` to the trigger — no enforcement.
- **Verdict:** **priority focus-ring migration target** (high-leverage, single file).

#### `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `Toggle`, `ToggleGroup`
- All use `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` pattern (old token). 🟠 Batch migrate to `--color-focus-ring` as a single Phase 2 PR.
- `Slider` thumb uses `h-5 w-5 rounded-full` — a pill is appropriate here (knob shape). 🟢
- `Switch` uses `rounded-full` on both track and thumb — correct for the pattern. 🟢
- `Toggle` ships `toggleVariants` with `outline` vs `default` variants — both use old focus ring token.

#### `NumberInput` (`client/src/components/ui/number-input.tsx`)
- Custom composite with explicit keyboard spin-button handling (spec says 44×44 touch targets; trimming inputs may be under-sized — worth runtime-checking).
- Uses native `<input type="number">` with ±1 step buttons. Mobile UX would benefit from explicit step granularity override.

#### `InputGroup` (`client/src/components/ui/input-group.tsx`)
- Composite wrapper for prefix/suffix UI. Uses `rounded-md`. Acceptable. 🟢

#### `InputOTP` (`client/src/components/ui/input-otp.tsx`)
- One-time-password entry grid. Uses `rounded-md`, correct focus styling.

#### `Form` (`client/src/components/ui/form.tsx`)
- Wrappers over react-hook-form + Radix providers. Good pattern; the `FormMessage` emits inline validation text. No direct visual tokens.

#### `Field` (`client/src/components/ui/field.tsx`)
- Higher-order field container (label + description + control + error). Not widely consumed. Could be the basis for a **`<FormField>` primitive** enforcing label association, which would close ~12 of the 2026-02-27 unlabeled-input findings.

### 5.2 Feedback family

#### `Alert` (`client/src/components/ui/alert.tsx`)
- **Radius:** `rounded-lg` → 0.
- **Variants:** `default`, `destructive`. 🟠 **missing `warning`, `success`, `info` variants** despite tokens existing for all three. Consumers that want a warning alert either roll their own (`text-amber-500 border-amber-500/30`) or misuse `destructive`. A 20-minute variant addition here would unlock dozens of call-site improvements.
- **ARIA:** `role="alert"` baked in (`alert.tsx:28`). 🟢
- **Icon slot:** first `<svg>` absolutely positioned. Good.

#### `AlertDialog` (`client/src/components/ui/alert-dialog.tsx`)
- Radix-primitive-wrapped. Focus trap automatic. `rounded-lg` → 0. `AlertDialogAction` and `AlertDialogCancel` inherit Button styling. 🟢

#### `Toast`, `Toaster`, `Sonner`
- Already documented in v1. Ships variants: `default`, `destructive`, `success`, `warning`, `info`. But:
  - 🟠 `success` is hard-coded to `emerald-500`, `warning` to `amber-500`, `info` to `primary` — **none reference the new `--color-success` / `--color-warning` / `--color-info` tokens**. The variants are semantically correct; the colors are out-of-system.
  - `ToastAction` uses `focus:ring-ring` (old token).
  - `Sonner` is a parallel toast stack via `sonner` library — having **two toast systems** in the same app is a real UX inconsistency. Which one should a consumer pick? No doc-level answer.

#### `TrustReceiptCard` (`client/src/components/ui/TrustReceiptCard.tsx`)
- Well-designed, semantic status slots (`ready | setup-required | caution | experimental`). 🟢 gold standard.

#### `ConfidenceBadge`, `LifecycleBadge`, `FeatureMaturityBadge`, `ReleaseConfidenceCard`
- Product-specific signal badges. Each codifies meaning cleanly.
- 🟠 Color consistency across the four is not audited — each likely has its own amber/green/red literals rather than converging on `--color-warning` / `--color-success` / `--color-destructive`.

### 5.3 Layout family

#### `Card` (`client/src/components/ui/card.tsx`)
- **Radius:** `rounded-xl` → 0. Name drift.
- **Shadow:** has default `shadow` — 🟠 mild spec contradiction since `DESIGN.md` says "Prefer borders over shadows." Shadow is subtle in dark themes, but it's still not a nothing.
- **Padding:** hard-coded `p-6` on header/content/footer. Matches `--spacing-card-padding-lg` by value, but **does not reference the token**. No `size="sm" | "md" | "lg"` variant to select the three spacing tokens.

#### `InteractiveCard` (`client/src/components/ui/interactive-card.tsx`)
- 🟢 gold standard. Real `<button>`, correct focus ring, tactile active + reduced motion fallback, resets native button chrome.
- Adopting this everywhere a `role="button"` div currently lives closes a large swath of a11y findings.

#### `Sheet` (`client/src/components/ui/sheet.tsx`)
- Side-panel drawer over Radix Dialog. `rounded-md` on close button. Close button uses `focus:ring-2` (old token). 🟠
- Variants for top/bottom/left/right. Good.

#### `Dialog` (`client/src/components/ui/dialog.tsx`)
- Close button at `dialog.tsx:45` uses `focus:ring-ring` (old token). 🟠
- `sm:rounded-lg` on content — name drift only.
- Overlay is `bg-black/80` — a 20% opacity black over underlying content. Acceptable for default dark, but may visually fail to separate in high-contrast mode.

#### `Drawer` (`client/src/components/ui/drawer.tsx`)
- Vaul-based bottom drawer. Primarily mobile. Correct handling of gesture + keyboard.

#### `Resizable` (`client/src/components/ui/resizable.tsx`)
- Panel resize handles via `react-resizable-panels`. The shell-level `ResizeHandle` in `ProjectWorkspace.tsx` is custom but wraps similar behavior.
- Keyboard support for resize is **missing** in the shell handle (per 2026-02-27 audit #254). 🟠

#### `ScrollArea` (`client/src/components/ui/scroll-area.tsx`)
- Radix ScrollArea wrapper. Good. Inherits global scrollbar theme from `index.css`.

#### `Separator` (`client/src/components/ui/separator.tsx`)
- Thin `bg-border` line. Correct.

#### `AspectRatio` (`client/src/components/ui/aspect-ratio.tsx`)
- Trivial 6-line wrapper. No concerns.

#### `Accordion` (`client/src/components/ui/accordion.tsx`)
- Radix accordion. Uses `focus-visible:ring-2 focus-visible:ring-ring` (old token) on triggers. 🟠

#### `Collapsible` (`client/src/components/ui/collapsible.tsx`)
- 11-line passthrough.

#### `Tabs` (`client/src/components/ui/tabs.tsx`)
- **Radius:** `rounded-lg` list, `rounded-md` trigger → 0.
- **Focus:** 🔴 both TabsTrigger and TabsContent use `focus-visible:ring-ring` (old token). High-leverage migration target.
- **Active state:** `data-[state=active]:bg-background data-[state=active]:shadow` — uses shadow for hierarchy. Spec says borders preferred. 🟠
- **Motion:** `transition-all` without `motion-reduce:` override. Global CSS sweep catches it, but per-component fallback is missing. 🟡

#### `Table` (`client/src/components/ui/table.tsx`)
- Thin wrapper, `w-full text-sm` + `border-collapse` etc. No tokenized density modes. Spec `data-dense` leading vs `data-default` leading is unmet. 🟠

#### `Sidebar` (shadcn primitive at `client/src/components/ui/sidebar.tsx`)
- Large file (~22KB). Cookie-based state, Ctrl+B keyboard shortcut, mobile Sheet integration, icon variant.
- `SIDEBAR_WIDTH = "16rem"` hard-coded — diverges from `DESIGN.md`'s `sidebar-min: 180px / sidebar-max: 480px`. The app does not actually use this primitive for the project sidebar — it uses a custom `components/layout/Sidebar.tsx`. 🟡 The shadcn sidebar is dead-ish code if the app doesn't consume it.
- Uses `focus-visible:ring-ring`.

### 5.4 Navigation family

#### `Breadcrumb` (`client/src/components/ui/breadcrumb.tsx`)
- Semantic `<nav aria-label="breadcrumb">` + `<ol>`. Good accessibility. 🟢
- `BreadcrumbPage` carries `aria-current="page"` — correct.
- Used by `WorkflowBreadcrumb` in shell — see §6.2.4.

#### `Pagination` (`client/src/components/ui/pagination.tsx`)
- Semantic `<nav aria-label="pagination">`. Uses `Button` primitive for items. 🟢
- Current-page treatment uses `aria-current="page"`.

#### `Menubar`, `NavigationMenu`, `ContextMenu`
- All Radix-wrapped. All use old `ring-ring`. 🟠 Batch migrate.

#### `DropdownMenu` (`client/src/components/ui/dropdown-menu.tsx`)
- No explicit focus ring on items (relies on `focus:bg-accent focus:text-accent-foreground`). That is acceptable for a menu popover since item focus is signaled by background, not by outline. 🟢
- Active submenu / checked item uses `data-[state=open]:bg-accent`. Correct.

#### `Command` + `CommandPalette`
- Command palette is a product-specific file, not `cmdk` primitive. Audited in §6.2.6.

#### `GlobalSearchDialog` (`client/src/components/ui/GlobalSearchDialog.tsx`)
- Search modal over Dialog. Standard.

### 5.5 Overlay / assist family

#### `HoverCard` (`client/src/components/ui/hover-card.tsx`)
- Radix wrapper. Fine.

#### `Popover` (`client/src/components/ui/popover.tsx`)
- Radix wrapper. Fine. Used by `MobileNav` secondary popover.

#### `Tooltip` (`client/src/components/ui/tooltip.tsx`)
- 🔴 **Uses `bg-primary text-primary-foreground`** — brand cyan background. This is the §3.6 finding:
  - Violates the brand / primary / info semantic split the token system argues for.
  - Makes every tooltip in the app compete visually with active-state cyan.
  - Should be `bg-popover text-popover-foreground` at minimum, or move to the `--color-info` family.
- **Fix size:** single-line, one file, zero consumer-code changes (every tooltip consumer flows through this primitive). High leverage.

#### `StyledTooltip` (`client/src/components/ui/styled-tooltip.tsx`)
- Second tooltip system. Parallel to `Tooltip`. 🟡 Having two tooltip primitives with different styling is another unresolved tooltip-family split. Pick one.

#### `LessonModeOverlay`, `TutorialOverlay`, `TutorialMenu`, `WelcomeOverlay`, `FirstRunChecklist`, `ShortcutsOverlay`, `keyboard-shortcuts-modal`, `WhatsNewPanel`, `ViewOnboardingHint`, `SmartHintToast`, `RadialMenu`
- All are pedagogy surfaces. Each is discoverable independently, which is good, but the family has no shared container primitive. 🟠 If ProtoPulse wanted a `<PedagogyScrim>` primitive, these are the natural children.
- **Tutorial highlight** uses inline `border-radius: 4px` (`index.css:793`) — bypasses radius tokens. 🟠
- **RadialMenu** is the bespoke circular action picker. Tested (`RadialMenu.test.tsx`), uses Framer Motion. Key-accessible.

### 5.6 Data-display family

#### `Badge` (`client/src/components/ui/badge.tsx`)
- **Radius:** `rounded-md` → 0. Good.
- **Focus:** 🔴 uses `focus:ring-ring` (old token). High-traffic primitive — 100+ consumer files.
- **Variants:** `default`, `secondary`, `destructive`, `outline`. 🟠 **Missing `warning`, `success`, `info`** despite tokens existing. Every consumer that shows a status badge writes `bg-amber-500/15 text-amber-300` or similar literals.

#### `MentionBadge` (`client/src/components/ui/MentionBadge.tsx`)
- Product-specific `@mention` chip. Uses `rounded-full`, correct for this semantic.

#### `Avatar` (`client/src/components/ui/avatar.tsx`)
- Radix avatar wrapper. Uses `rounded-full`. Correct for the pattern.

#### `Progress` (`client/src/components/ui/progress.tsx`)
- Thin Radix progress wrapper. `bg-primary` on indicator — uses primary for progress fill, which is reasonable.

#### `Spinner`, `Skeleton`
- `Spinner`: 🟢 correct (role="status", aria-label="Loading", small, motion-respecting via global reduced-motion).
- `Skeleton`: uses `rounded-md bg-primary/10 animate-pulse`. 🟠 Brand-tinted skeleton — every loading surface in the app shimmers cyan. Consider `bg-muted` instead so skeletons read as neutral placeholder chrome rather than brand chrome.

#### `PanelSkeleton`, `ProjectLoadingSkeleton`
- Both consume `Skeleton`. `ProjectLoadingSkeleton` specifically matches the three-panel workbench layout. 🟢 good product-fit.

#### `Chart` (`client/src/components/ui/chart.tsx`)
- Recharts wrapper with theme token piping. Complex but well-composed.

#### `Calendar` (`client/src/components/ui/calendar.tsx`)
- React Day Picker wrapper. Uses `focus-visible:ring-ring`. 🟠 migration target.
- `rounded-md` on day cells — 0 in runtime.

#### `Carousel` (`client/src/components/ui/carousel.tsx`)
- Embla wrapper. `rounded-full` on navigation buttons — acceptable.

#### `Kbd` (`client/src/components/ui/kbd.tsx`)
- Tiny `<kbd>` chip style. Uses `font-mono bg-muted border border-border rounded px-1 py-px`. 🟢 correct posture.

### 5.7 Content / vault family

#### `VaultHoverCard` (`client/src/components/ui/vault-hover-card.tsx`)
- Slug-based hover card over `qmd`. Well-designed progressive-disclosure primitive. 🟢
- Uses `rounded-md` container. Token-neutralized.
- Tested independently.

#### `VaultExplainer` (`client/src/components/ui/vault-explainer.tsx`)
- Audience-tiered explainer panel (beginner / intermediate / expert). Strong pedagogy pattern. 🟢

#### `VaultInfoIcon` (`client/src/components/ui/vault-info-icon.tsx`)
- `Info` icon linked to vault slug. Trivial.

#### `DatasheetLink` (`client/src/components/ui/DatasheetLink.tsx`)
- `<a>` with external-link icon and hover state. Small and correct.

#### `UnifiedComponentSearch` (`client/src/components/ui/UnifiedComponentSearch.tsx`)
- Part search combobox — large composite. Accessibility has some gaps flagged in the 2026-02-27 audit (medium: search input unlabeled).

#### `LibrarySuggestPopover`, `AddToBomPrompt`, `CalcApplyButtons`
- All are domain-specific composites. Acceptable. No specific red flags beyond the shared `ring-ring` adoption gap.

### 5.8 Interactive-composite family

#### `Button` (`client/src/components/ui/button.tsx`)
- 🟢 gold standard. Correct focus ring, tactile active states with reduced-motion fallback, sensible `type="button"` default. Variants: `default | destructive | outline | secondary | ghost | link`. 🟠 **Missing `warning` / `success` / `info`** — same pattern as Badge / Alert. Those variants would be 5-minute adds.

#### `ButtonGroup` (`client/src/components/ui/button-group.tsx`)
- Thin wrapper for button clusters. Correct.

#### `EmbedDialog` (`client/src/components/ui/EmbedDialog.tsx`)
- Embed-snippet generator. Uses `rounded-md` and `focus:ring-ring`. Acceptable.

#### `ShareProjectButton`
- Product-specific share action. Uses its own `rounded-full` pill design. Acceptable as a special-case chip.

#### `ExplainPanelButton`
- "Explain this panel" trigger. Good UX.

#### `PredictionCard`, `PredictionPanel`
- AI prediction surfaces. Both heavily overlay / floating. Use `rounded-xl` → 0, `rounded-full` for close buttons. Acceptable.

#### `RolePresetSelector`
- Dropdown-style segmented control for role-based preset selection.

#### `theme-toggle` (`client/src/components/ui/theme-toggle.tsx`)
- Icon-only `Button variant="ghost" size="icon"` with `aria-label` toggle between moon/sun. 🟢 a11y-correct.
- Does not expose a theme picker — only toggles between light and last-used dark. Full preset picker lives in `components/panels/ThemePickerPanel.tsx`.

### 5.9 Two `Empty*` primitives — pick one

Two concurrent implementations:

- `client/src/components/ui/empty.tsx` — shadcn-native composition: `Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyContent`, `EmptyMedia`. Uses `border-dashed` + `rounded-lg`. Accepts arbitrary children. Flexible.
- `client/src/components/ui/EmptyState.tsx` — product-specific: takes `icon: LucideIcon`, `title`, `description`, `actionLabel`, `onAction`. Uses `rounded-lg bg-primary/10` + brand-tinted icon tile. Emits a `<button>` with **old `focus:ring-ring`** (line 38).

🔴 **Pick one and kill the other.** Current state: inconsistent empty-state aesthetic across views, and `EmptyState` carries an out-of-migration focus ring. Recommendation: keep `EmptyState` (more ProtoPulse-authored), delete `empty.tsx`, migrate `EmptyState` to the new focus ring + optional dashed border variant.

### 5.10 Primitive-level findings summary

| Severity | Count | Representative examples |
|---|---|---|
| 🔴 Must fix | 4 | `Tooltip` brand-cyan bg, `Tabs` + `Badge` + `EmptyState` focus-ring adoption, duplicate `Empty*` |
| 🟠 Should fix | ~15 | Alert/Badge/Button missing warning/success/info variants, Select 1px ring + old token, Skeleton brand-tinted, Table density tokens, AlertDialog close + Dialog close focus ring, Sonner/Toast duplication, dual Tooltip, Sheet close ring, Accordion trigger ring |
| 🟡 Nice to tighten | ~10 | Tabs `transition-all` without motion-reduce, StyledTooltip vs Tooltip consolidation, shadcn `sidebar.tsx` dead code, Input/Textarea DEV-warn on unlabeled use |
| 🟢 Preserve | 9 | `Button`, `InteractiveCard`, `Input`, `Textarea`, `Spinner`, `TrustReceiptCard`, `Breadcrumb`, `Pagination`, `VaultHoverCard` + `VaultExplainer` |

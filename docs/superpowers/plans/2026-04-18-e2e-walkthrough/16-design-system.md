# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Turn Pass 13's design findings (E2E-968 through E2E-1042) into a disciplined design token + primitive system so every downstream per-tab plan consumes the SAME card, button, input, toast, empty-state, trust-receipt, and animation tokens. Eliminate the cross-tab inconsistency that makes ProtoPulse feel like 14 apps. Deliver the `ConfidenceEvaluator` service so confidence labels can no longer self-contradict (E2E-485 / E2E-547).

**Architecture:** Seven primitive layers shipped in order: (1) color/typography/spacing/motion tokens, (2) Button + InteractiveCard + Input + Pill/Chip semantic variants, (3) EmptyState + LoadingSkeleton + Toast4-variant + Trust Receipt + Gated AI Button, (4) WorkspaceShell 3-zone canvas layout, (5) ConfidenceEvaluator service + schema, (6) Animation primitives honoring `prefers-reduced-motion`, (7) Storybook. Each layer lands behind a failing test before expansion.

**Tech Stack:** Tailwind CSS v4 (critical: `@theme` NOT `@theme inline` — see `01-p0-bugs.md` Phase 6), CSS custom properties, Radix UI primitives, `tw-animate-css`, Storybook (to add), class-variance-authority (already via shadcn), tailwind-merge.

**Parent:** `00-master-index.md` §3.1 (Pass 13 rerouting), §4.3 (multi-owner on E2E-303 gating primitive, E2E-485/547 confidence, E2E-487 learning-hub merge).

**Tier:** C (Foundation). **Depends on:** `01-p0-bugs.md` (Phase 6 light-mode fix is the gate — without `@theme inline → @theme` migration, tokens cannot react to theme changes). **Blocks:** every per-tab plan (Tier D-G).

**Parallelizable with:** `17-shell-header-nav.md` (different files — shell owns `WorkspaceHeader.tsx`, `Sidebar.tsx`, etc. while 16 owns primitive components).

---

## Coverage

### All Pass 13 findings (E2E-968 → E2E-1042) — 75 IDs

| E2E | Severity | Summary | Phase |
|-----|---|---|---|
| E2E-968 | P1 → P0 (handled by 01) | Light-mode broken | *01 Phase 6* |
| E2E-969 | design | 6 semantic colors, no documented palette | 1 |
| E2E-970 | design | Cyan used for active + brand — nothing stands out | 1 |
| E2E-971 | design | Power = amber (Architecture), amber (Validation), red (Layer Stack) — clashes | 1 |
| E2E-972 | IDEA | Adopt `--color-primary/--color-warning/--color-power/--color-signal/--color-data` tokens | 1 |
| E2E-973 | design | Yellow-tinted bg only used in one Validation zone | 1 |
| E2E-974 | a11y | Amber on zinc-900 ~4.2:1 — AA pass, AAA fail | 1 (doc cite) |
| E2E-975 | design | Hide broken light-mode toggle OR ship it | *01 Phase 6* |
| E2E-976 | design | h1/h2/h3 inconsistent across tabs | 2 |
| E2E-977 | design | ALL CAPS vs title case vs sentence case inconsistent | 2 |
| E2E-978 | design | KPI sizes vary: Dashboard 36px vs Procurement 18px | 2 |
| E2E-979 | IDEA | 3-tier kpi-xl/kpi-md/kpi-sm scale | 2 |
| E2E-980 | design | Line-height varies vault 1.4× / validation 1.7× | 2 |
| E2E-981 | design | No monospace for MPN / hex / paths | 2 |
| E2E-982 | design | "Design workspace" vs "Bill of Materials" — pick one case | 2 |
| E2E-983 | design | Top toolbar 2-3px gaps → widen to 8px + dividers | *17 Phase 1* (listed for cross-ref) |
| E2E-984 | design | Asset Library 240px fixed | 3 (layout tokens) + *17* (shell) |
| E2E-985 | design | Card padding 16 vs 24px — pick one | 3 |
| E2E-986 | design | Tab strip 6px gap — too tight | *17* |
| E2E-987 | design | Empty-state varies across tabs | 4 |
| E2E-988 | design | Layouts inconsistent — no shared pattern | 4 (shell) |
| E2E-989 | design | AI panel 24px rotated strip — hard to find | *17* |
| E2E-990 | design | Header 60px too dense — 80px 2-row | *17* |
| E2E-991 | IDEA | 3-zone canvas convention | 4 (WorkspaceShell) |
| E2E-992 | design | Tabs + breadcrumb compete | *17* |
| E2E-993 | design | Icons are Lucide (good) but unlabeled | *17 + 03* |
| E2E-994 | design | Emoji icons mixed with line-art | 5 (icon audit) |
| E2E-995 | design | Icon sizes 14-20px — unify to 16 | 5 |
| E2E-996 | IDEA | "show labels" preference | *17* |
| E2E-997 | design | No favicon/brand mark in header | *17* |
| E2E-998 | ✅ | Cards consistent rounded-md + border — good | 3 (pattern shipped) |
| E2E-999 | design | Pills/chips: some filled some outlined — unify | 3 |
| E2E-1000 | design | Buttons inconsistent — adopt primary/secondary/tertiary/destructive | 3 |
| E2E-1001 | design | Disabled states vary — pick ONE treatment | 3 |
| E2E-1002 | ✅ | Trust receipt = best component — replicate | 4 |
| E2E-1003 | design | Empty states vary wildly | 4 |
| E2E-1004 | IDEA | Canonical empty-state component | 4 (already shipped in `03-a11y-systemic.md` Phase 8 — this plan consumes) |
| E2E-1005 | design | `panel-skeleton` has no label | 4 (LoadingSkeleton) |
| E2E-1006 | design | Lazy loads with no loading state feel broken | 4 |
| E2E-1007 | IDEA | 2-stage loading (skeleton 300ms → label after 3s) | 4 |
| E2E-1008 | design | Alternates/Part Usage error ugly (already P0 in 01) | *01 Phase 2* |
| E2E-1009 | design | Toasts pile up — add auto-dismiss | 4 |
| E2E-1010 | IDEA | 4 toast types with icons + auto-dismiss | 4 |
| E2E-1011 | ✅ | Wire/Schematic tool active state best-in-class — replicate | 6 |
| E2E-1012 | design | Icon-only header buttons have no hover state | 3 (Button primitive) + *17* |
| E2E-1013 | a11y | Focus ring cyan-on-cyan low contrast | *03 Phase 9* |
| E2E-1014 | design | No pressed/active state on buttons | *03 Phase 9* |
| E2E-1015 | design | No animations — instant transitions | 6 |
| E2E-1016 | IDEA | 100/200/300ms motion tiers + prefers-reduced-motion | 6 |
| E2E-1017 | ✅ | Dialog + popover consistent design — good | 4 |
| E2E-1018 | design | Popover anchor flip responsive | 4 (Popover wrapper) |
| E2E-1019 | design | Popover heading sizes 14 vs 16 | 2 |
| E2E-1020 | ✅ | Explain panel RELATED links — good | 4 |
| E2E-1021 | design | Mode picker visually clean but no mode delivers UI difference | *17 + product* |
| E2E-1022 | design | Header 34 elements in 60px | *17* |
| E2E-1023 | design | Project name chevron tiny | *17* |
| E2E-1024 | design | "Need board profile" + "Saved + restore" + Student mode visually compete | *17* |
| E2E-1025 | IDEA | Header 80px 2-row layout | *17* |
| E2E-1026 | design | "Show chat" click has no visible change | *17* |
| E2E-1027 | IDEA | AI panel needs explicit close (X) | *17* |
| E2E-1028 | design | Each tab has own personality — no ProtoPulse identity | 4 (shell) |
| E2E-1029 | IDEA | Workspace Shell concept | 4 |
| E2E-1030 | design | Tab strip icons too tiny (14px) | *17* |
| E2E-1031 | ✅ | Dark cyberpunk aesthetic is distinctive — preserve | 1 |
| E2E-1032 | design | Cyberpunk is fragile — stricter style guide | 7 (Storybook) |
| E2E-1033 | IDEA | Optional high-vibe theme (CRT bloom / scan-lines) | 7 |
| E2E-1034 | design | Mobile 32-icon header overflow | *17 mobile* |
| E2E-1035 | design | Cards 2-col should stack ≤640/768 | 3 |
| E2E-1036 | IDEA | Compact breakpoint at 1280px | *17* |
| E2E-1037 | P0 | Light-mode broken | *01 Phase 6* |
| E2E-1038 | ✅ | Replicate trust receipt pattern | 4 |
| E2E-1039 | ✅ | Replicate hotkey-in-label pattern | 3 (Button variant) |
| E2E-1040 | ✅ | Replicate closed-loop Calculator→BOM pattern | 5 + per-tab |
| E2E-1041 | ✅ | Replicate disabled-with-reason tooltip pattern | 3 (Button primitive) |
| E2E-1042 | ✅ | Replicate MOC count badge pattern | 3 (Pill/Chip variant) |

### Cross-cutting adoptions (not original Pass 13)

| E2E | Origin | Reason in this plan |
|-----|--------|---|
| E2E-303 | Pass 1 | AI buttons enabled w/o API key — ship `<GatedAIButton>` primitive | 5 |
| E2E-485 | Pass 2 | Confidence labels contradict | 5 (ConfidenceEvaluator) |
| E2E-547 | Pass 3 | Single confidence-evaluator service | 5 |
| E2E-489 | Pass 2 | Trust receipt replicated to more tabs | 4 |
| E2E-490 | Pass 2 | Card → BOM pattern universal | 5 |
| E2E-491 | Pass 2 | Color taxonomy untaught | 1 (docs) |
| E2E-555 | Pass 3 | Use Lucide Star / StarOff pattern | 3 |

**Count:** 75 Pass 13 IDs covered in-plan or explicitly cross-routed, plus 7 cross-cutting. All 943 master audit IDs map to a sub-plan.

## Existing Infrastructure (verified 2026-04-18)

| Concern | Files | Notes |
|---------|---|---|
| Tailwind v4 | `tailwindcss@^4.2.2` | Uses `@theme` in CSS — `@theme inline` is the light-mode bug (01 Phase 6 fix is prereq) |
| Token source | `client/src/index.css:4-48` | `@theme inline { --color-... }` block — this plan migrates to non-inline + adds `--color-power/signal/data` etc. |
| Font stack | `client/src/index.css:8-11` | Rajdhani (display), JetBrains Mono (mono), Inter (sans) — monospace exists, just unused |
| Theme presets | `client/src/lib/theme-context.tsx:55-296` | 8 presets all inline — need migration to token pattern |
| shadcn/ui components | `client/src/components/ui/` | Button, Card, Dialog, Popover, Tooltip, Toast — cva-based variants |
| Radix UI | `@radix-ui/react-*` | 20+ packages present |
| Animation utility | `tw-animate-css` | Imported at `index.css:2` — used for Radix motion |
| Loading skeleton | reference `panel-skeleton` in audit | Grep to locate current impl |
| Toast | `@radix-ui/react-toast` + shadcn | Sonner also present via `components/ui/sonner.tsx` |
| Storybook | NOT installed | Phase 7 adds it |

## Research protocol

- **Context7** `tailwindcss` v4 — `query-docs "@theme vs @theme inline semantics; @custom-variant dark"`
- **Context7** `class-variance-authority` — `query-docs "pattern for semantic button variants primary/secondary/tertiary/destructive"`
- **Context7** `@radix-ui/react-toast` vs `sonner` — pick one; `query-docs` each to compare auto-dismiss API
- **Context7** `storybook` v8+ — `query-docs "vite-plugin setup for Tailwind v4"`
- **WebSearch** "WCAG 2.1 color contrast 4.5:1 — amber on dark zinc-900" — confirm E2E-974 finding
- **WebSearch** "Design tokens semantic naming — Material Design 3 role-based palette" — inform §1
- **Codebase** `rg "bg-muted|bg-card|bg-primary" client/src | wc -l` — scale of token-consumer refactor
- **Advisor** call before Phase 1 (token structure is foundational — one bad choice cascades), before Phase 5 (ConfidenceEvaluator contract), before Phase 7 (Storybook stack choice).

---

## Phase 1 — Design tokens (colors) (E2E-969, E2E-970, E2E-971, E2E-972, E2E-973, E2E-1031, E2E-491)

Prereq: `01-p0-bugs.md` Phase 6 merged (else tokens don't react).

- [ ] **Task 1.1 — `advisor()` token taxonomy**

Propose:

```
UI-state roles:   primary / secondary / accent / muted / destructive / warning / success / info / ring / border / background / foreground / card / popover / sidebar
Domain roles:     power / signal / data / ground / analog / digital / passive / active
Surface layers:   surface-1 / surface-2 / surface-3 (for card depth)
```

Advisor to validate this won't collide with Radix/shadcn conventions.

- [ ] **Task 1.2 — Migrate `index.css:4` from `@theme inline` to `@theme`**

(Already done in `01-p0-bugs.md` Phase 6 — this task is the verification step.)

- [ ] **Task 1.3 — Add domain-role tokens**

```css
@theme {
  /* existing UI-state tokens — kept */

  /* Domain roles — applied in Architecture/Schematic/PCB component styling */
  --color-power: hsl(40 95% 55%);     /* amber */
  --color-signal: hsl(190 100% 43%);  /* cyan */
  --color-data: hsl(270 90% 65%);     /* purple */
  --color-ground: hsl(0 0% 40%);      /* grey */
  --color-analog: hsl(150 80% 45%);   /* green */
  --color-digital: hsl(220 80% 60%);  /* blue */
}
```

- [ ] **Task 1.4 — Replace hardcoded literals in `index.css` utility blocks**

`rg "hsl\\(" client/src/index.css` — migrate every literal to `var(--color-*)` using the new token taxonomy. Per-file count expected: 30-60 replacements.

- [ ] **Task 1.5 — Codebase migration: consume domain-role tokens in canvas components**

```
Team: "design-tokens-domain-consume"
Members: 3
File ownership:
  Member A: client/src/components/views/ArchitectureView.tsx + SchematicView.tsx (category badges use --color-power/signal/data)
  Member B: client/src/components/circuit-editor/* (PCB layer stack uses domain tokens)
  Member C: client/src/components/views/ValidationView.tsx + LifecycleDashboard.tsx
```

- [ ] **Task 1.6 — Visual regression Playwright**

Screenshot diff across 14 tabs before + after. Accept diffs that fit the new token taxonomy; reject any that introduce visual regressions outside domain-role sites.

- [ ] **Task 1.7 — Commit docs**

Create `docs/design-system/color-tokens.md` documenting every token + its intended use. Blocks future drift (E2E-491).

---

## Phase 2 — Typography + spacing tokens (E2E-976 → E2E-982, E2E-985, E2E-1019)

- [ ] **Task 2.1 — Define scale**

Add to `index.css`:

```css
@theme {
  /* Type scale */
  --text-kpi-xl: 3rem;   /* 48px — hero stats */
  --text-kpi-md: 1.5rem; /* 24px — card stats */
  --text-kpi-sm: 1rem;   /* 16px — inline counts */
  --text-display-h1: 2rem;
  --text-display-h2: 1.5rem;
  --text-display-h3: 1.125rem;

  /* Leading */
  --leading-dense: 1.3;
  --leading-default: 1.5;
  --leading-reader: 1.7;

  /* Spacing tiers */
  --space-card-pad: 1.5rem;   /* 24px canonical card padding — E2E-985 */
  --space-card-pad-compact: 1rem;
}
```

- [ ] **Task 2.2 — Create `<Heading>` primitive**

```tsx
// client/src/components/ui/heading.tsx
const variants = cva('font-display tracking-tight text-foreground', {
  variants: {
    level: {
      h1: 'text-[length:var(--text-display-h1)]',
      h2: 'text-[length:var(--text-display-h2)]',
      h3: 'text-[length:var(--text-display-h3)]',
      kpiXl: 'text-[length:var(--text-kpi-xl)] font-semibold tabular-nums',
      kpiMd: 'text-[length:var(--text-kpi-md)] font-semibold tabular-nums',
      kpiSm: 'text-[length:var(--text-kpi-sm)] font-medium tabular-nums',
    },
  },
});
```

- [ ] **Task 2.3 — Casing policy**

Pick sentence case globally (per Nielsen Norman Group research: faster to read, less shouting). Document in `docs/design-system/copy-style.md`. Remove ALL-CAPS uses in index.css + components.

- [ ] **Task 2.4 — Monospace for technical strings**

Create `<Mono>` primitive. Consumers: MPN fields, hex IDs, file paths, UUIDs in Inspector panels.

- [ ] **Task 2.5 — jest-axe + Storybook stories + commit**

---

## Phase 3 — Button / Input / Card / Pill primitives (E2E-999, E2E-1000, E2E-1001, E2E-1039, E2E-1041, E2E-1042, E2E-555, E2E-1035)

- [ ] **Task 3.1 — Button semantic variants with cva**

```tsx
const buttonVariants = cva(base, {
  variants: {
    variant: {
      primary:    'bg-primary text-primary-foreground hover:bg-primary/90',
      secondary:  'bg-secondary text-secondary-foreground hover:bg-secondary/90',
      tertiary:   'bg-transparent text-foreground hover:bg-muted',
      outline:    'border border-border bg-transparent hover:bg-muted',
      destructive:'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      ghost:      'bg-transparent hover:bg-muted',
      link:       'underline-offset-4 hover:underline',
    },
    size: { sm: '...', md: '...', lg: '...', icon: '...' },
    loading: { true: 'opacity-80 pointer-events-none' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});
```

Hotkey-in-label pattern (E2E-1039):

```tsx
<Button hotkey="V">Select</Button>
// renders: "Select (V)" with hotkey bound via useHotkeys
```

Disabled-with-reason (E2E-1041):

```tsx
<Button disabled disabledReason="Add a component to enable">Push to PCB</Button>
// renders tooltip on hover explaining why
```

- [ ] **Task 3.2 — InteractiveCard already shipped (03 Phase 3)**

Consume in 16 — no re-implementation. Add `<Card.KPI>` sub-component using `<Heading level="kpiXl">` from Phase 2.

- [ ] **Task 3.3 — Pill/Chip primitive**

```tsx
<Pill variant="solid" tone="primary">DIP</Pill>
<Pill variant="outline" tone="warning">Candidate</Pill>
<Pill variant="soft" tone="power" count={12}>Power</Pill>  // MOC badge pattern (E2E-1042)
```

- [ ] **Task 3.4 — Star / StarOff consistent (E2E-555)**

```tsx
<FavoriteToggle filled={isFav} onToggle={toggleFav} />
// Uses Lucide Star (filled) / StarOff (outline)
```

- [ ] **Task 3.5 — Migrate all button callsites**

Dispatch `/agent-teams` with 4 members; each owns a subtree of `client/src/components`. Grep `<Button` on each subtree; ensure all calls use a `variant` prop (default is `primary`).

- [ ] **Task 3.6 — Storybook stories + tests + commit**

---

## Phase 4 — Feedback primitives: EmptyState, LoadingSkeleton, Toast, TrustReceipt, Dialog/Popover responsive (E2E-1003-1010, E2E-1017-1020, E2E-989, E2E-1038)

- [ ] **Task 4.1 — EmptyState consumed from 03 Phase 8**

- [ ] **Task 4.2 — LoadingSkeleton with 2-stage behavior (E2E-1005-1007)**

```tsx
<LoadingSkeleton>
  {/* 0-300ms: shimmer */}
  {/* 300ms-3s: shimmer with aria-label="Loading BOM" */}
  {/* 3s+: add visible "Still loading…" text */}
</LoadingSkeleton>
```

- [ ] **Task 4.3 — Toast 4-variant (E2E-1009, E2E-1010)**

Migrate from dual sonner+Radix to ONE (pick Sonner — cleaner API, better RN-compat future). Variants: success/info/warning/error. 5s auto-dismiss default. Dismissed-toast history accessible from a notification icon (wired by `17-shell-header-nav.md`).

- [ ] **Task 4.4 — TrustReceipt primitive (E2E-1002, E2E-1038)**

```tsx
<TrustReceipt
  status="setup-required"
  tone="warning"
  title="Arduino readiness"
  badges={[{ label: 'Profile required', tone: 'warning' }, { label: 'SETUP REQUIRED', tone: 'warning-solid' }]}
  fields={[{ label: 'Board', value: 'None' }, { label: 'Port', value: 'Not selected' }]}
  caveats={['Pick a board profile before compiling', 'Connect via USB before uploading']}
  nextStep={{ label: 'Pick profile', onClick: openBoardPicker }}
/>
```

Consumers (downstream plans): Dashboard, Validation, Generative, Digital Twin, Exports.

- [ ] **Task 4.5 — Dialog + Popover responsive anchor flip (E2E-1018)**

Wrap Radix Popover/Dialog with default `collisionPadding={8}` + `avoidCollisions={true}`. Audit all callsites for width overflow on narrow viewport.

- [ ] **Task 4.6 — WorkspaceShell 3-zone (E2E-988, E2E-991, E2E-1028, E2E-1029)**

```tsx
// client/src/components/layout/WorkspaceShell.tsx
export function WorkspaceShell({ left, center, right, bottom }: { left?: ReactNode; center: ReactNode; right?: ReactNode; bottom?: ReactNode }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] grid-rows-[1fr_auto] h-full">
      <aside className="row-span-1 col-start-1">{left}</aside>
      <main className="row-span-1 col-start-2">{center}</main>
      <aside className="row-span-1 col-start-3">{right}</aside>
      {bottom && <footer className="col-span-3 row-start-2">{bottom}</footer>}
    </div>
  );
}
```

Migrate canvas tabs (Architecture, Schematic, PCB, Breadboard, Component Editor, 3D View) to use `<WorkspaceShell>`. Non-canvas tabs keep their full-width layouts.

- [ ] **Task 4.7 — Tests + commit**

---

## Phase 5 — ConfidenceEvaluator + GatedAIButton (E2E-303, E2E-485, E2E-547, E2E-490, E2E-1040)

### Pre-research

Per Pass 2 E2E-485: "Confidence labels self-contradict in 4+ places — 'Evidence strong' + 'SETUP REQUIRED'". Root cause: each tab computes labels from different inputs. Fix: one service emits structured signals; UI renders from the schema.

### Files
- Create: `server/services/confidence/evaluator.ts`
- Create: `server/routes/confidence.ts`
- Create: `client/src/hooks/useConfidence.ts`
- Create: `client/src/components/ui/gated-ai-button.tsx`

- [ ] **Task 5.1 — `advisor()` on schema**

Proposed:

```ts
type ConfidenceSignal = {
  dimension: 'evidence' | 'setup' | 'gating' | 'completion';
  score: 0 | 1 | 2 | 3;       // 0=none, 1=weak, 2=solid, 3=strong
  label: string;              // derived, NOT free-form per call site
  blockers: string[];         // machine-readable keys
  caveats: string[];
};
type ConfidenceSnapshot = {
  projectId: number;
  surface: 'simulation' | 'order' | 'arduino' | 'exports' | 'dashboard' | 'validation' | 'generative';
  signals: ConfidenceSignal[];
  overallStatus: 'ready' | 'setup-required' | 'guided-candidate' | 'blocked';
};
```

- [ ] **Task 5.2 — Service impl + test**

- [ ] **Task 5.3 — Client hook**

`useConfidence({ surface })` → `ConfidenceSnapshot`. Every tab consumes THE SAME hook; labels are derived from `signals`, never freehand-written.

- [ ] **Task 5.4 — `<GatedAIButton>` primitive (E2E-303)**

```tsx
<GatedAIButton
  requiresApiKey="anthropic"
  onClick={runGenerate}
>Generate Architecture</GatedAIButton>
// If key missing: button disabled with tooltip "Set your Anthropic API key in Settings to enable AI."
// If key present: normal primary button.
```

Migrate every AI-triggering button across the app to this primitive.

- [ ] **Task 5.5 — Tests + commit**

---

## Phase 6 — Animation system (E2E-1015, E2E-1016, E2E-1011)

- [ ] **Task 6.1 — Tokens + utilities**

```css
@theme {
  --motion-tactile: 100ms;
  --motion-ui: 200ms;
  --motion-page: 300ms;
}
```

```tsx
// utilities
export function useReducedMotion() {
  const [rm, setRm] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mql = matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setRm(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return rm;
}
```

- [ ] **Task 6.2 — Active-state tool highlight pattern (E2E-1011)**

Extract from `Breadboard wire tool` active state styling into a shared class `.tool-active` = `bg-primary/20 text-primary border border-primary/40`. Apply to EVERY tool toolbar (Architecture, Schematic, PCB).

- [ ] **Task 6.3 — Tab transitions**

`.view-enter` animation at index.css:164 already exists — expand to: on tab switch, fade + 2px translateY over `var(--motion-page)`. Honor `prefers-reduced-motion` (index.css:339-346 already guards this — extend).

- [ ] **Task 6.4 — Tests via visual regression**

---

## Phase 7 — Storybook + style guide (E2E-1032, E2E-1033)

- [ ] **Task 7.1 — Install Storybook 8 with Vite preset**

```bash
npx storybook@latest init --type react
```

- [ ] **Task 7.2 — Stories for every primitive shipped in Phases 1-6**

- [ ] **Task 7.3 — MDX style-guide docs: color tokens / typography / spacing / motion / components**

- [ ] **Task 7.4 — Optional high-vibe theme (E2E-1033)**

Add `.theme-vibe` class with subtle scan-lines + 1px CRT bloom on cyan elements. Toggleable from Settings (wired by `17-shell-header-nav.md`).

- [ ] **Task 7.5 — CI: `storybook build` must succeed on every PR**

---

## Team Execution Checklist

```
□ 01-p0-bugs.md Phase 6 MERGED (precondition for @theme reactivity)
□ npm run check                         ← zero errors
□ npm test                              ← all green + new primitive tests
□ npx eslint .                          ← zero warnings
□ npx prettier --write .                ← no diff
□ Storybook builds (npm run storybook)
□ Visual-regression Playwright: 14 tabs diff ≤ acceptable token changes
□ Coverage table verified
□ No agent exceeded 6-concurrent cap
□ docs/design-system/ shipped with color-tokens.md + copy-style.md + motion.md
□ advisor() called ≥3× (Task 1.1, 5.1, 7.1)
```

## Research log

- Context7 `tailwindcss` — pending Task 1.x — confirm `@custom-variant dark` syntax
- Context7 `class-variance-authority` — pending Task 3.1
- Context7 `sonner` — pending Task 4.3
- Context7 `storybook` + Vite — pending Task 7.1
- Codebase `rg "bg-muted|bg-card" client/src | wc -l` — pending Task 1.x
- WebSearch "Tailwind v4 @theme" — informs Task 1.2 (already validated in 01 Phase 6 research)
- WebSearch "Material Design 3 role-based palette" — pending Task 1.1
- advisor() calls — pending as scheduled

# Systemic Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Uses `- [ ]` checkbox steps.

**Goal:** Eliminate every systemic WCAG 2.1 AA violation flagged by the 2026-04-18 E2E walkthrough — `role="button"` on non-buttons, missing aria-labels on icon-only buttons, color-only severity indicators, weak focus rings, 830+ tie-point holes with no accessible names, zombie empty-state headings — AND prevent regression by wiring `eslint-plugin-jsx-a11y` + an axe-core Playwright suite into CI.

**Architecture:** The plan ships four concurrent layers: (1) the static lint safety net (eslint rule config), (2) the dynamic runtime safety net (axe-core Playwright scan per tab), (3) a shared primitive refactor (`<InteractiveCard>` replacing every `<div role="button">`), and (4) a focus-ring contrast fix from the current cyan-on-cyan blend to a distinct contrasting ring with visible offset. Each layer can be parallelized across file-ownership lanes.

**Tech Stack:** `eslint-plugin-jsx-a11y`, `jest-axe` (already in devDependencies `^10.0.0` — leverage), `@axe-core/playwright` (to add), React 19, Radix UI primitives (use their built-in semantics), Tailwind CSS v4 (focus-visible utilities).

**Parent:** `00-master-index.md` §3.1 (systemic reroutes for E2E-018/068/261/267/075/494/552/554/625/966), §4.3 (multi-owner with all tab sub-plans), §5 (Tier B, Wave 2).

**Tier:** B. **Depends on:** Tier A complete (`01-p0-bugs.md`, `02-p1-dead-buttons.md`). **Blocks:** every Tier D+ sub-plan (shared primitive must land before tab refactors can use it).

---

## Coverage

| E2E ID | Severity | Finding | Phase.Task |
|--------|----------|---------|-----------|
| E2E-006 | 🔴 a11y | Procurement tabpanel content invisible to a11y tree (no aria-labelledby) | 1.1-1.5 |
| E2E-018 | 🟡 a11y | Activity card has no role/onclick — inconsistent with Architecture/BOM/Validation cards | 3.1-3.5 |
| E2E-068 | 🟡 a11y | Cards use `role="button"` on div — use real `<button>`/`<a>` | 3.1-3.5 |
| E2E-075 | 🟡 a11y | pcb-tutorial-button / import-design-button / mention-badge-button / toggle-activity-feed / button-share-project lack aria-labels | 2.1-2.5 |
| E2E-261 | 🟡 a11y | Cards on Learn/Community/Patterns use div+role=button | 3.1-3.5 |
| E2E-267 | 🟡 a11y | Same pattern across Patterns + Starter Circuits | 3.1-3.5 |
| E2E-494 | 🟡 a11y | Systemic: role=button on divs, missing aria-labels, color-only states — run axe-core scan + fix top 50 | all phases + 5 |
| E2E-552 | 🟡 expansion | ESLint rule `jsx-a11y/no-static-element-interactions` + fix at codebase scale | 4.1-4.5 |
| E2E-554 | 🟡 expansion | Keyboard-nav Playwright test suite (tab order + Enter/Space per interactive element) | 6.1-6.6 |
| E2E-625 | 🔴 a11y | 830 breadboard tie-point holes have sequential testids but no aria-label | 7.1-7.5 |
| E2E-966 | 🟡 a11y | Schematic empty-state heading stays in DOM after populated (already scoped in 01; this plan wires a shared EmptyState primitive) | 8.1-8.4 |
| E2E-1013 | 🟡 a11y | Focus rings exist (focus-visible:ring-2 focus-visible:ring-ring) but ring color similar to background-tinted cyan — low contrast for keyboard users | 9.1-9.5 |
| E2E-1014 | 🔴 design/a11y | No pressed/active state on most buttons — zero tactile feedback | 9.1-9.5 |

**Count:** 13 unique IDs directly owned. E2E-494 is a roll-up that Phases 1-5 all contribute to.

## Existing Infrastructure (verified 2026-04-18)

| Concern | File(s) / package | Notes |
|---------|---|---|
| ESLint config | `eslint.config.js` (flat config) | No a11y plugin installed — Phase 4 adds it |
| jest-axe | `package.json` devDeps `jest-axe@^10.0.0` + `@types/jest-axe@^3.5.9` | Available; only used in `client/src/__tests__/a11y.test.tsx` — expand |
| Axe Playwright | not installed | Phase 5 adds `@axe-core/playwright` |
| role="button" count | 23 occurrences in `client/src/**/*.tsx` | Phase 3 migrates via shared primitive |
| Existing a11y test | `client/src/__tests__/a11y.test.tsx` | Extend; don't shadow |
| Focus-visible global | `client/src/index.css:156-159` | `outline: 2px solid #00F0FF; outline-offset: 2px;` — color identical to primary, fails against cyan-adjacent backgrounds |
| Component buttons | `client/src/components/ui/button.tsx` | shadcn/ui — already uses real `<button>` |
| Breadboard holes | `client/src/components/circuit-editor/BreadboardCanvas.tsx` (grep) | testid `hole-r:rail:N` — add aria-label |

## Research protocol

- **Context7**: `resolve-library-id eslint-plugin-jsx-a11y` → `query-docs "flat config integration with eslint@9"`. Same for `@axe-core/playwright` and `jest-axe`.
- **WebSearch**: "WCAG 2.1 AA focus ring contrast minimum 3:1" — cite the exact SC number (1.4.11 Non-text contrast or 2.4.7 Focus Visible).
- **WebSearch**: "React 19 accessible card link pattern" — how to wrap a card in a link while keeping interactive children keyboard-reachable.
- **Codebase**: `rg 'role="button"|role=\{"button"\}' client/src` — full inventory.
- **Codebase**: `rg "aria-label=" client/src/pages/workspace/WorkspaceHeader.tsx` — confirm which icons lack labels.
- **Advisor**: call before Phase 3 (shared primitive design), again before Phase 5 (axe budget decision — how many violations to allow vs fail).

---

## Phase 1 — Procurement tabpanel aria linkage (E2E-006)

**Files:** `client/src/components/views/ProcurementView.tsx` (find tabs); `tests/a11y/procurement.test.tsx`.

- [ ] **Task 1.1 — Context7 Radix Tabs aria pattern**

```
query-docs "@radix-ui/react-tabs — aria-labelledby on TabsContent"
```

Expected: `<TabsContent value="x" aria-labelledby={...}>` auto-wires via Radix, but custom Tabs wrappers may need manual `role="tabpanel"` + `aria-labelledby="tab-x"`.

- [ ] **Task 1.2 — Failing jest-axe test**

```tsx
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('ProcurementView has no axe violations on BOM sub-tab (E2E-006)', async () => {
  const { container } = render(<ProcurementView />, { wrapper: withAllProviders });
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

- [ ] **Task 1.3 — Fix: if custom tabs, add aria-labelledby; if Radix, upgrade to latest minor + verify**

- [ ] **Task 1.4 — RTL assertion: tabpanel is reachable via keyboard**

```tsx
await userEvent.tab(); // until focus on BOM tab
expect(screen.getByRole('tabpanel', { name: /bill of materials/i })).toBeVisible();
```

- [ ] **Task 1.5 — Commit**

---

## Phase 2 — Icon-only buttons: aria-label audit (E2E-075)

**Files:** `client/src/pages/workspace/WorkspaceHeader.tsx`; every icon-only button site (grep).

- [ ] **Task 2.1 — Full inventory grep**

```bash
rg -n '<Button[^>]*size="icon"' client/src > /tmp/icon-buttons.txt
rg -n '<button[^>]*className=[^>]*p-1.5|<button[^>]*className=[^>]*p-2[^0-9]' client/src | grep -vE 'aria-label' > /tmp/unlabeled-buttons.txt
wc -l /tmp/unlabeled-buttons.txt
```

- [ ] **Task 2.2 — Failing Playwright axe scan per tab**

Deferred to Phase 5 global axe suite — Phase 2's scope is the audit + per-site aria-label fixes targeted at the 5 explicit E2E-075 buttons (pcb-tutorial-button, import-design-button, mention-badge-button, toggle-activity-feed, button-share-project).

```ts
test('workspace header icon-only buttons have aria-labels (E2E-075)', async ({ page }) => {
  await loginAsE2EUser(page);
  await openProject(page, 'Blink LED');
  const testids = ['pcb-tutorial-button', 'import-design-button', 'mention-badge-button', 'toggle-activity-feed', 'button-share-project'];
  for (const id of testids) {
    const label = await page.getByTestId(id).getAttribute('aria-label');
    expect(label, `${id} must have aria-label`).toBeTruthy();
    expect(label!.length).toBeGreaterThan(2);
  }
});
```

- [ ] **Task 2.3 — Add aria-labels**

For each site, either add `aria-label="…"` directly or wrap with `<span className="sr-only">…</span>` inside the button.

- [ ] **Task 2.4 — Run Playwright — PASS**

- [ ] **Task 2.5 — Commit**

---

## Phase 3 — Shared `<InteractiveCard>` primitive (E2E-018, E2E-068, E2E-261, E2E-267)

### Pre-research

Replacing `<div role="button" tabIndex={0} onClick={...} onKeyDown={...}>` with a proper `<button>` breaks styling (buttons default to `display: inline-block` and browser-specific padding). The established industry pattern is a `<button type="button">` with `all: unset` reset, then `display: flex` or `grid` restored.

Alternative for cards that need to be "link-like" (open a detail page): use `<a>` as the primary interactive element + an inner absolutely-positioned overlay link pattern (Adrian Roselli / Inclusive Components recipe). But ProtoPulse cards open dialogs/drawers, not pages — `<button>` is correct.

### Files
- Create: `client/src/components/ui/interactive-card.tsx`
- Modify: 23 sites where `role="button"` appears on a div (migrate to `<InteractiveCard>`)
- Test: `client/src/components/ui/__tests__/interactive-card.test.tsx`

### Tasks

- [ ] **Task 3.1 — Design the primitive (`advisor()` before coding)**

Share this sketch with advisor:

```tsx
// client/src/components/ui/interactive-card.tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InteractiveCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Optional render-as override for link-style cards */
  asChild?: never; // slot pattern would complicate a11y; keep strict button semantics.
}

export const InteractiveCard = forwardRef<HTMLButtonElement, InteractiveCardProps>(
  ({ className, type = 'button', children, ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'group relative text-left appearance-none bg-transparent p-0 m-0 border-0 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  ),
);
InteractiveCard.displayName = 'InteractiveCard';
```

Advisor should weigh in on: (a) `appearance-none` cross-browser support; (b) whether nested interactive children (stars, install buttons) need stopPropagation; (c) should the component expose `disabled` vs non-interactive variant.

- [ ] **Task 3.2 — Failing jest-axe + RTL test**

```tsx
it('InteractiveCard renders as button with proper keyboard semantics (E2E-068)', async () => {
  const handler = vi.fn();
  render(<InteractiveCard onClick={handler}>Hello</InteractiveCard>);
  const btn = screen.getByRole('button', { name: 'Hello' });
  await userEvent.click(btn);
  expect(handler).toHaveBeenCalledTimes(1);
  // Enter + Space both fire click per HTML semantics
  btn.focus();
  await userEvent.keyboard('{Enter}');
  await userEvent.keyboard(' ');
  expect(handler).toHaveBeenCalledTimes(3);
});
```

- [ ] **Task 3.3 — Implement + unit test passes**

- [ ] **Task 3.4 — Migrate all 23 sites (`/agent-teams` dispatch)**

```
Team: "a11y-interactive-card-migration"
Members: 4
File ownership:
  Member A: client/src/components/views/{DashboardView,KnowledgeView}.tsx
  Member B: client/src/components/views/{CommunityView,DesignPatternsView,StarterCircuitsPanel}.tsx
  Member C: client/src/components/views/{CalculatorsView,LessonModeOverlay}.tsx and any learn/lab cards
  Member D: remaining sites + run jest-axe on each touched file
Rule: each Member runs `rg 'role="button"' <their files>` and migrates EVERY hit. No member edits another's file.
```

For each migration:
- Replace `<div role="button" tabIndex={0} onClick={...} onKeyDown={...}>` with `<InteractiveCard onClick={...}>`
- Delete the manual `onKeyDown` handler (browser handles Enter/Space on real buttons natively)
- Verify layout unchanged (usually `.text-left` + existing Tailwind continue to work)

- [ ] **Task 3.5 — Run grep + commit**

```bash
# Verification: no role="button" left on non-buttons
rg -n 'role="button"' client/src
# Expected: only inside tests or comments; zero on <div>.
git commit -m "refactor(a11y): migrate 23 role=\"button\" divs to shared InteractiveCard (E2E-018, E2E-068, E2E-261, E2E-267)

Real <button> elements get Enter/Space activation + correct screen-reader
announcement for free. InteractiveCard primitive keeps layout/styling
identical while restoring browser-native semantics."
```

---

## Phase 4 — ESLint a11y safety net (E2E-552)

**Files:** `package.json`, `eslint.config.js`, CI workflow (if exists).

- [ ] **Task 4.1 — Install + add plugin**

```bash
npm install --save-dev eslint-plugin-jsx-a11y
```

Modify `eslint.config.js` — add to plugins + rules:

```js
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  // ...existing
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/label-has-associated-control': 'warn',
    },
  },
];
```

- [ ] **Task 4.2 — Run lint; fix violations**

```bash
npx eslint . --max-warnings=0
```

If Phase 3 completed, this should be ≤5 violations. Fix each in a focused commit.

- [ ] **Task 4.3 — Document exceptions**

If any violation is a false positive (e.g. a legitimate custom drag-handle), add `// eslint-disable-next-line jsx-a11y/no-static-element-interactions -- explanation` with a specific reason.

- [ ] **Task 4.4 — CI guard**

Verify `.github/workflows/` lint step picks up the new rules. If no CI yet, document in commit that local `npm run check && npx eslint .` is the gate.

- [ ] **Task 4.5 — Commit**

```bash
git commit -m "chore(lint): enable jsx-a11y rules (E2E-552)

Adds eslint-plugin-jsx-a11y with recommended rules plus no-static-element-
interactions and click-events-have-key-events promoted to error. Existing
violations were resolved in the InteractiveCard migration (Phase 3)."
```

---

## Phase 5 — Axe-core Playwright per-tab scan (E2E-494)

### Pre-research

`@axe-core/playwright` runs axe inside a live-loaded page. Per Deque guidance: set impact threshold to `serious` + `critical` only for CI (AA compliance), relaxing `moderate` as warnings. Acceptable to ignore specific violations with documented exceptions (e.g. Radix `data-*` attrs that axe doesn't recognize).

### Files
- Install: `@axe-core/playwright`
- Create: `tests/a11y/axe-tabs.spec.ts`
- Create: `tests/a11y/axe-config.ts` (shared rule config)

- [ ] **Task 5.1 — Install + wire**

```bash
npm install --save-dev @axe-core/playwright
```

`tests/a11y/axe-config.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

export function axe(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .disableRules(['color-contrast']); // enable after Phase 9 focus-ring fix
}
```

- [ ] **Task 5.2 — Per-tab scan spec**

```ts
const TABS = ['Dashboard', 'Architecture', 'Schematic', 'Breadboard', 'PCB', '3D View', 'Component Editor',
  'Procurement', 'Validation', 'Simulation', 'Vault', 'Community', 'Order PCB', 'Tasks', 'Learn',
  'Inventory', 'Serial Monitor', 'Calculators', 'Patterns', 'Starter Circuits', 'Labs', 'History',
  'Audit Trail', 'Lifecycle', 'Comments', 'Generative', 'Digital Twin', 'Exports', 'Supply Chain',
  'BOM Templates', 'My Parts', 'Alternates', 'Part Usage', 'Arduino', 'Circuit Code'];

for (const tab of TABS) {
  test(`axe: ${tab} tab has no critical/serious WCAG AA violations (E2E-494)`, async ({ page }) => {
    await loginAsE2EUser(page);
    await openProject(page, 'Blink LED');
    await page.getByRole('tab', { name: tab }).click();
    const results = await axe(page).analyze();
    const critical = results.violations.filter(v => ['critical', 'serious'].includes(v.impact ?? ''));
    expect(critical, `Critical/serious axe violations on ${tab}: ${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
  });
}
```

- [ ] **Task 5.3 — `advisor()` before triage budget**

First run will almost certainly fail on multiple tabs. `advisor()` to discuss: which violations are in-scope for THIS plan vs deferred to per-tab plans (04-15)? Recommendation: this plan fixes any violation whose ROOT CAUSE is in a shared component (Button, InteractiveCard, Input, Dialog); per-tab plans fix tab-local violations.

- [ ] **Task 5.4 — Fix root-cause-shared violations**

Likely: Input focus rings, Dialog focus trap leaks, lazy-Suspense fallback no-aria.

- [ ] **Task 5.5 — Allowlist per-tab violations with BL entries**

For each tab with residual violations, add a `BL-XXXX` entry in `docs/MASTER_BACKLOG.md` pointing to the owning sub-plan. Skip the test for that tab temporarily using `test.fixme` + the BL link.

- [ ] **Task 5.6 — Commit**

---

## Phase 6 — Keyboard navigation Playwright suite (E2E-554)

**Files:** `tests/a11y/keyboard-nav.spec.ts`, `tests/a11y/tab-order-helpers.ts`.

- [ ] **Task 6.1 — Helper: tab through page, collect focus trail**

```ts
export async function collectTabOrder(page: Page, maxSteps = 100): Promise<string[]> {
  const trail: string[] = [];
  for (let i = 0; i < maxSteps; i++) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      return el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.tagName;
    });
    if (!active || trail.includes(active)) break;
    trail.push(active);
  }
  return trail;
}
```

- [ ] **Task 6.2 — Assert: workspace header reachable in ≤10 tabs from page load**

- [ ] **Task 6.3 — Assert: every interactive element in dashboard reached**

- [ ] **Task 6.4 — Assert: Enter/Space activate InteractiveCard in all cards tabs**

```ts
test('keyboard activates community cards (E2E-266 + E2E-554)', async ({ page }) => {
  await openCommunity(page);
  await page.getByTestId(/community-card-/).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('community-detail-dialog')).toBeVisible();
});
```

- [ ] **Task 6.5 — Assert: no keyboard trap (can Tab-escape every modal)**

- [ ] **Task 6.6 — Commit**

---

## Phase 7 — Breadboard tie-point aria-labels (E2E-625)

### Pre-research

830 tie-point holes with testids like `hole-r:left_pos:0`. Rendering an aria-label on each is feasible (830 strings), but screen-reader users will not want 830 focusable tab stops. Pattern: make the SVG `<svg role="application">` with one compound label like "Breadboard, 830 tie points, left/right rails, 63 rows of 10 columns", and expose only the actively-focused hole name.

Alternative per ARIA Authoring Practices: use a `role="grid"` with gridcell children, aria-colindex + aria-rowindex on each hole. Screen reader announces position on focus.

### Files
- Modify: `client/src/components/circuit-editor/BreadboardCanvas.tsx` (or equivalent — grep)
- Test: RTL snapshot that first hole has aria-label "left positive rail, column 1"

- [ ] **Task 7.1 — Context7 on ARIA grid pattern**

```
query-docs "react accessibility — canvas/SVG grid with aria-colindex + aria-rowindex"
```

- [ ] **Task 7.2 — `advisor()` on pattern choice**

Grid vs application vs textbox. Advisor to evaluate screen-reader testing reality.

- [ ] **Task 7.3 — Implement chosen pattern**

Likely: `<svg role="application" aria-label="Breadboard tie-point grid, 830 holes, use arrow keys to navigate">` + focusable holes with aria-label only computed on focus via React ref.

- [ ] **Task 7.4 — Keyboard arrow-nav across holes**

- [ ] **Task 7.5 — Commit**

---

## Phase 8 — Shared `<EmptyState>` primitive (E2E-966 + E2E-1003/1004 per design-system plan)

### Files
- Create: `client/src/components/ui/empty-state.tsx`
- Consumers in 07-breadboard, 06-schematic, 10-procurement eventually

Scope of THIS plan: ship the primitive + consume in Schematic (inherits from `01-p0-bugs.md` Phase 5 narrow fix). Remaining tabs migrate in their own plans.

- [ ] **Task 8.1 — Design**

```tsx
export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void; testId?: string };
  secondaryAction?: { label: string; onClick: () => void };
  /** When true, renders nothing (caller has data now) */
  hidden?: boolean;
}
export function EmptyState(props: EmptyStateProps) {
  if (props.hidden) return null; // Phase 5 of 01 depended on explicit unmount
  return (<div role="status" aria-live="polite">...</div>);
}
```

- [ ] **Task 8.2 — Migrate Schematic EmptyState**

Drop the narrow fix from 01-Phase-5; wire Schematic to consume `<EmptyState>`.

- [ ] **Task 8.3 — jest-axe + RTL test**

- [ ] **Task 8.4 — Commit**

---

## Phase 9 — Focus ring + pressed state (E2E-1013, E2E-1014)

### Pre-research

Current: `client/src/index.css:156-159` sets `outline: 2px solid #00F0FF; outline-offset: 2px`. Against cyan-adjacent backgrounds (many primary buttons use `var(--color-primary)` = `hsl(190 100% 43%)`), the focus outline disappears.

WCAG 2.1 SC 1.4.11 Non-text Contrast requires 3:1 between focus indicator and adjacent colors. Fix: use a high-contrast ring (white or black depending on surface) OR a stacked outline (2px primary + 2px offset transparent + 2px dark outer = focus cage).

### Files
- Modify: `client/src/index.css:156-159` and the focus-ring utility block (around line 259)
- Modify: `client/src/components/ui/button.tsx` (shadcn) to add `active:scale-[0.98]` tactile feedback
- Test: Playwright assert focus outline color differs from surrounding color by ≥3:1 (approximate via getComputedStyle)

- [ ] **Task 9.1 — Research WCAG 1.4.11 + 2.4.7**

WebSearch: "WCAG 2.4.7 Focus Visible dual-color focus indicator pattern"

- [ ] **Task 9.2 — Implement focus cage**

```css
:focus-visible {
  outline: 2px solid #000;
  outline-offset: 0;
  box-shadow: 0 0 0 4px #00F0FF;
}
```

Or, simpler with tokens from Phase 4 of `16-design-system.md` if that runs first.

- [ ] **Task 9.3 — Add pressed state**

Modify `components/ui/button.tsx`: `active:scale-[0.98] active:brightness-95 transition-transform duration-75`.

- [ ] **Task 9.4 — Visual regression — Playwright screenshots**

- [ ] **Task 9.5 — Commit**

---

## Team Execution Checklist

```
□ npm run check                        ← zero errors
□ npm test                             ← jest-axe tests green
□ npx eslint . --max-warnings=0        ← jsx-a11y rules pass
□ npx prettier --write .               ← no diff
□ Coverage table verified
□ Playwright: axe-tabs spec + keyboard-nav spec passing
□ 0 role="button" on divs in client/src (grep check)
□ No agent exceeded 6-concurrent cap
□ MASTER_BACKLOG.md updated with BL entries for deferred per-tab axe violations
□ advisor() called ≥3× (Task 3.1, Task 5.3, Task 7.2)
```

## Research log

- Context7 `eslint-plugin-jsx-a11y` — pending Task 4
- Context7 `@axe-core/playwright` — pending Task 5.1
- Codebase — `rg 'role="button"' client/src | wc -l` = 23
- Codebase — `package.json` confirms jest-axe@10 installed, no jsx-a11y plugin
- Codebase — `client/src/index.css:156-159` confirms weak cyan-on-cyan focus outline
- WebSearch WCAG 2.1 SC 1.4.11 — pending
- advisor() call 1 — before Task 3.1
- advisor() call 2 — Task 5.3 axe triage budget
- advisor() call 3 — Task 7.2 breadboard ARIA pattern

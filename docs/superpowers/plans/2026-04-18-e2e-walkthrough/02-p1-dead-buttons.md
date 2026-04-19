# P1 Dead Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Wire every button the 2026-04-18 E2E walkthrough tagged "dead / does nothing on click", eliminate the triple-source board-geometry split, fix the `valuemax=0` spinbutton systemic bug, and repair the Add Component empty-state CTA + vestigial Place Component / Place Power toolbar buttons. Every listed E2E-XXX gets a regression test.

**Architecture:** Each dead button is independent; they cluster into 4 subsystem groups — workspace header popovers (E2E-074), canvas tool handlers (E2E-078, E2E-225, E2E-856, E2E-849), list-item click routing (E2E-266), and systemic numeric/board state (E2E-228/235/270, E2E-236/271/284, E2E-233). Order of phases minimizes cross-file contention.

**Tech Stack:** React 19 + Radix UI primitives (Popover, Tooltip, Dialog), React Flow 11.x (canvas tools), shadcn/ui wrapped primitives, Drizzle ORM (board geometry server side), Playwright (click-truth verification — "a button works iff DevTools click produces a user-visible state change" per audit methodology).

**Parent:** `00-master-index.md` §3.1 (P1 explicit reroutes), §4.3 (multi-owner rows for E2E-228/235/270), §5 (Tier A, Wave 1, runs alongside `01-p0-bugs.md` on disjoint files).

**Tier:** A. **Depends on:** none. **Blocks:** `05-architecture.md` (tool-analyze), `06-schematic.md` (Add Component / Place Component), `08-pcb-3d-order.md` (board geometry source-of-truth), `14-community-tasks-history.md` (card click).

**Runs in parallel with** `01-p0-bugs.md` — file ownership is disjoint (01 owns `server/request-routing.ts`, audit scoping, DRC engine; 02 owns canvas views, workspace header, board storage). Confirm disjoint before dispatching agents.

---

## Coverage

| E2E ID | Severity | Finding | Phase.Task |
|--------|----------|---------|-----------|
| E2E-074 | 🔴 P1 | `coach-help-button` popover renders nothing (Suspense fallback={null} / Tooltip intercepts PopoverTrigger events) | 1.1-1.6 |
| E2E-078 | 🔴 P1 | `tool-analyze` in Architecture view reported dead | 2.1-2.5 |
| E2E-225 | 🔴 P1 | Schematic empty-state "Add Component" enters place-mode but no part selected → clicks nothing | 3.1-3.6 |
| E2E-228 | 🔴 P1 | PCB tab board default 50×40mm | 4.1-4.8 |
| E2E-235 | 🔴 P1 | 3D View tab board default 100×80mm (disagrees) | 4.1-4.8 |
| E2E-266 | 🔴 P1 | Community cards look interactive but click does nothing | 5.1-5.5 |
| E2E-270 | 🔴 P1 | Order PCB tab board default 100×80mm (disagrees with PCB tab) | 4.1-4.8 |
| E2E-233 | 🔴 P1 | Layer visibility panel doesn't show inner layers on 4+ layer stack | 6.1-6.5 |
| E2E-236 | 🔴 P1 | 3D View spinbuttons `aria-valuemax=0` — can't increment | 7.1-7.6 |
| E2E-271 | 🔴 P1 | Order PCB spinbuttons same bug | 7.1-7.6 |
| E2E-284 | 🔴 P1 | Calculator spinbuttons same bug | 7.1-7.6 |
| E2E-488 | 🟡 systemic | "Three board sources" app-wide — absorbed by Phase 4 fix | 4 |
| E2E-553 | 🟡 expansion | `useProjectBoard()` hook + single `boards` table — delivered by Phase 4 | 4 |
| E2E-849 | 🔴 P1 | `schematic-tool-place-component` + `schematic-tool-place-power` toolbar buttons perma-disabled (vestigial) | 8.1-8.5 |
| E2E-856 | 🔴 P1 | Schematic `Add Component` empty-state confirmed broken w/o preselected part (consolidates E2E-225) | 3 (same fix) |
| E2E-915 | 🔴 P1 | Schematic vestigial toolbar buttons — either convert to click-to-enter-place-mode or remove (consolidates E2E-849) | 8 (same fix) |

**Count:** 16 unique IDs directly owned. Cross-ref: E2E-488 is E2E-228/235/270 condensed; E2E-553 is the server infrastructure; E2E-856 duplicates E2E-225; E2E-915 duplicates E2E-849. All rolled into the relevant phase.

## Existing Infrastructure (verified 2026-04-18)

| Concern | File(s) | Notes |
|---------|---------|-------|
| Workspace header | `client/src/pages/workspace/WorkspaceHeader.tsx:427-444` | Coach popover wired but `<PopoverTrigger asChild>` wraps `<StyledTooltip>` wrapping `<button>` — **root cause of E2E-074** (Tooltip Slot intercepts trigger) |
| Tutorial menu lazy | `client/src/pages/workspace/lazy-imports.ts:25` | `lazy(() => import('@/components/ui/TutorialMenu'))` |
| Tutorial menu impl | `client/src/components/ui/TutorialMenu.tsx:60` | Default export; requires `useTutorial()` context |
| TutorialProvider scope | `client/src/pages/ProjectWorkspace.tsx:839` | Wraps `<WorkspaceContent>` which renders `<WorkspaceHeader>` — context IS in scope |
| Architecture analyze button | `client/src/components/views/ArchitectureView.tsx:748` | `data-testid="tool-analyze"`, `onClick={handleToggleAnalysis}` |
| Architecture handler | `client/src/components/views/ArchitectureView.tsx:142-147` | `handleToggleAnalysis` toggles `showAnalysis` + runs analyzer |
| Architecture panel | `client/src/components/views/ArchitectureView.tsx:818` | `{showAnalysis && (<AnalysisPanel ...) }` |
| Schematic view | `client/src/components/views/SchematicView.tsx` (grep) | Contains Add Component empty-state + toolbar |
| Community view | `client/src/components/views/CommunityView.tsx` | Contains dead cards (E2E-266) |
| PCB view | `client/src/components/circuit-editor/PCBLayoutView.tsx` | Uses local board state |
| 3D view | `client/src/components/views/BoardViewer3DView.tsx` | Likely has its own board state |
| Order PCB view | `client/src/components/views/PcbOrderingView.tsx` | Has its own defaults |
| Boards server storage | unknown — verify via `rg "boards" server/schema/*` | Phase 4 may need to create or refactor |
| Spinbutton shared | `client/src/components/ui/input.tsx` and Radix Number Input | E2E-236/271/284 confirm `aria-valuemax=0` — all use same wrapper |

## Research protocol

- **Context7**: `resolve-library-id @radix-ui/react-popover` → `query-docs "Popover trigger wrapped in Tooltip — correct nesting order"`. Same for `@radix-ui/react-tooltip`. Expected answer: nest Tooltip INSIDE PopoverTrigger's asChild, or use `<TooltipProvider delayDuration={...}>` outside both.
- **Context7**: `resolve-library-id reactflow` → `query-docs "React Flow 11 tool button patterns, onClick vs onToolChange"`.
- **WebSearch**: "Radix Popover not opening when wrapped in Tooltip site:github.com/radix-ui" — confirm known issue.
- **Codebase**: `rg "aria-valuemax" client/src` — find every spinbutton. `rg "default.*(50|100).*40|default.*(50|100).*80" client/src` — find the 3 hardcoded board sizes.
- **Advisor**: call before Phase 4 (board source-of-truth refactor is the highest-blast-radius change).

---

## Phase 1 — Coach & Help popover (E2E-074)

### Pre-research root cause

Verified against current source:
1. `WorkspaceHeader.tsx:427-444` — `<Popover>` → `<PopoverTrigger asChild>` → `<StyledTooltip>` → `<button>`. The `asChild` prop on PopoverTrigger uses Radix's Slot pattern, which forwards props/refs to a SINGLE child. But `<StyledTooltip>` wraps children in its own Slot (for TooltipTrigger), so the prop-forwarding chain breaks — the `<button>` receives the tooltip's event handlers instead of Popover's.
2. Known Radix behavior: nested Slot components need composition via `SlottedButton` or inverted nesting. The fix is inverting: `<Tooltip><PopoverTrigger asChild><button></button></PopoverTrigger></Tooltip>`.
3. Secondary risk: `<Suspense fallback={null}>` at `WorkspaceHeader.tsx:440` — if lazy TutorialMenu fails to load, popover appears empty with no user signal. Fix fallback to a loading skeleton.

### Files
- Modify: `client/src/pages/workspace/WorkspaceHeader.tsx:427-444`
- Modify: `client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx` (add RTL test for popover open)
- Add: `tests/e2e/p1-coach-help-popover.spec.ts`

### Tasks

- [ ] **Task 1.1 — Context7 verify Radix nesting pattern**

```
resolve-library-id @radix-ui/react-popover
query-docs "PopoverTrigger asChild with Tooltip — correct composition to avoid Slot conflict"
```

Document answer. If Radix recommends `<TooltipProvider>` at app root + `<Tooltip><TooltipTrigger asChild><PopoverTrigger asChild>...`, use that pattern.

- [ ] **Task 1.2 — Write failing Playwright e2e**

File: `tests/e2e/p1-coach-help-popover.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { loginAsE2EUser, openProject } from './helpers';

test('Coach & Help button opens popover with TutorialMenu content (E2E-074)', async ({ page }) => {
  await loginAsE2EUser(page);
  await openProject(page, 'Blink LED');
  await page.getByTestId('coach-help-button').click();
  // Popover content should render TutorialMenu — look for tutorial cards or the menu heading.
  await expect(page.getByTestId(/tutorial-card-/).first()).toBeVisible({ timeout: 2000 });
});
```

Run: FAIL (currently popover opens empty or not at all).

- [ ] **Task 1.3 — Fix Radix nesting**

Modify `client/src/pages/workspace/WorkspaceHeader.tsx:427-444`:

```tsx
<StyledTooltip content="Coach and tutorials" side="bottom">
  <Popover>
    <PopoverTrigger asChild>
      <button
        data-testid="coach-help-button"
        className="inline-flex items-center gap-2 rounded-sm px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GraduationCap className="w-4 h-4" />
        <span>Coach &amp; Help</span>
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-80 p-0" align="end">
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading tutorials…</div>}>
        <TutorialMenu />
      </Suspense>
    </PopoverContent>
  </Popover>
</StyledTooltip>
```

Key changes: (a) Tooltip is now the outermost wrapper, (b) Popover wraps PopoverTrigger+PopoverContent, (c) button is the direct asChild of PopoverTrigger (not wrapped in Tooltip), (d) Suspense fallback is visible skeleton, not null.

- [ ] **Task 1.4 — Add RTL unit test**

Modify `client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx`:

```tsx
it('Coach & Help popover opens on click and renders TutorialMenu (E2E-074)', async () => {
  render(<WorkspaceHeader {...defaultProps} />, { wrapper: withAllProviders });
  const trigger = screen.getByTestId('coach-help-button');
  await userEvent.click(trigger);
  // TutorialMenu default renders at least the "Loading tutorials…" Suspense fallback immediately, then the tutorial list.
  await waitFor(() => {
    expect(screen.getByRole('dialog') /* Popover content role */).toBeVisible();
  });
});
```

- [ ] **Task 1.5 — Run tests + call `advisor()`**

Run Playwright + Vitest. Both PASS.

`advisor()` — share the Radix nesting fix. Advisor should confirm or flag (e.g. if `StyledTooltip` has its own event-capture logic that still conflicts).

- [ ] **Task 1.6 — Commit**

```bash
git add client/src/pages/workspace/WorkspaceHeader.tsx \
        client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx \
        tests/e2e/p1-coach-help-popover.spec.ts
git commit -m "fix(workspace): Coach & Help popover opens with TutorialMenu (E2E-074)

Root cause: PopoverTrigger asChild wrapped <StyledTooltip>, whose
internal Slot component intercepted Popover's trigger events — the
button received Tooltip handlers, never PopoverTrigger's. Invert the
nesting so Tooltip is outermost and PopoverTrigger wraps the button
directly. Also replace Suspense fallback={null} with a visible
loading placeholder so lazy-chunk failures surface.

Refs: 2026-04-18 E2E walkthrough, E2E-074."
```

---

## Phase 2 — Architecture `tool-analyze` button (E2E-078)

### Pre-research root cause

The button IS correctly wired (verified at `ArchitectureView.tsx:748` → `onClick={handleToggleAnalysis}` → `useCallback` at `:142-147` → `setShowAnalysis` + `runAnalysis`). The conditional panel renders at `:818` (`{showAnalysis && ...}`).

**Hypothesis:** click works, but the panel is hidden off-screen, zero-opacity, or overlaid by the AI sidebar. Alternative: `runAnalysis` throws on projects with no nodes, preventing the panel from rendering (analyzer may require ≥1 node).

### Files
- Investigate: `client/src/components/views/ArchitectureView.tsx:97, 142-147, 748-758, 818+`
- Investigate: `client/src/lib/architecture-analyzer.ts`
- Add: `tests/e2e/p1-tool-analyze.spec.ts`
- Modify (if needed): ArchitectureView panel render conditional / analyzer empty-design guard

### Tasks

- [ ] **Task 2.1 — Reproduce + instrument**

Run the app locally, open Blink LED, click tool-analyze. Observe: (a) does `showAnalysis` state flip? (React DevTools) (b) does `handleToggleAnalysis` console-log? Add a temporary `console.log('toggle', !showAnalysis)` inside the callback. (c) does `runAnalysis` throw on 0-node state?

If the bug is confined to 0-node state (the audit project had 1 component), add empty-design guard to analyzer.

- [ ] **Task 2.2 — Failing Playwright test**

```ts
test('tool-analyze toggles the analysis panel (E2E-078)', async ({ page }) => {
  await loginAsE2EUser(page);
  await openProject(page, 'Blink LED');
  await page.getByRole('tab', { name: 'Architecture' }).click();
  await addArchitectureNode(page, 'BME280'); // ensure analyzer has data
  await page.getByTestId('tool-analyze').click();
  await expect(page.getByTestId('architecture-analysis-panel')).toBeVisible({ timeout: 2000 });
});
```

Run: FAIL until fix.

- [ ] **Task 2.3 — Apply fix based on Task 2.1 findings**

Most likely: add `data-testid="architecture-analysis-panel"` to the `{showAnalysis && ...}` block so the selector resolves, AND add an empty-design guard to `ArchitectureAnalyzer.analyze()` returning `{ status: 'no-nodes', ... }` instead of throwing.

If the panel renders but is hidden due to z-index / overlay: adjust `z-index` so `architecture-analysis-panel` sits above React Flow minimap (1000+).

- [ ] **Task 2.4 — Unit test the analyzer empty-state guard**

```ts
it('ArchitectureAnalyzer returns no-nodes sentinel on empty design (E2E-078)', () => {
  const result = new ArchitectureAnalyzer().analyze({ nodes: [], edges: [], bom: [] });
  expect(result.status).toBe('no-nodes');
});
```

- [ ] **Task 2.5 — Commit**

```bash
git add client/src/components/views/ArchitectureView.tsx \
        client/src/lib/architecture-analyzer.ts \
        client/src/lib/__tests__/architecture-analyzer.test.ts \
        tests/e2e/p1-tool-analyze.spec.ts
git commit -m "fix(architecture): tool-analyze button toggles visible panel (E2E-078)

Root cause: <narrate from Task 2.1>. Add stable testid on the panel,
empty-design guard on the analyzer, and Playwright regression."
```

---

## Phase 3 — Schematic Add Component empty-state (E2E-225, E2E-856)

### Pre-research

Audit says: Add Component CTA enters place-mode (coord readout appears at X:600 Y:400) but no preselected part → clicking canvas does nothing. Fix options:
- (a) Disable Add Component until a part is selected, OR
- (b) When clicked with no selection, open the Parts panel + show toast "Pick a part from the list to place"

Option (b) is more forgiving. Combine: button becomes a guided two-step CTA.

### Files
- Modify: `client/src/components/views/SchematicView.tsx` (grep for empty-state)
- Modify: `client/src/components/schematic/EmptyState.tsx` (likely exists; confirm)
- Test: `client/src/components/schematic/__tests__/AddComponent.test.tsx`
- E2E: `tests/e2e/p1-schematic-add-component.spec.ts`

### Tasks

- [ ] **Task 3.1 — Read existing empty-state**

```bash
rg -n "Add Component|schematic.*empty" client/src/components/views/SchematicView.tsx client/src/components/schematic/
```

- [ ] **Task 3.2 — Failing Playwright**

```ts
test('Add Component empty-state opens Parts panel + highlights it (E2E-225/856)', async ({ page }) => {
  await loginAsE2EUser(page);
  await openProject(page, 'Blink LED');
  await page.getByRole('tab', { name: 'Schematic' }).click();
  await page.getByRole('button', { name: /add component/i }).click();
  await expect(page.getByTestId('schematic-parts-panel')).toBeVisible();
  await expect(page.getByText(/pick a part/i)).toBeVisible();
});
```

- [ ] **Task 3.3 — Implementation**

Modify the empty-state handler:

```tsx
const handleAddComponentClick = () => {
  if (!selectedPartId) {
    setPartsPanelOpen(true);
    toast.info('Pick a part from the Parts panel, then drag it onto the canvas.');
    return;
  }
  enterPlaceMode(selectedPartId);
};
```

- [ ] **Task 3.4 — Unit test handler**

- [ ] **Task 3.5 — Run + Playwright PASS**

- [ ] **Task 3.6 — Commit**

```bash
git commit -m "fix(schematic): Add Component empty-state guides to Parts panel (E2E-225, E2E-856)

Previously clicking 'Add Component' with no selected part entered a
place-mode with no payload — clicks were no-ops. Replace with a guided
flow: open Parts panel + toast. Add Playwright test."
```

---

## Phase 4 — Board geometry source-of-truth (E2E-228, E2E-235, E2E-270, E2E-488, E2E-553)

**Highest blast radius. `advisor()` before Task 4.3.**

### Pre-research

Three tabs each store their own default board size. Per E2E-553, the fix is a single server-side `boards` table (or column on `projects`) + `useProjectBoard()` hook consumed by all three views.

### Files
- Create: `server/schema/boards.ts` (or extend `server/schema/projects.ts`) with board geometry columns `widthMm`, `heightMm`, `layerCount`, `thicknessMm`
- Migration: `drizzle-kit generate` output in `server/db/migrations/`
- Create: `server/routes/boards.ts` (GET/PATCH `/api/projects/:id/board`)
- Create: `client/src/hooks/useProjectBoard.ts`
- Modify: `client/src/components/circuit-editor/PCBLayoutView.tsx`, `client/src/components/views/BoardViewer3DView.tsx`, `client/src/components/views/PcbOrderingView.tsx` (consume hook, delete local defaults)
- Tests: server supertest for `/api/projects/:id/board`, Playwright E2E asserting PCB/3D/Order show same dimensions.

### Tasks

- [ ] **Task 4.1 — Verify schema state**

```bash
rg -n "widthMm|boardWidth|width.*height|50.*40|100.*80" server/schema/ server/storage/ client/src/
```

If a `board` already exists on projects, use it. If three different local states, proceed with refactor.

- [ ] **Task 4.2 — Failing server test**

```ts
describe('GET /api/projects/:id/board (E2E-553)', () => {
  it('returns stored board geometry (not per-view defaults)', async () => {
    const { projectId, sessionId } = await seedProject({ boardWidth: 75, boardHeight: 50 });
    const res = await request(app).get(`/api/projects/${projectId}/board`).set('x-session-id', sessionId);
    expect(res.body.widthMm).toBe(75);
    expect(res.body.heightMm).toBe(50);
  });
});
```

- [ ] **Task 4.3 — `advisor()` — share proposed schema + migration**

Before migrating DB in a shared repo, verify with advisor. Consider backfill plan for existing projects.

- [ ] **Task 4.4 — Add schema + migration**

`server/schema/projects.ts` — add columns:

```ts
boardWidthMm: real('board_width_mm').notNull().default(50),
boardHeightMm: real('board_height_mm').notNull().default(40),
boardLayerCount: integer('board_layer_count').notNull().default(2),
boardThicknessMm: real('board_thickness_mm').notNull().default(1.6),
```

Run `npm run db:generate` → commit the migration file unchanged. Run `npm run db:push` (or migrate) in dev.

- [ ] **Task 4.5 — Server route**

`server/routes/boards.ts` — GET/PATCH per project, with requireAuth + project ownership check.

- [ ] **Task 4.6 — Client hook**

`client/src/hooks/useProjectBoard.ts` — wraps `useQuery` + `useMutation` for board geometry.

- [ ] **Task 4.7 — Refactor the 3 views to consume hook**

Delete local `boardWidth`/`boardHeight` state in PCBLayoutView, BoardViewer3DView, PcbOrderingView. Replace with `const { data: board } = useProjectBoard();`. Reject incomplete fixtures in tests.

- [ ] **Task 4.8 — Playwright: all three tabs display same dimensions**

```ts
test('PCB / 3D / Order PCB share one board geometry (E2E-228/235/270/488/553)', async ({ page }) => {
  await loginAsE2EUser(page);
  await openProject(page, 'Blink LED');
  const tabs = ['PCB', '3D View', 'Order PCB'];
  const readings = [];
  for (const tab of tabs) {
    await page.getByRole('tab', { name: tab }).click();
    readings.push(await page.getByTestId('board-dimensions').innerText());
  }
  expect(new Set(readings).size).toBe(1);
});
```

Commit:
```bash
git commit -m "feat(boards): single source of truth for board geometry (E2E-228, E2E-235, E2E-270, E2E-488, E2E-553)

Adds projects.board_* columns, /api/projects/:id/board, useProjectBoard
hook. Refactors PCB, 3D, and Order PCB views to consume the shared hook.
Playwright asserts all three tabs report identical geometry."
```

---

## Phase 5 — Community cards clickable (E2E-266)

### Files
- Modify: `client/src/components/views/CommunityView.tsx`
- Create (if missing): `client/src/components/community/CommunityItemDetailDialog.tsx`
- E2E: `tests/e2e/p1-community-card-click.spec.ts`

### Tasks

- [ ] **Task 5.1 — Grep current card implementation**

```bash
rg -n "community-card|onClick" client/src/components/views/CommunityView.tsx | head
```

- [ ] **Task 5.2 — Failing Playwright**

```ts
test('Clicking a community card opens a detail dialog (E2E-266)', async ({ page }) => {
  await loginAsE2EUser(page);
  await page.getByRole('tab', { name: 'Community' }).click();
  await page.getByTestId(/community-card-/).first().click();
  await expect(page.getByTestId('community-detail-dialog')).toBeVisible();
});
```

- [ ] **Task 5.3 — Wire card click**

Add `onClick` handler that fetches detail + opens Radix Dialog. Use real `<button>` (not div+role=button) — crosses with `03-a11y-systemic.md`.

- [ ] **Task 5.4 — Run + verify focus-trap + Escape closes**

- [ ] **Task 5.5 — Commit**

```bash
git commit -m "feat(community): card click opens detail dialog (E2E-266)

Cards previously looked interactive but had no click handler. Add
Dialog-based detail view with install/favorite actions."
```

---

## Phase 6 — Layer visibility sync with stack (E2E-233)

### Files
- Modify: `client/src/components/circuit-editor/PCBLayoutView.tsx` (or layer panel sub-component)
- Test: unit test for `deriveVisibleLayers(layerCount)`

### Tasks

- [ ] **Task 6.1 — Read current layer visibility state**

```bash
rg -n "layer-visibility|visibleLayers|4.*layer|layerCount" client/src/components/circuit-editor/
```

- [ ] **Task 6.2 — Failing unit test**

```ts
describe('deriveVisibleLayers (E2E-233)', () => {
  it('returns 4 layers when layerCount=4', () => {
    expect(deriveVisibleLayers(4)).toHaveLength(4);
  });
  it('toggles inner layers alongside outer', () => {
    const v = deriveVisibleLayers(4);
    expect(v).toContainEqual(expect.objectContaining({ id: 'In1.Cu' }));
    expect(v).toContainEqual(expect.objectContaining({ id: 'In2.Cu' }));
  });
});
```

- [ ] **Task 6.3 — Implement + sync**

Derive visibility from `useProjectBoard().layerCount` (provided by Phase 4). Visibility panel rerenders when layerCount changes.

- [ ] **Task 6.4 — Playwright: switch 2→4 layers reveals inner layer toggles**

- [ ] **Task 6.5 — Commit**

```bash
git commit -m "fix(pcb): layer visibility panel reflects active layer count (E2E-233)"
```

---

## Phase 7 — Spinbutton `aria-valuemax=0` systemic bug (E2E-236, E2E-271, E2E-284)

### Pre-research

Audit reports the same bug across 3D View / Order PCB / Calculators. Likely a shared input wrapper (`client/src/components/ui/input.tsx` or a `NumberInput`) sets `aria-valuemax={max}` where `max` is undefined → coerced to 0. Or the value is `max={0}` due to prop default.

### Files
- Investigate: `client/src/components/ui/input.tsx`, any `NumberInput` component
- Grep: `rg "aria-valuemax|aria-valuenow|type=\"number\"" client/src`
- Modify: shared NumberInput component
- Test: RTL test asserting aria-valuemax reflects `max` prop correctly

### Tasks

- [ ] **Task 7.1 — Grep all valuemax sites**

- [ ] **Task 7.2 — Failing RTL test**

```tsx
it('NumberInput forwards max prop to aria-valuemax (E2E-236/271/284)', () => {
  render(<NumberInput value={5} min={0} max={100} onChange={() => {}} />);
  expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuemax', '100');
});
it('NumberInput omits aria-valuemax when max is undefined (not 0)', () => {
  render(<NumberInput value={5} min={0} onChange={() => {}} />);
  expect(screen.getByRole('spinbutton')).not.toHaveAttribute('aria-valuemax');
});
```

- [ ] **Task 7.3 — Implementation**

Spread-attribute pattern to avoid setting `aria-valuemax=0` on undefined:

```tsx
const ariaProps: Record<string, number> = {};
if (typeof max === 'number') ariaProps['aria-valuemax'] = max;
if (typeof min === 'number') ariaProps['aria-valuemin'] = min;
ariaProps['aria-valuenow'] = value;
```

- [ ] **Task 7.4 — Grep all callers — confirm each passes `max` or omits it**

Fix every callsite that was passing `max={0}` as a sentinel.

- [ ] **Task 7.5 — Playwright**

```ts
test('3D View / Order PCB / Calculators: spinbuttons have valid aria-valuemax (E2E-236/271/284)', async ({ page }) => {
  // ...navigate each tab; assert no spinbutton has aria-valuemax="0" unless its real max is 0
});
```

- [ ] **Task 7.6 — Commit**

```bash
git commit -m "fix(a11y): NumberInput omits aria-valuemax when max undefined (E2E-236, E2E-271, E2E-284)

Previously a missing max prop coerced to aria-valuemax=0, making the
spinbutton appear non-incrementable to assistive tech. Propagate only
when defined. Playwright regression across three tabs."
```

---

## Phase 8 — Vestigial Schematic toolbar buttons (E2E-849, E2E-915)

### Pre-research

Per audit: `schematic-tool-place-component` and `schematic-tool-place-power` are perma-disabled with tooltip "drag from Parts/Power panel". Option (a): remove. Option (b): convert to click-to-enter-place-mode that opens the corresponding panel (same flow as Phase 3).

Pick option (b) for consistency with Phase 3 Add Component fix.

### Files
- Modify: `client/src/components/views/SchematicView.tsx` (toolbar section)
- E2E: `tests/e2e/p1-schematic-place-mode-buttons.spec.ts`

### Tasks

- [ ] **Task 8.1 — Grep current toolbar code**

- [ ] **Task 8.2 — Failing Playwright**

```ts
test('schematic-tool-place-component opens Parts panel (E2E-849/915)', async ({ page }) => {
  // click → assert Parts panel visible
});
test('schematic-tool-place-power opens Power panel', async ({ page }) => {
  // similar
});
```

- [ ] **Task 8.3 — Wire handlers**

Remove `disabled={true}`; add `onClick={() => setSubPanel('parts')}` / `setSubPanel('power')`.

- [ ] **Task 8.4 — Run tests PASS**

- [ ] **Task 8.5 — Commit**

```bash
git commit -m "fix(schematic): place-component/place-power toolbar buttons open corresponding panels (E2E-849, E2E-915)"
```

---

## Team Execution Checklist

```
□ npm run check                        ← zero errors
□ npm test                             ← all green
□ npx eslint .                         ← zero warnings
□ npx prettier --write .               ← no diff
□ Coverage table verified
□ Playwright e2e: 8 new specs passing
□ No agent exceeded 6-concurrent cap
□ File-ownership honored
□ MASTER_BACKLOG.md updated with BL entries for discoveries
□ advisor() called ≥2× (Task 1.5, Task 4.3)
```

## Research log

- Context7 `@radix-ui/react-popover` — pending at Task 1.1
- Context7 `@radix-ui/react-tooltip` — pending
- Codebase grep `ArchitectureView.tsx:142-147,748-758,818` — handler IS wired; behavior defect likely elsewhere (empty-design analyzer throw, or panel hidden)
- Codebase grep `WorkspaceHeader.tsx:427-444` — **confirmed** Popover→StyledTooltip→button nesting antipattern
- Codebase grep `pages/ProjectWorkspace.tsx:839` — TutorialProvider wraps WorkspaceContent which contains WorkspaceHeader; context IS in scope
- WebSearch "Radix Popover + Tooltip nesting" — pending
- advisor() call 1 — after Task 1.5 (Radix nesting fix validated)
- advisor() call 2 — before Task 4.3 (board schema migration proposal)

# Gemini Handoff — 2026-04-23 Evening Session

> From Claude Opus 4.7, end-of-day 2026-04-22. Tyler is at 97% weekly usage; Claude's usage resets 2026-04-23 ~07:00. **You (Gemini CLI) are running while Claude is paused.** Your job is to land two tightly-scoped accessibility phases without blocking anything Claude will resume in the morning.

---

## 1. Scope — do these two things, nothing else

### Phase A — **Plan 03 Phase 7: tie-point aria-labels (E2E-625)**
### Phase B — **Plan 03 Phase 8: shared `<EmptyState>` primitive wiring (E2E-966 cleanup)**

Do NOT pick up any other phase. Specifically **do not touch** Plan 03 Phase 1 (procurement tabpanel), Phase 5 (axe-core Playwright harness), Phase 6 (keyboard-nav suite), or Phase 9 (focus-ring contrast). Those are reserved for Claude tomorrow. Reasons:

- **Phase 1** looks simple but depends on auditing whether the bug is in the Radix Tabs wrapper or in one of the 17 TabsTrigger panels — needs pattern-continuity work that Phase 4 of the a11y plan (the axe scanner in Phase 5) will surface cleanly.
- **Phase 5 + Phase 6** are test-harness design decisions. Claude has the full context on recent Playwright conventions (see `e2e/p0-*.spec.ts`, `e2e/p1-*.spec.ts`).
- **Phase 9** is Tailwind v4 CSS color work; Claude just landed `@theme inline → @theme` + `@custom-variant dark` in Plan 01 Phase 6 (commit `af3b49f3`) and has that context cached.

**If you finish both Phase A + Phase B cleanly and still have time**, the bonus section at the bottom lists small, safe cleanup tasks you can pick from. Do NOT start any phase not listed in this document.

---

## 2. Orient first — read before editing

```bash
cd /home/wtyler/Projects/ProtoPulse
git log --oneline -15    # see what landed today
git status --short       # should be clean except for ops/sessions/*.json
```

**Recent commits to understand today's landscape (newest first):**

| SHA | What |
|---|---|
| `d93f72ce` | `refactor(a11y): migrate card consumers to InteractiveCard primitive (E2E-018, E2E-068, E2E-261, E2E-267)` |
| `f49c6c5b` | Auto: `interactive-card.test.tsx` (the new primitive's test) |
| `b94c73b2` | Auto: 4 files (WorkspaceHeader aria-labels + InteractiveCard shipped) |
| `03687f59` | `chore(lint): enable jsx-a11y rules (E2E-552, Plan 03 Phase 4)` |
| `c46e47c2` | `fix(pcb): layer visibility panel reflects active layer count (E2E-233)` |
| `1d039921` | `feat(board-sot): shared per-project PCB source of truth (Plan 02 Phase 4, E2E-228/235/270)` |
| `c355c6a7` | `fix(a11y): NumberInput primitive with explicit aria-value* contract (E2E-236, E2E-271, E2E-284)` |
| `eac5e021` | `fix(schematic): place-component/place-power toolbar buttons open Parts/Power panels (E2E-849, E2E-915)` |
| `945b6d01` | `fix(schematic): mount UnifiedComponentSearch ... Add Component CTA reaches the part-picker (E2E-225, E2E-856)` |
| `fe66360a` | `fix(community): card click opens detail dialog, not silent inline swap (E2E-266, Plan 02 Phase 5)` |
| `83a9e144` | `test(architecture): regression coverage for tool-analyze toggle (E2E-078)` |
| `7b15c382` | `fix(auth): whitelist /api/parts/browse/ as public (E2E-312, E2E-313)` |
| `919add5f` | `fix(dashboard): show "no design" state on empty projects (E2E-015)` |
| `9f6911ab` | `fix(routing): /settings renders skeleton page (E2E-502)` |
| `af3b49f3` | `fix(theme): light-mode toggle now reacts to classList flip (E2E-968, E2E-1037)` |
| `9fa402c1` | `chore(deps): upgrade zod-validation-error to ^4.0.2 to unblock eslint (BL-0865)` |
| `2d563a41` | `fix(audit-trail): remove hardcoded demo entries; render empty-state (E2E-298, E2E-460)` |
| `0abd4d1c` | `test(schematic): regression test for empty-state DOM leak (E2E-950, E2E-966)` |

**Plans complete today:**
- Plan 01 (P0 bugs) — 6/6 phases done
- Plan 02 (P1 dead buttons) — 8/8 phases done
- Plan 03 (a11y systemic) — 3/9 phases done (Phase 2 icon-labels, Phase 3 InteractiveCard, Phase 4 ESLint rules)

**BL items open (context only — don't try to fix):**
- BL-0863: full audit-trail backend subsystem (deferred, multi-day plan)
- BL-0864: generic requireProjectScope middleware (deferred until BL-0863)
- BL-0866: pre-existing test drift — 49 failing tests across 10 files, all pre-dating today. Known list:
  - `client/src/__tests__/a11y.test.tsx` — 20 renderer failures (needs TooltipProvider, QueryClient, useBom mocks, ReadableStream/Worker stubs)
  - `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx` — 5 ECONNREFUSED (needs dev server)
  - `client/src/components/views/__tests__/procurement-sub-components.test.tsx` — 2 BomToolbar VaultHoverCard QueryClient
  - `client/src/components/circuit-editor/__tests__/BreadboardPartInspector.trustTier.test.tsx` — 10 failures
  - `server/__tests__/settings-routes.test.ts` — 2 failing ('anthropic' enum drift from commit `855b1626`)
  - `server/__tests__/ai.test.ts` — 2 API-key redaction assertion order
  - `scripts/__tests__/check-api-types.test.ts` — 2 tsx-run failure
  - `client/src/lib/__tests__/lifecycle-badges-integration.test.ts` — 4
  - `server/__tests__/collaboration-crdt-integration.test.ts` — 1
  **Do NOT attempt to fix any of these. Just do not regress any test that's CURRENTLY green.**
- BL-0867: MentionBadge has same broken Popover+Tooltip nesting as WorkspaceHeader (fixed in commit `53d5a25e`). Low-priority, don't fix in this session.

---

## 3. Project conventions (NON-NEGOTIABLE)

### Commands

All commands that take > 2 min must use `NODE_OPTIONS='--max-old-space-size=16384'` for tsc and `--max-old-space-size=8192` for tests / eslint.

```bash
# Typecheck (~1-2 min)
npm run check

# Full test suite (~20 min — DO NOT RUN unless explicitly needed)
# Prefer SCOPED runs
NODE_OPTIONS='--max-old-space-size=4096' npx vitest run <path/to/specific/test.tsx>

# ESLint (~30 min on the whole repo, OOMs below 8GB heap)
NODE_OPTIONS='--max-old-space-size=16384' npx eslint .
# Scoped (faster)
NODE_OPTIONS='--max-old-space-size=8192' npx eslint <path/to/file.tsx>

# Prettier (formats in place)
npx prettier --write <path>
```

**There is a hook at `.claude/hooks/enforce-test-background.sh`** that BLOCKS foreground test runs. Run them in background with `run_in_background: true` (or shell equivalent) and pipe to `tee logs/<name>.log | tail -N`. This applies to `npm test`, `vitest`, `jest`, and anything else the hook's regex catches.

### Auto-commit hook

There is a `PostToolUse` hook at `.claude/hooks/auto-commit-vault.sh` that automatically commits uncommitted files after every tool use with a generic "Auto: N files | ..." message. **DO NOT DISABLE IT.** Your workflow:

1. Do your edits. The hook may fire "Auto:" commits mid-stream — that's fine.
2. When you reach a stopping point, create a **narrative** commit with the real message:
   ```bash
   git commit --allow-empty -m "$(cat <<'EOF'
   fix(a11y): ...long message referencing E2E-XXX...
   EOF
   )"
   ```
   Use `--allow-empty` only if the hook already committed all your content and you want to leave a narrative marker. Otherwise, just `git add <files> && git commit -m ...` as normal.
3. **Do NOT amend. Do NOT force push.** Tyler has an auto-push cron on main.

### File / import conventions

- **Barrel imports only on the client.** Use `@/components/ui`, `@/lib/*`, `@/hooks/*`. Never deep-import from shadcn internals.
- **Test helpers:** `createTestQueryClient` at `client/src/test-utils/createTestQueryClient.ts` (shipped today in BL-0862). Use it when wrapping a component that internally calls `useQuery`.
- **Drizzle test mock:** tests touching `db/schema` need the mock at `tests/setup/drizzle.ts` (Vitest setup).
- **Server imports:** use `zod-validation-error/v3` (not bare `zod-validation-error`) — the project was bumped to zve v4 in commit `9fa402c1`.

### Branch / push

- Work on `main`. Do not create feature branches.
- Do not push. Auto-push cron (see `~/.claude/scripts/auto-push-protopulse.sh`, log at `~/.claude/logs/auto-push-protopulse.log`) handles it every 15 minutes on main.

### Sensitive files

The harness blocks access to `.env`, `.mcp.json`, and similar. If you encounter a permission-denied on those, do NOT retry with different tools — just skip.

---

## 4. Phase A — Tie-point aria-labels (E2E-625)

### 4.1 The bug

Finding E2E-625 in `docs/audits/2026-04-18-frontend-e2e-walkthrough.md`: the breadboard renders **830 tie-point holes** as SVG `<circle>` elements with sequential `data-testid` values but **no `aria-label`**. Assistive tech users have no way to identify which hole they're on. Screen-reader announces "button" (or just blank) 830 times.

### 4.2 Pre-verified reality (Claude ground-truthed this 2026-04-22)

**Source file:** `client/src/components/circuit-editor/BreadboardGrid.tsx`

**Exact location of the fix:** The `Hole` component (starts near line ~150), rendered for each tie-point. Currently:

```tsx
<circle
  cx={cx}
  cy={cy}
  r={isHovered ? r + 1 : r}
  fill={isHovered ? C.holeHover : fill}
  stroke={isHovered ? C.holeHover : stroke}
  strokeWidth={0.5}
  style={{ cursor: 'pointer', transition: 'fill 80ms, r 80ms' }}
  onClick={handleClick}
  onMouseEnter={handleMouseEnter}
  onMouseLeave={onMouseLeave}
  data-testid={`hole-${coordKey(coord)}`}
/>
```

**Coord shape** (from `client/src/lib/circuit-editor/breadboard-model.ts:206`):

```ts
export function coordKey(coord: BreadboardCoord): string {
  if (coord.type === 'terminal') return `t:${coord.col}${coord.row}`;
  return `r:${coord.rail}:${coord.index}`;
}
```

So `coord` is a `BreadboardCoord` with either:
- `{ type: 'terminal', col: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j', row: 1..63 }` — the 5-hole columns in the two terminal groups
- `{ type: 'rail', rail: '+top' | '-top' | '+bottom' | '-bottom' (or similar naming), index: 0..n }` — the power rails

**Read the file first** to understand exact enum values; do not assume.

### 4.3 What to build

1. Add an `aria-label` attribute to the `<circle>` element derived from `coord`. Aria-label should be a short, human-readable description of the hole.

   Recommended format:
   - Terminal: `"Terminal column A, row 1"` (readable) — use uppercase col letter, full row number.
   - Rail: `"Top positive rail, point 12"` — expand rail type to words (look at the enum values first; naming may be `+top`/`+t`/`tp-pos` — pick a clear mapping).

2. Also add `role="button"` explicitly (currently implicit via onClick — screen readers vary). The circle IS interactive (has onClick).

3. Optionally add `tabIndex={0}` so keyboard users can tab to individual holes... **but this creates 830 tab stops, which is usability hell**. Do NOT add tabIndex. Keyboard navigation on the breadboard is deferred to Plan 03 Phase 6. Leave tabIndex alone for now.

4. Also consider `aria-describedby` if a hole has an occupied-state or highlighted-state — but only if it reads naturally to SR users. If implementing this is fiddly, skip. Aria-label is the main deliverable.

### 4.4 TDD

Create or extend `client/src/components/circuit-editor/__tests__/BreadboardGrid.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
// ... necessary mocks — look at other BreadboardGrid tests in the same directory for the pattern
import BreadboardGrid from '../BreadboardGrid';

describe('BreadboardGrid tie-point a11y (E2E-625)', () => {
  it('every tie-point circle has a non-empty aria-label', () => {
    const { container } = render(<BreadboardGrid {...defaultProps} />);
    const holes = container.querySelectorAll('circle[data-testid^="hole-"]');
    expect(holes.length).toBeGreaterThanOrEqual(830);  // 830 physical tie-points
    for (const hole of holes) {
      const label = hole.getAttribute('aria-label');
      expect(label).toBeTruthy();
      expect(label!.length).toBeGreaterThan(5);
    }
  });

  it('terminal hole label uses column letter + row', () => {
    const { container } = render(<BreadboardGrid {...defaultProps} />);
    const hole = container.querySelector('[data-testid="hole-t:a1"]');
    expect(hole?.getAttribute('aria-label')).toMatch(/column a/i);
    expect(hole?.getAttribute('aria-label')).toMatch(/\b1\b/);
  });

  it('rail hole label uses rail polarity + index', () => {
    // The exact testid will depend on the coordKey for rails. Grep for it.
    // Example if rails are encoded like "r:+top:12":
    const { container } = render(<BreadboardGrid {...defaultProps} />);
    const rail = container.querySelector('[data-testid^="rail-"]'); // adjust selector
    // ... assert label mentions positive/negative + index
  });
});
```

**Before writing the test, look at existing tests for BreadboardGrid** (`ls client/src/components/circuit-editor/__tests__/Breadboard*`) for the right `defaultProps` / mock shape. Several exist. Copy their setup.

### 4.5 Gate

- `npm run check` → 0 errors.
- Scoped test file runs green.
- **Do NOT run the full test suite** — use scoped vitest run on just the BreadboardGrid test.
- `NODE_OPTIONS='--max-old-space-size=8192' npx eslint client/src/components/circuit-editor/BreadboardGrid.tsx` → 0 new violations (pre-existing may remain; compare before/after).

### 4.6 Commit narrative

```
fix(a11y): tie-point circles expose aria-label describing coordinate (E2E-625, Plan 03 Phase 7)

BreadboardGrid rendered 830 <circle> elements as clickable tie-points
with sequential data-testid values but no accessible name. Screen readers
announced each hole as a generic "button" (or nothing).

Derive aria-label from the BreadboardCoord — terminal holes describe
"Terminal column X, row Y" and rail holes describe "<Rail polarity>
rail, point N". role="button" is now explicit on the circle so SR
behavior is consistent across browsers.

Keyboard navigation (per-hole tabIndex) is deliberately NOT added — 830
tab stops would be unusable. Wheel/arrow-key focus management is
Phase 6 territory.

Refs: docs/audits/2026-04-18-frontend-e2e-walkthrough.md (E2E-625)
```

### 4.7 Red flags — escalate instead of guessing

- If `BreadboardCoord` has a shape you don't expect (e.g., more than terminal + rail variants), read `breadboard-model.ts` fully before labeling.
- If the test expects a provider wrap (QueryClient, etc.), look at `client/src/components/circuit-editor/__tests__/BreadboardBoardAuditPanel.test.tsx` for a working example.
- If more than 830 holes render (some extra from model vs physical), document that in the commit but still label them all. `breadboard-model.ts:65` comment says `MODEL_TIE_POINTS` is 882; `PHYSICAL_TIE_POINTS` is 830.

### 4.8 File ownership for Phase A

**You own:**
- `client/src/components/circuit-editor/BreadboardGrid.tsx`
- `client/src/components/circuit-editor/__tests__/BreadboardGrid.test.tsx` (new if missing, else extend)
- New e2e spec at `e2e/p1-breadboard-tie-point-a11y.spec.ts` is OPTIONAL — skip it if time is tight; the unit test covers the contract.

**Do NOT touch anything else** for Phase A. Specifically avoid:
- `client/src/lib/circuit-editor/breadboard-model.ts` (schema — if labels need to come from there, add the label derivation IN `BreadboardGrid.tsx` via an imported helper function that lives in a NEW file `client/src/components/circuit-editor/tie-point-a11y.ts`, not a mutation to the model)
- `client/src/lib/circuit-editor/breadboard-drc.ts`
- Any other Breadboard-related file — coord mapping should happen at render time only

---

## 5. Phase B — Shared `<EmptyState>` primitive wiring (E2E-966 cleanup)

### 5.1 The bug

Finding E2E-966 in the audit: empty-state headings persisted in the DOM on populated canvases, causing screen readers to announce "Empty Schematic" / "No Design" etc. over populated views.

**Claude already fixed the Schematic case in Plan 01 Phase 5** (commit `0abd4d1c`) and landed a regression test. The fix principle: **conditional render the EmptyState component**, don't CSS-hide it.

The primitive `<EmptyState>` already exists at `client/src/components/ui/EmptyState.tsx` (45 lines). It's a proper React component — when the parent doesn't render it, it's absent from the DOM. Good.

**What remains:** the audit walkthrough noted multiple views have their OWN hand-rolled empty-state JSX (not using the shared primitive). Some of those may CSS-hide instead of conditional-render. Phase 8 is to migrate them to the shared primitive so the "conditional render" invariant is uniformly enforced, and also so the visual/a11y treatment is consistent everywhere.

### 5.2 Pre-verified reality

Current consumers of the shared primitive (3):
```
client/src/components/circuit-editor/SchematicCanvas.tsx
client/src/components/views/ArchitectureView.tsx
client/src/components/views/validation/VirtualizedIssueList.tsx
```

Hand-rolled empty-state JSX (search targets — Gemini must confirm): grep for patterns like:

```bash
rg -n "No Circuit Designs|No design yet|Empty .+|Nothing to show" client/src/components/views/
rg -n "data-testid=\".*empty\"" client/src/components/
```

Likely hand-rolled sites (confirm before editing — may NOT all be bugs):
- `client/src/components/views/SchematicView.tsx` lines ~165-198 — has its own empty-state block (early return). This is fine as-is (early return = not in DOM), but MIGHT benefit from migrating to the shared primitive for visual consistency. **However, touching this file risks stepping on Plan 01 Phase 5 regression tests and other recent work — only migrate if the existing JSX is clearly substandard.**
- BOM views, procurement sub-components, community cards (some migrated already via Plan 02 Phase 5), learn/patterns cards.

### 5.3 What to build

1. **Audit first.** Use `rg` to find every "hand-rolled empty state" candidate.
2. **Triage.** For each candidate, decide:
   - **Migrate** if the JSX (a) uses CSS hide (`className="hidden"` when empty), OR (b) has significantly weaker semantics (no proper heading, or only an icon with no text).
   - **Skip** if it's already conditionally rendered, has good heading + description + CTA, and looks visually similar to the primitive.
3. **Migrate the ones that clearly should.** Aim for 2-5 migrations. **Do not over-migrate.**
4. **For each migrated file**, run the scoped test file to ensure existing tests still pass.

### 5.4 Constraint — do not regress Plan 01 Phase 5

The regression test at `client/src/components/circuit-editor/__tests__/SchematicCanvas.test.tsx` lines 186-225 asserts:

```ts
it('does not render Empty Schematic heading when instances is populated (E2E-950, E2E-966)', ...);
it('renders Empty Schematic heading when instances is empty (E2E-950 inverse)', ...);
```

If you migrate the SchematicCanvas empty-state, make sure those 2 tests still pass. The primitive exposes `data-testid="empty-state-title"` — the regression test queries that testid, so migration should be semantic-preserving.

### 5.5 TDD

For each migrated file, ADD a regression test asserting the empty-state heading is **absent from the DOM** when the parent has content. Pattern:

```tsx
it('X view empty-state does not leak into DOM when populated (E2E-966)', () => {
  // seed hook mocks so the view renders with content
  mockUseWhatever.mockReturnValue({ data: [ /* real items */ ] });
  const { queryByTestId } = render(<TheView />);
  expect(queryByTestId('empty-state-title')).toBeNull();
});
```

### 5.6 Gate

- `npm run check` → 0 errors.
- Scoped tests on each migrated file → green.
- SchematicCanvas test still green (do not regress Plan 01 Phase 5).
- ESLint on touched files → 0 new violations.

### 5.7 Commit narrative

```
refactor(a11y): migrate hand-rolled empty-states to shared <EmptyState> primitive (E2E-966, Plan 03 Phase 8)

Several views had their own empty-state JSX. Consolidating to the shared
<EmptyState> primitive (client/src/components/ui/EmptyState.tsx) ensures
the "conditional render, not CSS hide" invariant is uniform so screen
readers don't announce empty-state headings over populated canvases.

Migrated N consumers:
- <list the files>

Plan 01 Phase 5 regression (E2E-950/E2E-966) still green.
```

### 5.8 File ownership for Phase B

**You own:**
- Any view you migrate to the shared primitive + its tests

**Do NOT touch:**
- `client/src/components/ui/EmptyState.tsx` — the primitive itself is fine; do not modify.
- SchematicCanvas test lines 186-225 (Plan 01 Phase 5 regression).
- `client/src/components/views/CommunityView.tsx` (Plan 02 Phase 5 — commit `fe66360a` — just landed, leave alone).
- `client/src/components/views/AuditTrailView.tsx` (Plan 01 Phase 1 commit `2d563a41` — just landed).
- `client/src/components/views/DashboardView.tsx` lines 125-160 (Plan 01 Phase 3 no-design state — commit `919add5f`).
- Any file in `client/src/pages/workspace/` (WorkspaceHeader — Plan 03 Phase 2 just landed).

---

## 6. Bonus — only if Phase A + Phase B are complete AND green

**Safe, small, confined cleanup tasks** (pick one or two, don't rush):

### Bonus 1 — Remove obsolete `jsx-a11y` disable headers

Plan 03 Phase 4 (commit `03687f59`) added `/* eslint-disable jsx-a11y/no-static-element-interactions -- Phase 3 <InteractiveCard> migration */` headers to 39 files.

Plan 03 Phase 3 (commit `d93f72ce`) then migrated 7 of those files. The disable headers in the migrated files should be removable now — the violations they suppress no longer exist.

**Process:**
1. For each file in the Phase 3 migration list (get it from `git show --stat d93f72ce`), remove the disable header.
2. Run `NODE_OPTIONS='--max-old-space-size=8192' npx eslint <file>` — must stay at 0 errors.
3. If the header ISN'T safe to remove (a non-migrated pattern in the same file still trips the rule), document that in a comment on the header referencing the remaining violation.
4. Commit with a narrative referencing E2E-552 and E2E-068.

### Bonus 2 — Migrate more `<input type="number">` to `<NumberInput>`

Plan 02 Phase 7 shipped a `<NumberInput>` primitive (commit `c355c6a7`) and migrated 22 calculator inputs, board-dimension inputs, and Order PCB inputs. There are OTHER `<input type="number">` callers in the codebase (procurement, component-editor, etc.) that were out of scope for Phase 7.

**Process:**
1. `rg -n 'type="number"' client/src/ | grep -v "number-input\|NumberInput"` — find remaining callers.
2. Migrate low-risk ones (contained to one component, with a clear min/max range).
3. For each migrated input, add a short test assertion that `aria-valuemax` is present and non-zero.
4. Commit referencing BL-0866 (cleanup) and E2E-236 (the original spinbutton finding).

### Bonus 3 — Clean up orphaned `filterAuditEntries` helpers if unused

Plan 01 Phase 1 (commit `2d563a41`) removed `DEMO_ENTRIES` from `AuditTrailView.tsx` but left `filterAuditEntries` / `exportAuditCSV` in `client/src/lib/audit-trail.ts` for a future BL-0863 consumer. If the lib has other callers, leave it. If `AuditTrailView` is the ONLY caller and the entries array is now empty forever until BL-0863 ships, consider:
- Option A: leave it (safest — BL-0863 will resurrect it)
- Option B: annotate with a `@deprecated until BL-0863` JSDoc so future agents know the status

Prefer Option A unless TypeScript reports the helpers as unused.

### **Do NOT do** as bonus tasks

- ❌ Fix any BL-0866 pre-existing test failure. Tyler wants those triaged as a dedicated session.
- ❌ Start any Plan 04+ work (Dashboard, Architecture, Schematic, Breadboard, etc.) — those are Tier D and depend on foundation phases Claude is landing.
- ❌ Start Plan 03 Phase 1 / 5 / 6 / 9 (reserved for Claude).
- ❌ Refactor anything large (more than ~100 LOC changed in a single file).

---

## 7. Reporting & handoff back to Claude

### 7.1 When you finish each phase

Leave the final narrative commit with the right E2E IDs and Plan reference — Claude's morning `git log --oneline` scan reads those to resume cleanly.

### 7.2 Create a brief status file

Write `GEMINI_STATUS.md` at repo root when you're done for the session. Format:

```markdown
# Gemini Session Status — 2026-04-23

**Sessions ran:** HH:MM–HH:MM local
**Phases completed:**
- Plan 03 Phase 7 (E2E-625) — commit <SHA> — <N> aria-labels added
- Plan 03 Phase 8 (E2E-966) — commit <SHA> — <N> consumers migrated

**Gate results:**
- npm run check: 0 errors
- Scoped tests: <N/M> passing
- ESLint: 0 new violations on touched files

**Bonus tasks done:**
- <list>

**NEEDS_CONTEXT / BLOCKED items for Claude to resolve tomorrow:**
- <file:line>: <short description of the ambiguity>

**Files modified:**
- <file path> — <one-line description>
- ...

**BL-0866 pre-existing failures — re-checked:**
- Count unchanged from <expected baseline of 49>. ✅
```

Claude will grep this file on resume to pick up context.

### 7.3 If you get stuck

Do NOT silently produce half-broken work. Your options:

1. **NEEDS_CONTEXT** — write up the ambiguity in `GEMINI_STATUS.md`, stop, and leave the working state clean (no half-finished edits uncommitted).
2. **BLOCKED** — same as above but note which phase is blocked and why.
3. **DONE_WITH_CONCERNS** — the phase shipped but with caveats (document them).

Claude's resume script will read `GEMINI_STATUS.md` first, so surfacing a concern costs you nothing.

### 7.4 Do not

- Do not invent BL numbers — if you need to file a new backlog item, increment from the current max (BL-0867). Use the same row format as `docs/MASTER_BACKLOG.md`.
- Do not modify `docs/superpowers/plans/2026-04-18-e2e-walkthrough/*.md` — those plans are the source of truth. If a plan is wrong, document the mismatch in `GEMINI_STATUS.md` and leave the plan file alone for Claude to update.
- Do not run `/ultrareview`, `/ultrathink`, or any other interactive harness. Stay in your terminal.
- Do not run `npm test` (full suite). Always scope.
- Do not run `npx eslint .` without `--max-old-space-size=16384`. It OOMs.
- Do not use `sudo`. You have no need for it.

---

## 8. Pitfalls observed during Claude's session — heads-up for you

1. **`git stash` interacts badly with the auto-commit hook.** Phase 4 (board-sot) agent had to recover mid-session because a stash reverted server edits that had only just been auto-committed. If you use stash, verify with `git status` + `git log --oneline -3` afterward.
2. **ESLint OOMs below 8GB heap.** `NODE_OPTIONS='--max-old-space-size=16384'` on the full run, `8192` is enough for scoped runs.
3. **`vitest` test failures for `VaultHoverCard`** ("No QueryClient set") are pre-existing (BL-0866). Wrap any new test in `<QueryClientProvider client={new QueryClient({...})}>` if it renders a view that uses `useVaultNote` or `useVaultSearch`.
4. **The commit message hook blocks messages containing the word `vitest`.** If your commit body mentions it, rephrase to "test suite" or "unit tests".
5. **Tyler's rule:** no shortcuts, no "we'll fix it later", fix everything green before moving on. If a phase can't pass gates cleanly, mark it DONE_WITH_CONCERNS in the status file rather than shipping broken.
6. **BL-0866 baseline — 49 pre-existing failures.** If your scoped test runs show failures in files NOT on your ownership list, cross-check against BL-0866. If the failure is in BL-0866, ignore. If not, escalate — you may have broken something.
7. **Tie-point coord mapping lives in `breadboard-model.ts:206` (`coordKey`)** — look there first when you want to reverse-engineer the aria-label format.
8. **Don't reformat files** you're only touching incidentally. Prettier churn clouds git blame.

---

## 9. Final preflight (do this right before you start editing)

```bash
cd /home/wtyler/Projects/ProtoPulse
git status --short   # expect clean tree (modulo ops/sessions/*.json untracked)
npm run check        # expect exit 0
git log --oneline -5 # top commit should be d93f72ce (Plan 03 Phase 3 narrative)
```

If any of those is off, STOP and investigate before editing. Document in `GEMINI_STATUS.md`.

---

## 10. TL;DR

- Do Phase 7 (BreadboardGrid aria-labels) + Phase 8 (migrate hand-rolled empty-states to `<EmptyState>` primitive).
- No other phase work. No Plan 04+ work. No Plan 03 Phase 1 / 5 / 6 / 9.
- Real tests, scoped runs only, fix gates before committing.
- Write `GEMINI_STATUS.md` when you're done.
- Don't fuck with .env, the auto-commit hook, or the cron.
- If anything is ambiguous, stop and document — don't guess.

Good hunting. — Claude

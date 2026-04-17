# Breadboard Testing And Browser Verification

## Test Surface Overview

The Breadboard tab has **~20 test files** — roughly equal split between component and pure-lib tests.

### Component tests (happy-dom + Testing Library)

| File | Covers |
|---|---|
| `BreadboardView.test.tsx` | Shell integration, tab mounting, mode toggles |
| `BreadboardComponentRenderer.test.tsx` | SVG footprint rendering per part family |
| `BreadboardConnectivityExplainer.test.tsx` | Tooltip copy + hover behavior |
| `BreadboardExactPartRequestDialog.test.tsx` | Resolve-result rendering (verified/candidate/draft/ambiguous) |
| `BreadboardGridDropPreview.test.tsx` | Drop preview snap + fit-zone |
| `BreadboardGridFitZone.test.tsx` | Grid fit-zone accuracy |
| `BreadboardQuickIntake.test.tsx` | Onboarding prompt flow |
| `BreadboardReconciliationPanel.test.tsx` | Stash vs BOM delta display |
| `BreadboardShoppingList.test.tsx` | Shortfall → buy-list rendering |
| `BreadboardWireEditor.test.tsx` | Wire selection/move/delete + endpoint snap preview |
| `breadboard-animations.test.ts` | CSS keyframe integrity |
| `breadboard-components.test.tsx` | Component-library rendering |

### Pure-lib tests (node / fast)

| File | Covers |
|---|---|
| `breadboard-3d.test.ts` | 3D mesh generation |
| `breadboard-ai-prompts.test.ts` | Prompt template integrity, trust-tier preservation |
| `breadboard-bench.test.ts` | Per-part readiness classification |
| `breadboard-board-audit.test.ts` | Audit issue generation + severity ordering |
| `breadboard-coach-plan.test.ts` | Plan derivation per selected-part scenario |
| `breadboard-layout-quality.test.ts` | Scoring invariants (monotonic improvement, floor/ceiling) |
| `breadboard-part-inspector.test.ts` | Trust derivation + confidence math |
| `breadboard-preflight.test.ts` | Gate pass/fail per stash + design state |
| `breadboard-connectivity.test.ts` | Net graph computation |
| `breadboard-drag-move.test.ts` | Drag semantics with snap |
| `breadboard-drc.test.ts` | Rule engine firing |
| `breadboard-model.test.ts` | Occupancy + collision |
| `breadboard-undo.test.ts` | Undo/redo stack invariants |
| `breadboard-wire-editor.test.ts` | Wire primitive operations |
| `useBreadboardCursor.test.ts` | Cursor state machine |

### E2E (Playwright)

| File | Covers |
|---|---|
| `e2e/breadboard-fit.spec.ts` | Full fit-check flow in a real browser |
| `e2e/navigation.spec.ts` | Tab navigation (breadboard mount/unmount) |
| `e2e/accessibility.spec.ts` | WCAG AA scan including breadboard views |

## The Right Test For The Change

| Change shape | Write this test type |
|---|---|
| New pure function in a `-lib` file | Pure-lib test with input/output table |
| New rule in audit/DRC/layout-quality | Pure-lib test with positive + negative fixtures |
| New dialog / panel / shelf | Component test with Testing Library |
| Cross-subsystem integration (coach → plan → overlay) | Component test mounting the full shell |
| Visual regression (drop preview, snap halo) | Component test + real-browser screenshot |
| Full workflow (place → wire → inspect) | Playwright E2E |

**Rule of thumb:** If the change affects what a user *sees* or *does*, you need at least a component test. If it's pure logic, a lib test is sufficient.

## Writing A Good Breadboard Test

### Component Test Skeleton

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BreadboardFoo } from '../BreadboardFoo';

describe('BreadboardFoo', () => {
  it('renders verified-exact label when tier = verified-exact', () => {
    render(<BreadboardFoo part={{ trustTier: 'verified-exact', ... }} />);
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
    expect(screen.queryByText(/draft/i)).not.toBeInTheDocument();
  });

  it('distinguishes connector-defined from heuristic in trust label', () => {
    const { rerender } = render(<BreadboardFoo part={{ trustTier: 'connector-defined', ... }} />);
    expect(screen.getByText(/pins defined/i)).toBeInTheDocument();

    rerender(<BreadboardFoo part={{ trustTier: 'heuristic', ... }} />);
    expect(screen.getByText(/inferred/i)).toBeInTheDocument();
    // CRITICAL: these two labels MUST be different strings
  });
});
```

### Pure-Lib Test Skeleton

```typescript
import { describe, it, expect } from 'vitest';
import { deriveReadiness } from '../breadboard-bench';

describe('deriveReadiness', () => {
  it('returns stash-absent when BOM qty > stash qty', () => {
    const result = deriveReadiness({ bomQty: 5, stashQty: 3, ... });
    expect(result.tier).toBe('stash-absent');
    expect(result.message).toMatch(/2 more needed/);
  });

  it('returns verified-exact when part.source === "verified-board" and stash >= bom', () => {
    const result = deriveReadiness({ partSource: 'verified-board', bomQty: 1, stashQty: 1, ... });
    expect(result.tier).toBe('verified-exact');
  });
});
```

### Invariant Tests (use these for scoring / classification)

```typescript
it('layout quality score is monotonic: adding a decoupling cap never lowers score', () => {
  const before = scoreLayout({ components: [...] });
  const after = scoreLayout({ components: [...componentsWithDecouplerAdded] });
  expect(after.total).toBeGreaterThanOrEqual(before.total);
});

it('trust derivation is deterministic: same input → same output', () => {
  const a = deriveTrust(input);
  const b = deriveTrust(input);
  expect(a).toEqual(b);
});
```

## Real-Browser Verification Checklist

After any Breadboard UI change:

- [ ] Open the live app (`npm run dev`) and navigate to Breadboard tab
- [ ] Take `mcp__chrome-devtools__take_snapshot` to capture DOM state
- [ ] Exercise the changed flow end-to-end
- [ ] Take a `take_screenshot` at key states (before, during, after)
- [ ] Check `list_console_messages` — MUST be clean
- [ ] If layout changed, resize viewport to 1024 and re-verify
- [ ] If focus changed, tab through keyboard navigation
- [ ] If trust tier displayed, verify all 4 tiers render distinctly
- [ ] If stash involved, verify shortfall math matches visible count

### Concrete DevTools Commands

```
# Open the breadboard tab
mcp__chrome-devtools__click('[data-testid="sidebar-breadboard"]')

# Snapshot the DOM
mcp__chrome-devtools__take_snapshot()

# Verify no console errors
mcp__chrome-devtools__list_console_messages()

# Screenshot at full page
mcp__chrome-devtools__take_screenshot({ fullPage: true })

# Verify trust label rendered
# (find the part card, check its text)
```

## Minimum Real Flows (per change shape)

### A. Placement / geometry change
1. Empty board
2. Drop a starter resistor — verify snap preview
3. Drop a DIP IC — verify center-channel straddle
4. Drop a too-large module — verify "off-board-only" rejection
5. Console clean throughout

### B. Trust / readiness change
1. Board with 3 parts: verified-exact, connector-defined, heuristic
2. Verify each shows distinct icon + label + color
3. Open inspector on heuristic part — verify "Inferred" copy + warning
4. Add stash for one part — verify stash-absent → stash-satisfied transition

### C. Coach change
1. Board with selected part that has a known coach plan (e.g., I2C device)
2. Verify coach overlay fires
3. Apply one step — verify preview → apply transition
4. Verify undo returns to pre-coach state

### D. Audit / DRC change
1. Board with a known violating configuration (e.g., I2C without pull-ups)
2. Verify DRC overlay lights up the affected pins
3. Verify audit panel lists the issue at the right severity
4. Apply the suggested fix — verify overlay clears

### E. Sync change
1. Add a net in schematic view
2. Flip to breadboard — verify wire present + marked "Synced from schematic"
3. Delete in schematic — verify breadboard reflects removal
4. Add manual wire in breadboard — verify it does NOT appear as synced

### F. Exact-part change
1. Click exact-part request → type verified MPN → verify resolves to verified-exact
2. Type ambiguous MPN ("ESP32") → verify ambiguous-match surface
3. Type unknown MPN → verify needs-draft flow opens
4. Accept draft → verify it appears with "Draft" label + warning

## Done Criteria (must all be TRUE)

Do not call Breadboard work done until:

- [ ] Targeted Vitest coverage exists or was updated for the change
- [ ] Standalone `npx vitest run <file>` passes (hook runs frequently OOM — trust standalone)
- [ ] `npm run check` passes cleanly (requires 16GB heap; set `NODE_OPTIONS='--max-old-space-size=16384'`)
- [ ] The relevant flow was verified in a real browser
- [ ] Claimed UX improvement is visible in the browser, not only implied by code
- [ ] Trust-tier language is consistent with `verified-exact` / `connector-defined` / `heuristic` / `stash-absent` (never invent new tier names)
- [ ] Any new knowledge got captured in `knowledge/` via `/arscontexta:extract`

## When Hooks Falsely Fail

The PostToolUse hooks `claudekit-hooks run test-changed` and `typecheck-changed` have a known OOM-SIGTERM bug when multiple agents run concurrently. Symptom: hook reports "Tests failed" or "TypeScript compilation failed" with only a "RUN" banner and no diagnostic output — actual file is `Terminated` (exit 143).

**Ground-truth by running standalone:**
```bash
NODE_OPTIONS='--max-old-space-size=16384' npx vitest run <path> 2>&1 | tee logs/X.log | tail -10
NODE_OPTIONS='--max-old-space-size=16384' npx tsc --noEmit 2>&1 | tee logs/Y.log | tail -5
```

If standalone passes and the hook's diagnostic is "Terminated" with no error content, the hook lied.

## The Anti-Pattern Detector

Before every commit, run this mental check:

```typescript
// Does your change collapse trust tiers?
const tiers = ['verified-exact', 'connector-defined', 'heuristic', 'stash-absent'];
for (const t of tiers) {
  const rendered = render(<YourComponent tier={t} />);
  // The on-screen copy MUST differ for each tier
}
```

If two tiers render identically, you broke the provenance invariant.

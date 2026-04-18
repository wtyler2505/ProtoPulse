# Breadboard Testing And Browser Verification

## Test Surface Overview

The Breadboard tab has ~20 test files — roughly equal split between component and pure-lib tests.

### Component tests (happy-dom + Testing Library)

| File | Covers |
|---|---|
| `BreadboardView.test.tsx` | Shell integration, tab mounting, mode toggles |
| `BreadboardComponentRenderer.test.tsx` | SVG footprint rendering per part family |
| `BreadboardConnectivityExplainer.test.tsx` | Tooltip copy + hover behavior |
| `BreadboardExactPartRequestDialog.test.tsx` | Resolve-result rendering |
| `BreadboardGridDropPreview.test.tsx` | Drop preview snap + fit-zone |
| `BreadboardGridFitZone.test.tsx` | Grid fit-zone accuracy |
| `BreadboardQuickIntake.test.tsx` | Onboarding prompt flow |
| `BreadboardReconciliationPanel.test.tsx` | Stash vs BOM delta display |
| `BreadboardShoppingList.test.tsx` | Shortfall to buy-list rendering |
| `BreadboardWireEditor.test.tsx` | Wire edits + endpoint snap |
| `breadboard-animations.test.ts` | CSS keyframe integrity |
| `breadboard-components.test.tsx` | Component-library rendering |

### Pure-lib tests (node / fast)

| File | Covers |
|---|---|
| `breadboard-3d.test.ts` | 3D mesh generation |
| `breadboard-ai-prompts.test.ts` | Prompt template integrity, trust-tier preservation |
| `breadboard-bench.test.ts` | Per-part readiness classification |
| `breadboard-board-audit.test.ts` | Audit issue generation + severity |
| `breadboard-coach-plan.test.ts` | Plan derivation per scenario |
| `breadboard-layout-quality.test.ts` | Scoring invariants |
| `breadboard-part-inspector.test.ts` | Trust derivation + confidence |
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
| New pure function in a lib file | Pure-lib test with input/output table |
| New rule in audit/DRC/layout-quality | Pure-lib test, positive + negative fixtures |
| New dialog / panel / shelf | Component test with Testing Library |
| Cross-subsystem integration | Component test mounting the full shell |
| Visual regression | Component test + real-browser screenshot |
| Full workflow (place, wire, inspect) | Playwright E2E |

**Rule:** If users see/do it, component test. If pure logic, lib test.

## Component Test Skeleton

```typescript
import { render, screen } from '@testing-library/react';
import { BreadboardFoo } from '../BreadboardFoo';

describe('BreadboardFoo', () => {
  it('renders verified-exact label when tier is verified-exact', () => {
    render(<BreadboardFoo part={{ trustTier: 'verified-exact' }} />);
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
  });
});
```


## Browser Verification Checklist

After any Breadboard UI change:

- Open live app (`npm run dev`), navigate to Breadboard tab
- `mcp__chrome-devtools__take_snapshot` — capture DOM
- Exercise the changed flow end-to-end
- `mcp__chrome-devtools__take_screenshot({ fullPage: true })` at key states
- `mcp__chrome-devtools__list_console_messages` — MUST be clean
- Layout change → resize viewport to 1024
- Focus change → tab through keyboard navigation
- Trust tier change → verify all 4 tiers render distinctly
- Stash involved → verify shortfall math matches visible count

## Hook OOM Workaround

PostToolUse hooks `test-changed` and `typecheck-changed` have a known OOM-SIGTERM bug when multiple agents run concurrently. Symptom: hook reports failure with only a RUN banner and no error content.

**Ground-truth standalone:**
```bash
NODE_OPTIONS='--max-old-space-size=16384' npx vitest run <path> 2>&1 | tee logs/X.log | tail -10
NODE_OPTIONS='--max-old-space-size=16384' npx tsc --noEmit 2>&1 | tee logs/Y.log | tail -5
```

If standalone passes with exit 0, trust that. The hook lied.

## Done Criteria

Not done until ALL true:
- Targeted Vitest coverage exists/updated
- Standalone `npx vitest run <file>` passes
- `npm run check` exit 0
- Flow verified in real browser
- UX improvement visible in browser, not only implied by code
- Trust-tier language consistent with the 4 canonical tiers
- New knowledge captured in `knowledge/`

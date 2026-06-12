# Breadboard Testing And Browser Verification

## Test Surface Overview (verified 2026-06-11)

The Breadboard surface has 50+ test files across four directories. Tests for the extracted subsystems live NEXT TO the subsystem (`breadboard-view/__tests__/`, `breadboard-canvas/__tests__/`), not in the top-level `__tests__/`.

### Component tests — `client/src/components/circuit-editor/__tests__/`

| File | Covers |
|---|---|
| `BreadboardView.test.tsx` | Shell integration, tab mounting, mode toggles |
| `BreadboardBenchPartRenderer.test.tsx` | Off-board part rendering + bench pins |
| `BreadboardBoardAuditPanel.test.tsx` | Audit panel rendering, severity sort, focus links |
| `BreadboardCoachOverlay.test.tsx` | Coach plan overlay rendering |
| `BreadboardComponentRenderer.test.tsx` | SVG footprint rendering per part family |
| `breadboard-components.test.tsx` | Component-library rendering (the `breadboard-components/` SVGs) |
| `BreadboardConnectivityExplainer.test.tsx` | Tooltip copy + hover behavior |
| `BreadboardConnectivityOverlay.test.tsx` | Net graph overlay rendering |
| `BreadboardDrcOverlay.test.tsx` | In-canvas DRC violation rendering |
| `BreadboardExactPartRequestDialog.test.tsx` | Resolve-result rendering |
| `BreadboardGrid.test.tsx` | Hole grid rendering |
| `BreadboardGridDropPreview.test.tsx` | Drop preview snap + fit-zone |
| `BreadboardGridFitZone.test.tsx` | Grid fit-zone accuracy |
| `BreadboardInventoryDialog.test.tsx` | Stash browser dialog |
| `BreadboardPartInspector.trustTier.test.tsx` | Inspector trust-tier rendering (all 4 tiers) |
| `BreadboardQuickIntake.test.tsx` | Onboarding prompt flow |
| `BreadboardReconciliationPanel.test.tsx` | Stash vs BOM delta display |
| `BreadboardShoppingList.test.tsx` | Shortfall to buy-list rendering |
| `BreadboardStarterShelf.test.tsx` | Starter shelf rendering + drag |
| `BreadboardWireEditor.test.tsx` | Wire edits + endpoint snap |
| `BreadboardWorkbenchSidebar.test.tsx` | Right-rail composition |
| `CoachLearnMoreCard.test.tsx` | Coach vault-link card |
| `breadboard-animations.test.ts` | CSS keyframe integrity |

### View-shell tests — `breadboard-view/__tests__/`

| File | Covers |
|---|---|
| `BreadboardToolbar.test.tsx` | Mode toggles, zoom, grid controls |
| `BreadboardDialogs.test.tsx` | Dialog mounting extracted from the shell |
| `BreadboardEmptyState.test.tsx` | No-circuit empty state |
| `useBreadboardDialogState.test.ts` | Dialog open/close state hook |

### Canvas tests — `breadboard-canvas/__tests__/`

| File | Covers |
|---|---|
| `canvas-helpers.test.ts` | Placement/drop pure helpers (`getDropTypeFromPart`, `buildPlacementForDrop`, …) |
| `canvas-leaf-components.test.tsx` | `CanvasToolbar`, `WireColorMenu`, `CanvasCoordinateReadout`, `CanvasEmptyGuidance` |
| `useCanvasViewport.test.ts` | Zoom/pan viewport state |

### Pure-lib tests — `client/src/lib/__tests__/`

| File | Covers |
|---|---|
| `breadboard-3d.test.ts` | 3D mesh generation |
| `breadboard-ai-prompts.test.ts` | Prompt template integrity, trust-tier preservation |
| `breadboard-bench.test.ts` | Per-part readiness classification |
| `breadboard-board-audit.test.ts` | Audit issue generation + severity |
| `breadboard-coach-plan.test.ts` | Plan derivation per scenario |
| `breadboard-layout-quality.test.ts` | Scoring invariants |
| `breadboard-part-inspector.test.ts` | Trust derivation + confidence |
| `breadboard-part-inspector.trust-tier.test.ts` | Trust-tier classification edge cases |
| `breadboard-preflight.test.ts` | Gate pass/fail per stash + design state |

### Model/sync tests — `client/src/lib/circuit-editor/__tests__/`

| File | Covers |
|---|---|
| `breadboard-bench-connectors.test.ts` | Bench-pin endpoint definitions |
| `breadboard-connectivity.test.ts` | Net graph computation |
| `breadboard-constants.test.ts` + `breadboard-constants.module.test.ts` | Grid geometry constants |
| `breadboard-drag-move.test.ts` | Drag semantics with snap |
| `breadboard-drc.test.ts` | Rule engine firing |
| `breadboard-model.test.ts` | Occupancy + collision |
| `breadboard-undo.test.ts` | Undo/redo stack invariants |
| `breadboard-wire-editor.test.ts` | Wire primitive operations |
| `useBreadboardCursor.test.ts` | Cursor state machine |
| `view-sync-empty-pin-id.test.ts` / `view-sync-provenance.test.ts` / `view-sync-stress.test.ts` | Schematic ↔ breadboard sync invariants |

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

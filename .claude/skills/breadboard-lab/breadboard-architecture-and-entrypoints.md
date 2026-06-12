# Breadboard Architecture And Entrypoints

> Layout verified 2026-06-11 (post-extraction refactor). Search by symbol name, never by line number — line numbers rot.

## The File That Governs Everything

**`client/src/components/circuit-editor/BreadboardView.tsx` (~700 lines)** is the orchestration shell. Nothing happens in the Breadboard tab that doesn't flow through this file — but most of the meat was extracted into the `breadboard-view/` and `breadboard-canvas/` subdirectories. BreadboardView composes them.

Key symbols and where they live NOW (search by name):

| Symbol | Home | Responsibility |
|---|---|---|
| `BreadboardView` (default export) | `BreadboardView.tsx` | Top-level component. Wires toolbar, canvas, sidebar, overlays, dialogs, coach. |
| `BreadboardToolbar` | `breadboard-view/BreadboardToolbar.tsx` | Mode toggles (wire / select / place), zoom, grid controls, undo/redo |
| `BreadboardDialogs` | `breadboard-view/BreadboardDialogs.tsx` | All dialog mounting extracted out of the shell |
| `BreadboardEmptyState` | `breadboard-view/BreadboardEmptyState.tsx` | No-circuit empty state |
| `useBreadboardDialogState` | `breadboard-view/useBreadboardDialogState.ts` | Dialog open/close state hook |
| `BreadboardCanvas` | `breadboard-canvas/index.tsx` | Grid + components + overlays SVG layer composition (the biggest single file, ~1,650 lines) |
| `buildAutoPlacementTemplate` | `breadboard-canvas/canvas-helpers.ts` | Converts circuit-instance + ComponentPart → initial breadboard placement |
| `findAutoPlacement` | `breadboard-canvas/canvas-helpers.ts` | Finds an empty slot on the board for auto-placement |
| `getDropTypeFromPart` | `breadboard-canvas/canvas-helpers.ts` | Classifies drop behavior by part family |
| `isDipLikeType` | `breadboard-canvas/canvas-helpers.ts` | DIP-heuristic for center-channel straddling placement |
| `buildPlacementForDrop` | `breadboard-canvas/canvas-helpers.ts` | Merges drag payload + drop target → final placement |
| `placementAnchorPixel` | `breadboard-canvas/canvas-helpers.ts` | Placement → pixel anchor conversion |
| `WIRE_COLORS` | `breadboard-canvas/canvas-helpers.ts` | Wire color palette (user can cycle per wire) |
| `useCanvasViewport` | `breadboard-canvas/useCanvasViewport.ts` | Zoom/pan viewport state |
| `useBreadboardCoachPlan` | `useBreadboardCoachPlan.ts` (in `components/circuit-editor/`, NOT `lib/`) | Coach plan React hook (~650 lines) |

All paths above are relative to `client/src/components/circuit-editor/`. If Breadboard feels buggy, confusing, or inconsistent, the root cause is **usually** in one of those symbols — either an orchestration gap (something never mounts), a state-truth issue (props drift from actual state), or a wiring gap between subsystems.

## Complete Subsystem Map

### 0. The Three Extracted Subdirectories (new since the refactor)

| Directory | Purpose |
|---|---|
| `breadboard-view/` | View-shell pieces extracted from BreadboardView: `BreadboardToolbar.tsx`, `BreadboardDialogs.tsx`, `BreadboardEmptyState.tsx`, `useBreadboardDialogState.ts` (each has tests in `breadboard-view/__tests__/`) |
| `breadboard-canvas/` | The canvas subsystem: `index.tsx` (`BreadboardCanvas`), `canvas-helpers.ts` (placement/drop pure helpers), `useCanvasViewport.ts`, `CanvasToolbar.tsx`, `WireColorMenu.tsx`, `CanvasCoordinateReadout.tsx`, `CanvasEmptyGuidance.tsx` (tests in `breadboard-canvas/__tests__/`) |
| `breadboard-components/` | ~20 per-part-family SVG renderers (`ResistorSvg`, `LedSvg`, `IcSvg`, `ConnectorSvg`, `MotorSvg`, …) exported via `index.ts` barrel; consumed by `BreadboardComponentRenderer.tsx` |

### 1. Workbench Shell (right rail + dialogs)

| File | Role |
|---|---|
| `BreadboardWorkbenchSidebar.tsx` | Right-rail container. Hosts shelves, inventory status, exact-part triggers, reconciliation summary |
| `BreadboardStarterShelf.tsx` | Curated "just drop this" starter parts for beginners |
| `BreadboardInventoryDialog.tsx` | Detailed stash browser + reconciliation dialog |
| `BreadboardExactPartRequestDialog.tsx` | User types MPN / description → resolver → verified/candidate/draft flow |
| `BreadboardQuickIntake.tsx` | "Which board do you have?" onboarding prompt |
| `BreadboardReconciliationPanel.tsx` | Compares BOM vs stash, surfaces deltas |
| `BreadboardShoppingList.tsx` | Shortfall items as buy-this list (wired to `getShortfalls` backend) |
| `BreadboardBoardAuditPanel.tsx` | Audit issues panel with severity sort + focus links |
| `BreadboardPartInspector.tsx` | Selected-part trust/readiness/confidence detail |

### 2. Canvas Editing

| File | Role |
|---|---|
| `breadboard-canvas/index.tsx` | `BreadboardCanvas` — composes grid, components, wires, overlays into the SVG canvas |
| `breadboard-canvas/canvas-helpers.ts` | Pure placement/drop helpers (`getDropTypeFromPart`, `buildPlacementForDrop`, `WIRE_COLORS`, …) |
| `breadboard-canvas/useCanvasViewport.ts` + `CanvasToolbar.tsx` | Zoom/pan state + canvas-local toolbar |
| `BreadboardGrid.tsx` | Hole grid, row/column labels, drop-preview (snap preview + fit-zone highlight) |
| `BreadboardComponentRenderer.tsx` | SVG footprint rendering; dispatches to `breadboard-components/` per-part SVGs, bendable legs via `BendableLegRenderer.tsx` |
| `BreadboardBenchPartRenderer.tsx` | Off-board parts that live adjacent to the bench (Mega, hub motor, BLDC driver) — connected via bench pins |
| `BreadboardWireEditor.tsx` | Wire selection, drag to re-route, endpoint snap preview (connects to breadboard holes OR bench pins) |
| `BreadboardDrcOverlay.tsx` | Real-time rule violations rendered in-canvas |
| `BreadboardConnectivityOverlay.tsx` | Net graph visualization (which holes are on which net) |
| `BreadboardConnectivityExplainer.tsx` | Tooltip/explainer for rail model, strips, power rails |
| `breadboard-animations.css` | Keyframes for drop preview, snap halo, coach highlight |
| `useBreadboardCursor.ts` | Cursor state machine (pointer/drawing-wire/placing/rejecting) |

### 3. Trust & Readiness (pure-lib logic)

| File | ~LOC | Role |
|---|---:|---|
| `breadboard-bench.ts` | 350 | Per-part readiness derivation (verified-exact / connector-defined / heuristic / stash-absent). Bench summary. |
| `breadboard-part-inspector.ts` | 800 | Selected-part detail: pin-map confidence, fit verdict, provenance history, coach actionability |
| `breadboard-layout-quality.ts` | 250 | Scoring: rail usage balance, signal-path length, decoupling adjacency, off-board tidiness |
| `breadboard-board-audit.ts` | 1,400 | Full audit: issue generation + severity + remediation links |
| `breadboard-preflight.ts` | 550 | "Can this build right now?" — gate before bring-up / fab / demo |

### 4. Coach / AI

| File | ~LOC | Role |
|---|---:|---|
| `breadboard-coach-plan.ts` | 400 | Plan derivation from selected part + board state |
| `useBreadboardCoachPlan.ts` | 650 | React hook wrapper + memoization — lives in `components/circuit-editor/`, NOT `lib/` |
| `BreadboardCoachOverlay.tsx` | — | Overlay UI for coach plan steps |
| `breadboard-ai-prompts.ts` | 175 | Prompt templates that pass trust-tier info to the model correctly |

### 5. Shared Model + Sync

| File | Role |
|---|---|
| `breadboard-model.ts` | Canonical breadboard data model: holes, rails, placement, occupancy |
| `breadboard-bench-connectors.ts` | Bench-pin endpoint definitions for off-board parts |
| `breadboard-connectivity.ts` | Electrical net graph computation |
| `breadboard-drag-move.ts` | Placement drag semantics with snap |
| `breadboard-drc.ts` | Rule engine for the DRC overlay |
| `breadboard-undo.ts` | Breadboard-scoped undo/redo stack |
| `breadboard-wire-editor.ts` | Non-React wire editing primitives |
| `view-sync.ts` | **Schematic ↔ breadboard sync** — dedup, provenance, net identity |

### 6. Auxiliary

| File | ~LOC | Role |
|---|---:|---|
| `breadboard-3d.ts` | 700 | Optional 3D rendering of board + placed parts |

LOC values throughout this file are approximate (nearest 50) — run `wc -l` when precision matters.

## Request-To-Entrypoint Routing

| Request keyword / shape | Start here | Then |
|---|---|---|
| "Tab layout wrong", "panel missing", "action not discoverable" | `BreadboardView.tsx` | orchestration gap or prop drift |
| "Can't find starter part", "new starter part X" | `BreadboardStarterShelf.tsx` | then confirm `BreadboardWorkbenchSidebar.tsx` surfaces it |
| "Exact-part flow broken / MPN X says needs-draft but it's actually in the verified pack" | `shared/verified-boards/` + `exact-part-resolver.ts` | then `BreadboardExactPartRequestDialog.tsx` |
| "Board health score wrong / issue missing / issue fires incorrectly" | `breadboard-board-audit.ts` | then `BreadboardBoardAuditPanel.tsx` rendering |
| "Selected part trust label is wrong / shows Verified when it should be Inferred" | `breadboard-part-inspector.ts` | then `BreadboardPartInspector.tsx` + `breadboard-bench.ts` trust derivation |
| "Coach suggestion wrong / not firing / says wrong thing" | `breadboard-coach-plan.ts` + `breadboard-ai-prompts.ts` | then `BreadboardCoachOverlay.tsx` |
| "Can't place part", "snap feels wrong", "drop preview glitches" | `BreadboardGrid.tsx` + `breadboard-drag-move.ts` | then `breadboard-model.ts` occupancy rules |
| "Wire drag feels off", "endpoint won't snap to bench pin" | `BreadboardWireEditor.tsx` + `breadboard-wire-editor.ts` | then `breadboard-bench-connectors.ts` |
| "DRC false positive / missed violation" | `breadboard-drc.ts` | then `BreadboardDrcOverlay.tsx` |
| "Connectivity shown wrong" | `breadboard-connectivity.ts` | then `BreadboardConnectivityOverlay.tsx` |
| "Schematic has X but breadboard shows Y / duplicates / phantom nets" | `view-sync.ts` | then selected-part trust in inspector |
| "Inventory shows wrong quantity / shortfall wrong" | `server/routes/bom-shortfalls.ts` + `shared/parts/shortfall.ts` | then `BreadboardReconciliationPanel.tsx` |
| "Preflight says can build / can't build incorrectly" | `breadboard-preflight.ts` | then its surface in view |
| "Cursor style wrong during drag" | `useBreadboardCursor.ts` | — |
| "3D preview missing/wrong" | `breadboard-3d.ts` | — |
| "Off-board part (Mega, hub motor) wiring broken" | `BreadboardBenchPartRenderer.tsx` + `breadboard-bench-connectors.ts` | then check vault: `knowledge/mega-2560-too-wide-for-any-breadboard.md` |

## The Architectural Heuristic

When you have ambiguity, fix Breadboard in this priority order:

1. **Orchestration + discoverability** — Is the user shown that a capability exists?
2. **State truth + provenance** — Does what the user sees match what actually happened?
3. **Actionability of guidance** — Can the user do something about what we just told them?
4. **Realism + polish** — Does it look like a real bench?

**Never invert that order.** A photorealistic wire with the wrong net identity is worse than a plain wire with the right net identity.

## Cross-Directory Links You Must Know

These relationships are subtle. Cache them:

- **Exact-part resolution** is **not** a breadboard file — it lives in `shared/exact-part-resolver.ts` + `shared/verified-boards/*.ts`. The breadboard dialog (`BreadboardExactPartRequestDialog.tsx`) is a caller.
- **Shortfall computation** is **not** a breadboard file — it lives in `shared/parts/shortfall.ts` + `server/storage/bom.ts`. Breadboard just displays it.
- **Vault knowledge** at `knowledge/breadboard-intelligence.md` is the source of truth for layout rules, verified-board quirks, and bench-coach claims. **Before hardcoding a rule, grep the vault.**
- **Tests live in four places**: pure libs in `client/src/lib/__tests__/` and `client/src/lib/circuit-editor/__tests__/`; components in `client/src/components/circuit-editor/__tests__/`; the extracted subsystems each carry their own `breadboard-view/__tests__/` and `breadboard-canvas/__tests__/`. Follow the convention of the directory you're editing.

## When In Doubt

Search, don't guess. The codebase has ~19,000 LOC of breadboard surface across 60+ files. Running:

```
rg -n "SomeBreadboardSymbol" client/src/components/circuit-editor client/src/lib | head
```

usually finds existing infrastructure in < 2 seconds.

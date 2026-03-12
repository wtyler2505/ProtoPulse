# FE-04 Audit: Design/Editor UI Layer

Date: 2026-03-06  
Auditor: Codex  
Section: FE-04 (from master map)  
Method: Code + test-surface inspection only (no vitest runtime per user direction).

## Scope Reviewed
- `client/src/components/circuit-editor/BreadboardGrid.tsx`
- `client/src/components/circuit-editor/BreadboardView.tsx`
- `client/src/components/circuit-editor/ComponentPlacer.tsx`
- `client/src/components/circuit-editor/DCAnalysisPanel.tsx`
- `client/src/components/circuit-editor/ERCOverlay.tsx`
- `client/src/components/circuit-editor/ERCPanel.tsx`
- `client/src/components/circuit-editor/ExportPanel.tsx`
- `client/src/components/circuit-editor/HierarchicalSheetPanel.tsx`
- `client/src/components/circuit-editor/NetClassPanel.tsx`
- `client/src/components/circuit-editor/NetDrawingTool.tsx`
- `client/src/components/circuit-editor/PCBLayoutView.tsx`
- `client/src/components/circuit-editor/PartSymbolRenderer.tsx`
- `client/src/components/circuit-editor/PinoutHoverCard.tsx`
- `client/src/components/circuit-editor/PowerSymbolPalette.tsx`
- `client/src/components/circuit-editor/RatsnestOverlay.tsx`
- `client/src/components/circuit-editor/SchematicCanvas.tsx`
- `client/src/components/circuit-editor/SchematicInstanceNode.tsx`
- `client/src/components/circuit-editor/SchematicNetEdge.tsx`
- `client/src/components/circuit-editor/SchematicNetLabelNode.tsx`
- `client/src/components/circuit-editor/SchematicNoConnectNode.tsx`
- `client/src/components/circuit-editor/SchematicPowerNode.tsx`
- `client/src/components/circuit-editor/SchematicToolbar.tsx`
- `client/src/components/circuit-editor/ToolButton.tsx`
- `client/src/components/simulation/BodePlot.tsx`
- `client/src/components/simulation/FrequencyAnalysisPanel.tsx`
- `client/src/components/simulation/ProbeOverlay.tsx`
- `client/src/components/simulation/SimulationPanel.tsx`
- `client/src/components/simulation/SpiceImportButton.tsx`
- `client/src/components/simulation/WaveformViewer.tsx`

Supporting dependency files reviewed for PCB delegated behavior:
- `client/src/components/views/pcb-layout/PCBInteractionManager.ts`
- `client/src/components/views/pcb-layout/ComponentPlacer.ts`
- `client/src/components/views/pcb-layout/PCBBoardRenderer.tsx`
- `client/src/components/views/pcb-layout/TraceRenderer.tsx`
- `client/src/components/views/pcb-layout/ViaRenderer.tsx`
- `client/src/components/views/pcb-layout/index.ts`

Test surface reviewed:
- `client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx`
- `client/src/components/circuit-editor/__tests__/PinoutHoverCard.test.tsx`
- `client/src/components/views/pcb-layout/__tests__/LayerStackPanel.test.tsx`
- `client/src/components/views/pcb-layout/__tests__/PadRenderer.test.tsx`
- `client/src/components/views/pcb-layout/__tests__/ViaRenderer.test.tsx`
- `client/src/components/views/pcb-layout/__tests__/pcb-modules.test.ts`

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact break risk
- `P2`: medium reliability/UX risk
- `P3`: low risk, cleanup/quality

## Findings

### 1) `P1` Probe placement and drag flows are non-functional/incomplete
Evidence:
- `client/src/components/simulation/ProbeOverlay.tsx:495`
- `client/src/components/simulation/ProbeOverlay.tsx:500`
- `client/src/components/simulation/ProbeOverlay.tsx:552`
- `client/src/components/simulation/ProbeOverlay.tsx:571`
- `client/src/components/simulation/ProbeOverlay.tsx:578`

What is happening:
- New probes are added with empty target IDs (`''` for net/ref designator).
- Drag updates are visual-only during mouse move, then reset back on mouse up.
- File comments explicitly note move is not implemented.

Why this matters:
- UI implies probes can be placed and moved precisely, but the final data stays unresolved.
- This can make measurement workflows feel broken/untrustworthy.

Fix recommendation:
- Add explicit hit-testing on placement so probe targets are real IDs, not blank strings.
- Introduce `onMoveProbe(probeId, x, y)` and persist final position.
- Disable drag affordance until true move persistence exists.

---

### 2) `P1` Simulation “Stop” does not actually stop in-flight simulation request
Evidence:
- `client/src/components/simulation/SimulationPanel.tsx:782`
- `client/src/components/simulation/SimulationPanel.tsx:785`
- `client/src/components/simulation/SimulationPanel.tsx:786`
- `client/src/components/simulation/SimulationPanel.tsx:753`

What is happening:
- Stop handler only flips UI state (`isRunning`) and toasts “cancelled.”
- No `AbortController` is wired to cancel the request.

Why this matters:
- User gets a “stopped” signal while backend work may still complete and update results later.
- This can cause confusing state jumps and trust loss.

Fix recommendation:
- Add request abort wiring with `AbortController`.
- Only show “cancelled” when abort succeeds.
- Guard late responses when a run has been canceled/replaced.

---

### 3) `P1` DC sweep path is blocked by placeholder source wiring
Evidence:
- `client/src/components/simulation/SimulationPanel.tsx:690`
- `client/src/components/simulation/SimulationPanel.tsx:692`
- `client/src/components/simulation/SimulationPanel.tsx:726`

What is happening:
- Source list is hardcoded empty (`[]`) with a placeholder note.
- Validation requires source selection for DC sweep.

Why this matters:
- DC sweep can be selected in UI but cannot be completed in real use.

Fix recommendation:
- Derive source options from live circuit/netlist state.
- If no sources exist, show explicit disabled-state reason in panel header and selector.

---

### 4) `P1` Unsanitized datasheet URL can be injected into external link
Evidence:
- `client/src/components/circuit-editor/PinoutHoverCard.tsx:556`
- `client/src/components/circuit-editor/PinoutHoverCard.tsx:630`

What is happening:
- Datasheet URL from metadata is used directly in `<a href=...>` with no protocol allowlist.

Why this matters:
- Malicious/non-http protocols can be introduced via component metadata.
- This is a security hardening gap in a user-clicked link surface.

Fix recommendation:
- Validate URLs before render (`http:`/`https:` only).
- If invalid, hide link and show safe fallback text.
- Add tests for blocked protocols (`javascript:`, `data:`).

---

### 5) `P1` PCB rotation shortcut pipeline is wired to a no-op callback
Evidence:
- `client/src/components/views/pcb-layout/PCBInteractionManager.ts:152`
- `client/src/components/views/pcb-layout/PCBInteractionManager.ts:154`
- `client/src/components/circuit-editor/PCBLayoutView.tsx:193`
- `client/src/components/circuit-editor/PCBLayoutView.tsx:194`

What is happening:
- Keyboard rotate command calls `setInstanceRotation`.
- In `PCBLayoutView`, that callback is TODO/no-op.

Why this matters:
- UI and keyboard behavior imply rotate support, but user action has no effect.

Fix recommendation:
- Implement rotation mutation using `useUpdateCircuitInstance`.
- Add visual + persisted rotation verification path.

---

### 6) `P1` Trace/wire creation defaults to first net instead of user-selected/actual net intent
Evidence:
- `client/src/components/circuit-editor/BreadboardView.tsx:276`
- `client/src/components/circuit-editor/BreadboardView.tsx:277`
- `client/src/components/circuit-editor/PCBLayoutView.tsx:210`
- `client/src/components/views/pcb-layout/PCBInteractionManager.ts:97`
- `client/src/components/views/pcb-layout/PCBInteractionManager.ts:100`

What is happening:
- Breadboard wire start defaults to the first net in array.
- PCB trace completion also writes with `firstNetId`.

Why this matters:
- Routed copper/wires can be assigned to the wrong net silently.
- This is a design integrity risk, not just UX polish.

Fix recommendation:
- Require explicit net selection before route start.
- Or infer net by endpoint connectivity and enforce consistency checks.
- Block trace completion when net assignment is ambiguous.

---

### 7) `P1` Export panel includes placeholder payloads and non-enforced DRC gate
Evidence:
- `client/src/components/circuit-editor/ExportPanel.tsx:65`
- `client/src/components/circuit-editor/ExportPanel.tsx:110`
- `client/src/components/circuit-editor/ExportPanel.tsx:179`
- `client/src/components/circuit-editor/ExportPanel.tsx:188`
- `client/src/components/circuit-editor/ExportPanel.tsx:232`

What is happening:
- “DRC Required” is currently a label only.
- PDF export bodies are hardcoded dummy view data placeholders.

Why this matters:
- User can interpret exports as production-ready when they are not fully grounded in live design state.

Fix recommendation:
- Enforce DRC gate in action handler for flagged exports.
- Build export payloads from active schematic/PCB state, not static placeholders.
- Add explicit “prototype mode” tag while placeholders remain.

---

### 8) `P2` Net class editor is local-only and allows invalid zero values
Evidence:
- `client/src/components/circuit-editor/NetClassPanel.tsx:98`
- `client/src/components/circuit-editor/NetClassPanel.tsx:519`
- `client/src/components/circuit-editor/NetClassPanel.tsx:536`
- `client/src/components/circuit-editor/NetClassPanel.tsx:553`

What is happening:
- Net class/assignment state is explicitly local-only (no backend persistence).
- Numeric fields parse invalid input to `0`, but save path has no hard validation.

Why this matters:
- User can think constraints are saved/applied globally when they are not.
- Zero-width/clearance/via values are possible in saved local state.

Fix recommendation:
- Persist net classes/assignments via API contracts.
- Add strict numeric validation on save (reject <= 0).
- Show “local prototype” status until persistence exists.

---

### 9) `P2` Schematic canvas mutates server state without local error handling and binds hotkeys globally
Evidence:
- `client/src/components/circuit-editor/SchematicCanvas.tsx:331`
- `client/src/components/circuit-editor/SchematicCanvas.tsx:349`
- `client/src/components/circuit-editor/SchematicCanvas.tsx:472`
- `client/src/components/circuit-editor/SchematicCanvas.tsx:612`
- `client/src/components/circuit-editor/SchematicCanvas.tsx:631`
- `client/src/components/circuit-editor/SchematicCanvas.tsx:662`

What is happening:
- Multiple mutations fire directly with no local fail feedback/recovery.
- Keyboard shortcut listener is attached to `window` while mounted.

Why this matters:
- Failed create/update/delete operations can appear as “nothing happened” from the canvas.
- Global key handling can conflict with other focused app areas.

Fix recommendation:
- Wrap mutations with shared error-to-toast pattern and retry hints.
- Scope shortcuts to focused canvas container where possible.

---

### 10) `P2` Waveform viewer can drift from parent visibility state; export errors are uncaught
Evidence:
- `client/src/components/simulation/WaveformViewer.tsx:463`
- `client/src/components/simulation/WaveformViewer.tsx:469`
- `client/src/components/simulation/WaveformViewer.tsx:477`
- `client/src/components/simulation/WaveformViewer.tsx:927`

What is happening:
- Visibility sync logic preserves prior local flags for existing trace IDs, even if parent visibility changes.
- PNG export async path has no try/catch around rasterization/download.

Why this matters:
- Parent-driven visibility updates can be ignored unexpectedly.
- Export failures can die silently from user perspective.

Fix recommendation:
- Add an explicit “controlled vs local” visibility mode.
- Catch/export errors and surface user feedback.

---

### 11) `P2` Via tool appears in PCB toolbar but has no implemented placement path in this view
Evidence:
- `client/src/components/circuit-editor/PCBLayoutView.tsx:160`
- `client/src/components/circuit-editor/PCBLayoutView.tsx:263`
- `client/src/components/views/pcb-layout/PCBInteractionManager.ts:73`

What is happening:
- Via tool is selectable in toolbar.
- Via state setter is unused in this view.
- Click handler only adds trace points for trace mode; other modes clear selection.

Why this matters:
- Visible tool promise does not match behavior.

Fix recommendation:
- Implement via placement event path for `tool === 'via'`.
- If not ready, hide/disable the tool with “coming soon” label.

## Test Coverage Assessment (this section)

What exists:
- Circuit editor tests:
  - `BreadboardView.test.tsx`
  - `PinoutHoverCard.test.tsx`
- PCB module tests:
  - `LayerStackPanel.test.tsx`
  - `PadRenderer.test.tsx`
  - `ViaRenderer.test.tsx`
  - `pcb-modules.test.ts`

Key gaps:
- No direct test files found for:
  - `SchematicCanvas`, `NetDrawingTool`, `ERCPanel`, `ExportPanel`, `NetClassPanel`, `PCBLayoutView`, `SimulationPanel`, `FrequencyAnalysisPanel`, `WaveformViewer`, `ProbeOverlay`, `SpiceImportButton`.
- Existing `BreadboardView` tests are heavily mocked at child/hook boundaries (`BreadboardGrid`, `RatsnestOverlay`, hooks), so many real interaction paths are not exercised.
- No tests identified for security behavior around datasheet URL protocol validation.

Execution notes:
- Per user direction, this pass is inspection-only and does not run vitest.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) Add “truth badges” to editor tools
- Example: `Live`, `Local-only`, `Prototype`.
- This removes ambiguity for unfinished integration paths.

### B) Introduce a shared mutation UX helper
- Consistent loading/error/retry behavior for all editor-side mutations.

### C) Add “intent-first routing” for nets
- Force explicit net intent before route creation (or strict endpoint inference).

### D) Add FE-04 contract test suite
- Focus first on:
  - Simulation stop/cancel semantics
  - Probe placement + move persistence
  - Net assignment correctness
  - Export DRC gating

## Suggested Fix Order (practical)
1. Fix probe placement/move data integrity (`P1`).
2. Fix simulation stop/cancel semantics and DC sweep source wiring (`P1`).
3. Enforce safe datasheet URL protocols (`P1`).
4. Wire PCB rotate + via tool behaviors or hide them (`P1`/`P2`).
5. Remove first-net routing fallback in breadboard/PCB trace flows (`P1`).
6. Enforce export truthfulness (real payload + DRC gate) (`P1`).
7. Persist net-class data and validate constraints (`P2`).
8. Expand FE-04 tests around real interaction paths (`P2`).

## Bottom Line
FE-04 has strong UI scaffolding and good module decomposition, but several visible workflows are still placeholders or partially wired. The top risk theme is “UI promise vs real behavior.” Closing those truth gaps first will give the biggest reliability and trust gain.

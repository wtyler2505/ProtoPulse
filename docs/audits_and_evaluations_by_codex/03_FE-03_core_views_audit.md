# FE-03 Audit: Core Views

Date: 2026-03-06  
Auditor: Codex  
Section: FE-03 (from master map)  
Status: Completed first deep pass for core workspace views + their immediate dependency contracts.

## Scope Reviewed
- `client/src/components/views/ArchitectureView.tsx`
- `client/src/components/views/ComponentEditorView.tsx`
- `client/src/components/views/SchematicView.tsx`
- `client/src/components/views/ProcurementView.tsx`
- `client/src/components/views/ValidationView.tsx`
- `client/src/components/views/OutputView.tsx`
- `client/src/components/views/DashboardView.tsx`
- `client/src/components/views/DesignHistoryView.tsx`
- `client/src/components/views/LifecycleDashboard.tsx`
- `client/src/components/views/StorageManagerPanel.tsx`
- `client/src/components/views/KanbanView.tsx`
- `client/src/components/views/KnowledgeView.tsx`
- `client/src/components/views/CommunityView.tsx`
- `client/src/components/views/BoardViewer3DView.tsx`
- `client/src/components/views/PcbOrderingView.tsx`
- `client/src/components/views/CalculatorsView.tsx`
- `client/src/components/views/DesignPatternsView.tsx`

Supporting contract/behavior files reviewed for evidence:
- `client/src/lib/contexts/chat-context.tsx`
- `client/src/lib/supplier-api.ts`
- `client/src/lib/community-library.ts`
- `client/src/lib/kanban-board.ts`
- `client/src/lib/pcb-ordering.ts`

View test surface reviewed:
- `client/src/components/views/__tests__/ArchitectureView.test.tsx`
- `client/src/components/views/__tests__/ProcurementView.test.tsx`
- `client/src/components/views/__tests__/procurement-view.test.tsx`
- `client/src/components/views/__tests__/ValidationView.test.tsx`
- `client/src/components/views/__tests__/storage-manager.test.tsx`
- `client/src/components/views/__tests__/drc-constraint-overlay.test.tsx`

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact break risk
- `P2`: medium reliability/UX risk
- `P3`: low risk, cleanup/quality

## Findings

### 1) `P1` Validation “advanced checks” run on empty or dummy design data
Evidence:
- `client/src/components/views/ValidationView.tsx:162`
- `client/src/components/views/ValidationView.tsx:171`
- `client/src/components/views/ValidationView.tsx:200`
- `client/src/components/views/ValidationView.tsx:590`

What is happening:
- Design Gateway runs with `{ nodes: [], edges: [], bomItems: [] }`.
- DFM check uses a hardcoded dummy board structure.
- “Run all scripts” and per-script run also execute against empty design data.

Why this matters:
- UI implies real validation coverage, but results can be false-positive/meaningless.
- This is a trust-break in a safety-critical workflow.

Fix recommendation:
- Build design input from live project state (architecture, BOM, circuit/PCB artifacts).
- Block execution if required design data is missing.
- Label checks as `demo` only if real data wiring is intentionally deferred.

---

### 2) `P1` Component Editor can lose unsaved edits when save fails during part switch/new-part flow
Evidence:
- `client/src/components/views/ComponentEditorView.tsx:260`
- `client/src/components/views/ComponentEditorView.tsx:285`
- `client/src/components/views/ComponentEditorView.tsx:548`
- `client/src/components/views/ComponentEditorView.tsx:562`

What is happening:
- `handleSave` catches save errors and does not propagate failure.
- `handleCreateNewPart` and `handleSwitchPart` always continue after `await handleSave()`, even if save failed.

Why this matters:
- User can lose unsaved work during part switching or new-part creation after transient backend/API failure.

Fix recommendation:
- Make `handleSave` return success/failure (or throw on failure).
- Gate part-switch/new-part continuation on explicit save success.
- Add a blocking dialog: “Save failed. Keep editing or discard changes?”

---

### 3) `P1` “Generate Architecture” CTA does not initiate generation flow
Evidence:
- `client/src/components/views/ArchitectureView.tsx:387`
- `client/src/components/views/ArchitectureView.tsx:389`
- `client/src/lib/contexts/chat-context.tsx:76`

What is happening:
- CTA only writes a user chat message and sets `isGenerating` to `false`.
- Chat context `addMessage` stores message via mutation; it does not itself trigger AI request execution.

Why this matters:
- “Generate Architecture” can appear to do nothing or behave inconsistently.
- High-friction first-run path.

Fix recommendation:
- Route CTA through the same send pipeline used by ChatPanel (`handleSend` path), or expose a shared generation action API.
- Set loading state from the real request lifecycle, not manual false resets.

---

### 4) `P2` Multiple “live/community/order” experiences are local-only simulated engines
Evidence:
- `client/src/components/views/ProcurementView.tsx:16`
- `client/src/lib/supplier-api.ts:8`
- `client/src/lib/supplier-api.ts:9`
- `client/src/components/views/CommunityView.tsx:44`
- `client/src/lib/community-library.ts:4`
- `client/src/lib/community-library.ts:6`
- `client/src/components/views/KanbanView.tsx:43`
- `client/src/lib/kanban-board.ts:4`
- `client/src/lib/kanban-board.ts:6`
- `client/src/components/views/PcbOrderingView.tsx:46`
- `client/src/lib/pcb-ordering.ts:4`
- `client/src/lib/pcb-ordering.ts:7`
- `client/src/lib/pcb-ordering.ts:890`

What is happening:
- Supplier pricing is explicitly mock/demo.
- Community library, kanban board, and PCB ordering are client-side localStorage engines.
- “Submit order” is local state transition, not external order submission.

Why this matters:
- Labels like “Live Pricing”, “Community”, and “Place Order” can over-promise real-world behavior.
- Users may assume collaboration/server persistence exists when it does not.

Fix recommendation:
- Add clear “Local Mode / Prototype” badges where applicable.
- Define and track integration milestones to server-backed APIs.
- Disable or relabel irreversible/production-like CTAs until backend contracts exist.

---

### 5) `P2` Schematic create/expand actions have no failure handling
Evidence:
- `client/src/components/views/SchematicView.tsx:31`
- `client/src/components/views/SchematicView.tsx:36`

What is happening:
- `mutateAsync` calls are awaited with no `try/catch`.
- Network/server failures can bubble without user-facing feedback.

Why this matters:
- Empty-state onboarding path can fail silently or throw.

Fix recommendation:
- Add guarded `try/catch` with destructive toast on failure.
- Include retry action and preserve button enabled state correctly after error.

---

### 6) `P2` Snapshot and lifecycle deletion flows are one-click destructive (no confirm)
Evidence:
- `client/src/components/views/DesignHistoryView.tsx:201`
- `client/src/components/views/LifecycleDashboard.tsx:357`
- `client/src/components/views/LifecycleDashboard.tsx:767`

What is happening:
- Delete actions execute immediately from icon button clicks.

Why this matters:
- Easy accidental destructive actions in high-density table/card UIs.

Fix recommendation:
- Require explicit confirm dialog (or undo toast with timed rollback).

---

### 7) `P2` Core-view test coverage is narrow relative to live surface area
Evidence:
- Existing tests: `ArchitectureView`, `ProcurementView`, `ValidationView`, `StorageManager`, procurement submodules, one DRC overlay test.
- No direct FE-03 tests detected for: `DashboardView`, `OutputView`, `SchematicView`, `ComponentEditorView`, `DesignHistoryView`, `LifecycleDashboard`, `KanbanView`, `KnowledgeView`, `CommunityView`, `PcbOrderingView`, `BoardViewer3DView`, `CalculatorsView`, `DesignPatternsView`.

Why this matters:
- Regressions in key “core view” behavior can ship without fast feedback.

Fix recommendation:
- Add focused integration tests per high-risk view path first:
  - Validation (real data wiring contract)
  - Component editor save/switch guardrails
  - Schematic create/expand error UX
  - Architecture generate CTA end-to-end trigger

---

### 8) `P3` Dashboard status aggregation assumes strict status keys
Evidence:
- `client/src/components/views/DashboardView.tsx:114`
- `client/src/components/views/DashboardView.tsx:121`

What is happening:
- Status counts increment via direct keyed object access.
- Unexpected status labels can create undefined increments and corrupt counts.

Fix recommendation:
- Guard unknown statuses and bucket into `other`.

---

### 9) `P3` Output copy actions show success feedback without clipboard success check
Evidence:
- `client/src/components/views/OutputView.tsx:50`
- `client/src/components/views/OutputView.tsx:56`
- `client/src/components/views/OutputView.tsx:59`

What is happening:
- Clipboard copy is fire-and-forget; success UI/toast appears regardless of write outcome.

Fix recommendation:
- Await `copyToClipboard` result and show failure toast when denied/unavailable.

## Test Coverage Assessment (this section)

Strong coverage:
- `ArchitectureView`
- `ProcurementView` + procurement subcomponents
- `ValidationView`
- `StorageManagerPanel`

Primary gaps:
- Missing direct tests for most FE-03 top-level views listed above.
- Missing contract tests ensuring “live” workflows are correctly wired to non-demo data sources.

Execution notes:
- Attempted targeted run:
  - `timeout 120s npx vitest run --project client client/src/components/views/__tests__/ArchitectureView.test.tsx client/src/components/views/__tests__/ProcurementView.test.tsx client/src/components/views/__tests__/ValidationView.test.tsx client/src/components/views/__tests__/storage-manager.test.tsx`
- In this environment vitest hangs; timeout wrapper returned `EXIT_CODE:124`.
- Findings are based on code + existing test inspection.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) Add “data-source integrity” labels in each advanced tool panel
- Explicitly show: `Live server`, `Cached server`, or `Local prototype`.

### B) Introduce a shared `safeMutation` view helper
- Standardize async mutation UX: loading, success, structured error toast, optional retry.

### C) Add an integration-contract test suite for view-to-engine wiring
- Assert that validation, pricing, ordering, and generation flows consume real project state.

### D) Add soft-delete/undo patterns for destructive actions
- Prefer undo snackbars for quick reversibility.

## Suggested Fix Order (practical)
1. Wire Validation advanced checks to real project data (`P1`).
2. Fix ComponentEditor save/switch data-loss path (`P1`).
3. Fix Architecture generate CTA flow trigger (`P1`).
4. Add error handling to schematic create/expand flows (`P2`).
5. Add confirm/undo for snapshot and lifecycle deletes (`P2`).
6. Expand FE-03 test matrix for uncovered views (`P2`).

## Bottom Line
Core views are feature-rich, but several high-visibility workflows currently return confidence signals from placeholder/local-only paths. Fixing data-source truthfulness and save-safety guardrails first will materially improve reliability and user trust.

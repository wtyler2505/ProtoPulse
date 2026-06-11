# Wave 0 — Foundations Status
**Started:** 2026-05-18 (immediately after user "go ahead")
**Owner:** Lead

## Completed in This Wave So Far

### 1. Contracts Document
- Created `docs/breadboard/contracts.md`
- Consolidated the key rules from both breadboard skills into one authoritative, living spec.
- This is now the document that all future changes must be justified against.

### 2. Contract Guard Tests
- Created `client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts`
- Initial soft placeholders in place. These will be hardened aggressively after the canvas extraction begins.
- Purpose: Protect the non-negotiable rules (provenance, bench vs board, sync safety, coach trust).

### 3. Baseline Test Results
- `BreadboardView.test.tsx`: 40 tests passing (33.5s run)
- `HardwareInspectionPanel.test.tsx`: 3 tests passing
- `BreadboardCoachOverlay.test.tsx`: 5 tests passing
- `BreadboardToolbar.test.tsx`: 8 tests passing
- Total baseline captured: 56 tests across key breadboard surfaces.

All tests currently green. This is our "before" state.

### 4. Inspector Baseline
- Re-ran both `inspect-breadboard-view.mjs` and `inspect-breadboard-surface.sh`
- State captured (66 tracked tests, same core source files as pre-analysis).

## Next in Wave 0 (In Progress)

- Propose concrete folder structure and module boundaries for the `breadboard-canvas/` extraction.
- Update skill self-improvement logs with Wave 0 decisions.
- Final Wave 0 review checkpoint with user.

---

**Current Risk Assessment:** Low. We have not yet touched the 1,677 LOC canvas in a structural way. All work so far is additive and protective.

**Recommendation:** Once the folder structure proposal is reviewed and approved, we can move into Wave 1 Phase 1.1 (Viewport extraction) with high confidence.
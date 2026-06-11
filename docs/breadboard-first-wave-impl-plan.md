# Breadboard View + Lab — First-Wave Implementation Plan
**Based on:** `/product-analysis -> /pp-view-breadboard + breadboard-lab` (user chose 1+3+4, then "continue")
**Date:** 2026-05-18
**Goal:** Pay down the highest-impact P0 debt so the Breadboard Lab can credibly claim it delivers a real, trustworthy, coach-augmented physical bench experience.
**Scope:** Top P0 items from `docs/product-analysis-breadboard-checklist.md`, with the 1,677 LOC canvas as the root cause.

## Guiding Principles (Non-Negotiable)

1. **Contracts first.** Every change must be measured against:
   - `pp-view-breadboard/references/ux-contract.md`
   - `breadboard-lab/references/workflow-playbook.md`
   - `breadboard-lab/references/ai-audit-and-sync.md`
   - `pp-view-breadboard/references/gotchas.md`

2. **The canvas split is the foundation.** Nothing else (coach quality, provenance UI, hardware inspection integration, Fritzing parity) can be safely iterated while the god file owns everything.

3. **Provenance and trust must become first-class and visible.** This is the single biggest violation of the Lab identity today.

4. **Bench vs Board duality must have clear ownership.** This is the core mental model of the "Lab".

5. **Coach and Board Health must graduate from "embedded features" to first-class citizens** of the workbench.

6. **TDD + browser verification on every wave.** The testing guide in the skill is good; we will actually follow it.

7. **Small, reviewable extractions.** No big-bang rewrite. Extract with tests, then delete the old paths.

---

## Wave 0 — Foundations (1–2 days, lead + 1 agent)

**Objective:** Lock the contracts, add regression protection, and create the extraction scaffolding.

### Tasks
- [ ] Create `docs/breadboard/contracts.md` that is the single source of truth (copy + lightly edit the key rules from the four reference files). This becomes the spec for the wave.
- [ ] Add "Breadboard Lab Contract Guard" test file (`client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts`) that asserts:
  - Every placed instance has a clear provenance tag or source field.
  - Bench instances and breadboard instances are distinguishable in the data model.
  - Coach suggestions never override verified hardware data without explicit user action.
- [ ] Run full breadboard test suite + browser smoke (per testing guide) and capture baseline.
- [ ] Create `client/src/components/circuit-editor/breadboard-canvas/` subfolder structure proposal (see Wave 1).
- [ ] Update both skill self-improvement logs with the decision to treat the canvas split as the root P0.

**Owner:** Lead (with agent help for test scaffolding)
**Success:** Contracts doc exists, guard tests pass on current code, team agrees on the extraction boundaries.

---

## Wave 1 — Canvas Extraction (The Big One) — 3–4 weeks

**Objective:** Break the 1,677 LOC god file into 4–5 focused owners without changing observable behavior.

### Proposed Module Boundaries (from canvas deep-dive)

| New Module | Current Responsibilities to Extract | Primary Files | Why First-Class |
|------------|-------------------------------------|---------------|-----------------|
| `CanvasViewport` | `useCanvasViewport`, pan/zoom/reset, coordinate transforms, panning state | `useCanvasViewport.ts`, related helpers | Pure geometry + input routing. Stable foundation. |
| `BenchSurfaceManager` | `benchInstances` filter, benchConnectorAnchors, bench drop handling, bench vs breadboard coord decisions, `BreadboardBenchPartRenderer` integration | New `bench-surface-manager.ts` + existing `breadboard-bench.ts` + `breadboard-bench-connectors.ts` | **Core Lab identity.** This is where the "parts live on the bench before the board" contract lives. |
| `WireEditingEngine` | `wireInProgress`, all `handleMouse*`, tie-point logic, wire color, context menu, provenance tagging on creation | New state machine + `BreadboardWireEditor.tsx` enhancements | High pointer complexity. Needs to be testable in isolation. |
| `CoachIntegrationLayer` | Everything under `useBreadboardCoachPlan` consumption, `selectedInstanceModel`, overlays (`BreadboardCoachPlanOverlay`, `BreadboardPinAnchorOverlay`), `handleApplyCoachRemediation` | New `coach-integration.ts` + thin wrapper | Coach must be able to evolve independently of canvas pixels. |
| `CanvasComposition` | The big SVG return + layering + simulation overlays + accessibility announcer + drop routing | The slimmed `index.tsx` after extractions | Becomes a thin orchestrator (finally matches the "BreadboardView is the orchestrator" contract). |

### Execution Order (Strict TDD)

**Phase 1.1 – CanvasViewport (lowest risk)**
- Extract `useCanvasViewport` + helpers into `breadboard-canvas/viewport/`.
- Add unit tests for coordinate math and zoom/pan invariants.
- Wire back into canvas. Verify no behavior change in browser.

**Phase 1.2 – BenchSurfaceManager (highest conceptual risk)**
- Create `breadboard-canvas/bench-surface/` module.
- Move all benchInstances filtering, bench anchor logic, bench drop paths, and `BreadboardBenchPartRenderer` usage here.
- **Critical test:** Prove that a part can be on the bench with bench coords while its breadboard coords are still null, and that wiring to bench connectors works.
- Update provenance model so bench-placed parts carry explicit `source: 'bench' | 'starter' | 'inventory' | 'exact'`.

**Phase 1.3 – WireEditingEngine**
- Extract the wire state machine.
- Ensure every created wire gets a clear `provenance` field at creation time (manual, synced, coach, jumper).
- Add tests that cover the interaction matrix with bench connectors.

**Phase 1.4 – CoachIntegrationLayer**
- Extract coach consumption + overlay rendering + remediation handling.
- Make the coach layer accept a clean interface (selected part + bench/board context + coach plan).
- This is the moment the coach stops being "trapped inside the canvas."

**Phase 1.5 – Final slimming of index.tsx**
- The remaining file should be < 400–500 LOC and be mostly composition + event routing.
- Delete the old "Phase 2 will split" comment and replace with "Extraction complete as of Wave 1".

**Owner pattern:**
- One subagent owns each extraction (with lead review on boundary definitions).
- Lead owns the overall dependency graph and the provenance model changes.

**Risk Mitigation**
- Every phase ends with full breadboard test suite + 15-minute browser smoke on a real project with mixed bench + board + coach + sync.
- We keep the old paths working until the new module is proven and the old code is deleted in a single small PR.

**Success criteria for Wave 1**
- `breadboard-canvas/index.tsx` < 550 LOC and passes the same browser checks as before.
- Bench vs board distinction is now owned by `BenchSurfaceManager` with clear types.
- Every wire and instance has machine-readable provenance at creation time.
- Coach plan logic is no longer inside the main canvas file.

---

## Wave 2 — Provenance & Trust Visibility (2 weeks)

**Objective:** Make "what is this part and how trustworthy is it?" instantly visible — the #1 contract violation for beginners.

### Key Work
- Extend the data model (or add a computed view model) so every `CircuitInstanceRow` on breadboard carries `provenance: 'starter' | 'project' | 'bench-stash' | 'exact' | 'coach' | 'synced-from-schematic'`.
- Visual language in `BreadboardComponentOverlay` + `BreadboardBenchPartRenderer` + `BreadboardPartInspector`:
  - Distinct border / icon / badge for each provenance type.
  - "Verified exact" parts get a strong visual treatment (green check, lock icon, etc.).
  - Synced wires get dashed or lighter treatment with tooltip "generated from schematic — you can edit".
- Update `BreadboardPartInspector.tsx` to be the authoritative place that explains trust/readiness based on the new provenance + hardware inspection status + coach suggestions.
- Add contract tests that assert "a part that came from the coach plan must show lower trust than a user-placed exact part".

**Owner:** One agent focused on the inspector + visual language, coordinated with the BenchSurfaceManager owner from Wave 1.

**Success:** A new user can open Breadboard on a mixed project and, within 5 seconds, correctly identify which parts are "real" vs "suggested" without opening the inspector.

---

## Wave 3 — First-Class Coach & Board Health (2 weeks)

**Objective:** Turn coach suggestions and board health issues into first-class, immediately actionable citizens of the bench (not buried features).

### Key Work
- Promote `BreadboardCoachPlanOverlay` and `BreadboardBoardAuditPanel` to always-visible or one-click-reachable elements on the main workbench (per ux-contract "reachable without hunting").
- Make applying a coach remediation or focusing a board health issue a first-class gesture that also updates the visual provenance/trust state.
- Ensure that when a coach suggestion is applied, the resulting part/wire carries `provenance: 'coach'` and is visually distinct.
- Wire hardware inspection results into the same trust model (a photo-verified part beats a coach suggestion).

**Owner:** Shared between Coach layer owner (from Wave 1) and a new agent for Board Health + Hardware Inspection integration.

---

## Wave 4 — Hardware Inspection as Core Lab Flow + Realism Baseline (ongoing after Wave 1)

- Make the HardwareInspectionPanel discoverable from the main workbench toolbar/sidebar with a clear "Inspect real hardware on this bench" action.
- Begin systematic comparison against Fritzing on a set of 5–10 real starter circuits (physical feel, leg bending intuition, stash-to-board flow).
- Create a "Breadboard Realism Scorecard" (internal) that we improve against over time.

---

## Subagent Dispatch Model (Recommended)

Because the user has used subagents successfully before:

- **Agent A (Canvas Foundations)**: Wave 0 scaffolding + contracts doc + guard tests.
- **Agent B (Viewport Extraction)**: Phase 1.1
- **Agent C (BenchSurfaceManager)**: Phase 1.2 — highest priority after foundations (owns the Lab identity)
- **Agent D (WireEditingEngine + Provenance tagging)**
- **Agent E (CoachIntegrationLayer)**
- **Agent F (Trust/Visual Provenance UI + Inspector)** — runs in parallel with C after boundaries are stable
- **Lead**: Owns dependency graph, review of every boundary, final slimming of the canvas, and cross-wave coherence with the contracts.

All agents must read the four contract files + the canvas deep-dive document before starting.

---

## Success Metrics (Tied to Contracts)

After Wave 1 + 2:
- A new user can explain the difference between a bench-stash part and a placed breadboard part in < 10 seconds.
- Coach suggestions are visually and semantically less trusted than user/exact parts.
- The canvas file is no longer the bottleneck for coach or sync improvements.
- Full breadboard test suite + browser smoke passes with zero new warnings.

---

## What "Continue" Means From Here

The plan above is the direct continuation of the analysis you requested.

If you say "go", I will:
1. Create the detailed task breakdown with file-by-file ownership for Wave 0 + Phase 1.1 + Phase 1.2 (the highest-leverage first cuts).
2. Spawn the first subagent(s) with the exact context they need (contracts + canvas deep-dive + this plan).
3. Keep you in the loop for boundary reviews.

Or tell me to adjust priority (e.g., "do provenance visibility in parallel with the first canvas extraction" or "focus extra on Fritzing realism tests first").

Just say the word. The shit has been found. This is the plan to kill the worst of it.
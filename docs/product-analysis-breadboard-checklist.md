# Breadboard View + Lab — Scoped Product Analysis Checklist
**Analysis:** `/product-analysis -> /pp-view-breadboard + breadboard-lab` (Extended depth, user choice 1+3+4)
**Date:** 2026-05-18
**Scope:** BreadboardView.tsx + breadboard-canvas (the 1,677 LOC monster) + full bench workflow (stash, coach, audit, hardware inspection, schematic sync, provenance, realism)
**Evidence Base:** Both page skills fully read (page-map, ux-contract, gotchas, workflow-playbook, ai-audit-and-sync, etc.), canvas deep-dive, scc (17,434 LOC / 3,602 complexity in breadboard surface), targeted lizard, source inspection.

**Legend:** BB-UI-* (UX friction vs contracts), BB-TD-* (tech debt / architecture), BB-FG-* (feature gaps vs competitive + contracts), BB-EN-* (enhancements), P0 = blocks real maker/education use or high churn.

---

## P0 — Must Fix Before Claiming "Real Breadboard Lab" Works

### Canvas God File (Highest Single-File Risk in the Entire Product)
- **BB-TD-01** | breadboard-canvas/index.tsx is a 1,677 LOC / 475 complexity god component that owns the entire interactive lab runtime | File header explicitly says "Phase 2 (W1.12b) will split this into sub-files" — that never happened. Contains 20+ useState, bench vs breadboard duality, wire editing state machine, coach execution, schematic sync effect, auto-placement, drag/drop provenance logic, SVG layering, simulation overlays, accessibility, undo. Any change touches everything. `.agents/analysis/breadboard-canvas-deep-dive.md` + scc. | XL | **P0** | This is the single most dangerous file for the maker value proposition. Breadboard-lab identity lives or dies here.

- **BB-TD-02** | Bench vs breadboard coordinate system is entirely implemented inside the god canvas with no extracted model/manager | `benchInstances` filter + separate `BreadboardBenchPartRenderer` + `getBenchConnectorAnchorPositions` + `handleBenchConnectorClick` all live in the 1,677 LOC file. Gotchas.md and workflow-playbook both require clear "starter vs project vs stash vs exact vs synced" provenance. | L | **P0** | Core Lab mental model (parts can live on the bench before the board) has no ownership boundary. Extremely high regression risk.

- **BB-TD-03** | Schematic ↔ Breadboard sync engine timing and execution lives inside the canvas render/effect graph | `wireSyncVersion` ref + `syncSchematicToBreadboard(...)` call inside `useEffect` that waits for auto-placement. Per `ai-audit-and-sync.md`: "silent success can still feel wrong". Provenance tags exist (`'synced'`, `'coach'`) but user cannot reliably tell hand-drawn vs engine-generated after the fact. | L | **P0** | Sync is the highest-risk operation in the entire breadboard-lab contract. It is buried in the most complex file.

### Coach, Audit, Trust, and Guidance Actionability
- **BB-UI-01 / BB-TD-04** | Coach plan resolution and remediation is deeply entangled in the canvas instead of being a clear, auditable layer | `useBreadboardCoachPlan` (645 LOC) result is consumed directly in the canvas for `selectedInstanceModel`, overlays, and `handleApplyCoachRemediation`. Workflow-playbook demands "actionability of guidance" and "AI output should never look more trusted than verified data". | L | **P0** | The most sophisticated part of the Lab (the coach) is trapped inside the most complex file. Guidance quality cannot be iterated independently of canvas stability.

- **BB-UI-02** | Board health / audit output (1,406 LOC `breadboard-board-audit.ts` + panel) is not sufficiently actionable or tied to parts/pins from the main workbench | Lab AI/audit rules require: "visible from the main workbench, actionable, tied to affected parts or pins". Current complexity (396) and integration through the canvas focus mechanism suggests the "score without remediation" anti-pattern. | M–L | **P0** | Board health is a primary trust signal for the Lab. If it is not immediately useful, the whole "realistic bench" claim collapses.

### Hardware Inspection + Realism (The "Lab" Half)
- **BB-UI-03** | HardwareInspectionPanel (628+ LOC) + VLM photo workflow is powerful but under-integrated with the primary bench mental model | UX contract: "Hardware inspection is reachable without hunting." Lab playbook: "Does the change improve debugging confidence, not just visual density?" The panel exists but is not a first-class citizen of the "bench → board → inspect → coach" loop. | M | **P0** | The unique ProtoPulse advantage (photo + AI analysis of real hardware on the bench) is not yet part of the core Lab rhythm.

- **BB-FG-01** | Physical realism and "feels like a real bench" parity vs Fritzing is the primary competitive risk for the education/hobbyist persona | Fritzing owns the breadboard teaching experience. ProtoPulse has vastly better integration (schematic sync, coach, inventory, procurement, hardware photo, digital twin). But if placement, leg bending, stash, wiring, and physical intuition are not at least as believable as Fritzing on real components, users will still open Fritzing for the breadboard step. No current evidence of systematic physical model validation or Fritzing parity testing. | XL | **P0** | This is the "why would I use ProtoPulse for breadboard instead of the tool everyone already knows?" question. The integration moat only works if the core canvas feels real.

### Provenance, Trust, and Beginner Clarity (Core Contract Violations)
- **BB-UI-04** | Users cannot instantly distinguish starter / project-linked / stash-backed / exact / coach-generated / schematic-synced parts and wires at the visual and inspector level | Workflow-playbook #2: "Clarify provenance". UX contract: "Starter parts, project-linked parts, stash parts, and exact parts are clearly different." Gotchas and ai-audit-and-sync both flag this as fundamental. Current implementation relies on inspector + subtle provenance tags on wires. | M–L | **P0** | This is a direct violation of the breadboard-lab identity. Beginners (the primary education persona) cannot tell what is "real" vs "suggested".

---

## P1 — High Velocity / Correctness / Polish

- **BB-TD-05** | `breadboard-part-inspector.ts` (816 LOC / 409 complexity) and related trust model are themselves large and entangled with the canvas | Trust/readiness is a first-class Lab concept. Having another 800+ LOC module at this complexity level for the "decide what to do next" experience is risky. | L | P1
- **BB-UI-05** | Canvas toolbar + CanvasToolbar.tsx density + small viewport behavior not validated against the "do not crowd", "menu must scroll", "laptop viewports" rules in ux-contract and gotchas. | M | P1
- **BB-TD-06** | Test bloat on BreadboardView.test.tsx (1,361 lines, 40 tests) while the 1,677 LOC canvas has insufficient coverage of the pointer + bench + sync + coach interaction matrix | Testing guide exists and is good. Reality is classic: happy-path + dialog tests while the runtime monster has light structural coverage. | L | P1
- **BB-EN-01** | No first-class "commit from bench to board" explicit gesture with clear before/after trust change | The Lab model would benefit from making the mental model transition a deliberate, visible, undoable action rather than implicit drag semantics. | M | P1

---

## P2–P3 — Future Polish & Differentiation

- **BB-EN-02** | Richer physical simulation / collision / clearance inside the bench area itself (not just on the board)
- **BB-FG-02** | One-click "send this bench configuration to schematic" (reverse of current primary sync direction)
- **BB-UI-06** | Empty state + first-30-seconds guidance for the full Lab (bench + coach + hardware inspection) is still weak compared to the "tell how to start within seconds" contract
- **BB-EN-03** | Measurement / clearance / ratsnest quality overlays that work on the bench area the same way they do on the placed board

---

## Cross-Contract Synthesis (Why These Are Real)

The breadboard-lab skill's own references repeatedly emphasize:
- "Can a beginner tell how to start within seconds?"
- "Clarify provenance"
- "Strengthen readiness"
- "Sync is high risk — silent success can feel wrong"
- "AI output should never look more trusted than verified data"
- "Improve debugging confidence, not just visual density"

The 1,677 LOC canvas + the supporting 800–1,400 LOC modules (audit, part inspector, coach plan, sync) concentrate almost every one of these requirements into a small number of extremely complex files with no clean ownership boundaries.

This is worse than the 3D View case because the 3D problems were mostly "data never arrives + dead code + toy renderer". The breadboard problems are "the most important workflow in the product for makers and educators is implemented as a single growing runtime with acknowledged but unexecuted extraction plans."

**Total high-impact items surfaced in this scoped analysis:** 14 (6 P0, 4 P1, 4 P2/P3). The canvas deep-dive alone justifies the top three P0s.

**Recommendation:** The first wave must include a credible plan to split the canvas (even if only into 3–4 major sub-owners) + explicit provenance/trust visual language + making the coach and board health outputs first-class citizens of the bench mental model. Everything else (including competitive differentiation vs Fritzing) becomes dramatically easier or obvious after that.

Update this checklist after each implementation wave. Re-run the scoped analysis after the canvas split lands.
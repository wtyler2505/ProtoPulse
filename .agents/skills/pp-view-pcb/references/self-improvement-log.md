# PCB Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so PCB work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real PCB behavior.

## Pending Proposals

- Add screenshots for the main PCB states.
- Add DRC/placer enforcement once the visible PCB provenance dock has proven stable in browser checks.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-pcb)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-pcb/scripts/inspect-pcb.mjs` → **Status: ok** (PCBLayoutView.tsx 1340 lines / 270 CCN; full surface 22 files / 854 CCN — one of the heaviest in the codebase).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep quantitative + structural analysis:
   - scc on the full PCB surface (PCBLayoutView 1155 code / 270 CCN, PCBInteractionManager 104 CCN, tscircuit-compile-proof 96 CCN, ComponentPlacer 54 CCN, LayerManager 38 CCN, etc.).
   - Full read of `PCBLayoutView.tsx` (thin orchestrator wiring extracted modules: PCBCoordinateSystem, LayerManager, ComponentPlacer, PCBInteractionManager, PCBBoardRenderer, TraceRenderer, ViaRenderer, etc.; pulls the full canonical model via useCircuit* hooks; has View3DButton, ratsnest, DRC, zones, comments, paste, undo/redo, tool palette; sync comments to 3D and PcbOrderingView).
   - Subdir `views/pcb-layout/**` contains the extracted low-level renderers and managers (many with dedicated tests).
   - Lib `lib/tscircuit-*.ts` is the v3 engine path (the thing the Architecture view was extracting primitives to eventually replace the custom canvas with).
   - Cross-referenced entire campaign (Architecture view's "dual-maintenance" and Phase 0 extraction comments, 3D View bidirectional sync, Exports/Order PCB "Complete Fab Package", Component Editor footprints + verification, breadboard placements, Generative, Lifecycle, Inventory, provenance/trust, UI Container Rule, a11y InteractiveCard migration E2E-552).
4. Grepped for provenance (`generatedFrom`, verification), 3D sync, exact-part enforcement, tscircuit vs custom canvas tension.
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (Page Behavior / Layout / Tests / Workflow Clarity):**

- **Major extraction has happened, but the surface remains extremely heavy (P1 tech debt):** The view header proudly states it is now a "thin wrapper" over extracted modules from `views/pcb-layout/`. This is the result of the Architecture view's Phase 0 work. However, the total complexity is still 854 CCN across 22 files, with the main orchestrator at 270 CCN and several low-level managers (InteractionManager 104, ComponentPlacer 54, LayerManager 38) remaining dense. The "dual-maintenance" cost mentioned in the Architecture view (custom canvas + tscircuit path) is still real and expensive.

- **3D bidirectional sync exists and is documented (positive):** There are explicit comments and a `View3DButton` that navigates to 'viewer_3d', plus sync logic so that PCB changes (positions, rotations, side) flow to the 3D viewer and vice versa. The board state is mirrored to the shared per-project board for the 3D view. This is the correct integration after the 3D rescue campaign.

- **Provenance / "AI-generated or uncertain data" enforcement is not visible in the placer or DRC (P1 gap):** The placer and DRC logic do not appear to consult exact-part verification status, generative origin, or lifecycle. You can likely place an unverified generative part or an EOL component without warning at the PCB level. The provenance is carried in the underlying CircuitInstance data (from earlier adoption), but the PCB UI does not yet surface or enforce it (no badges on footprints, no DRC rules for "unverified", no blocking of fab export for poor-provenance parts).

- **tscircuit v3 path is live but the custom canvas is not retired (P1 maintenance burden):** The presence of `tscircuit-compile-proof.ts`, `PCBBoardRenderer`, and the Architecture view's explicit "dual-maintenance" comment confirms that both the legacy custom absolute/SVG canvas and the new tscircuit renderer are being kept in sync. This is exactly the situation the Architecture extraction was trying to mitigate. Until one path is fully retired, every feature (zones, pours, DRC, comments, 3D sync) has to be implemented or mirrored in both.

- **UI Container Rule risks on the canvas + side panels:** With 1340 lines in the orchestrator and many side panels (DRC, layers, properties, comments, ratsnest), the classic risks (fixed heights, nested overflow, laptop viewports, focus management when the canvas is live) are present. The skill's own gotchas call this out.

- **Tests exist in the engine and sub-modules, but the orchestrator UI is lightly tested at the skill level:** The inspector shows "1 tests" on the main view file; the bulk of coverage is in the lib tscircuit tests and sub-renderer tests. Browser checks for live canvas behavior (selection, routing, 3D sync, short viewport with many panels open) remain essential.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Decide and execute the retirement of the dual canvas (the Architecture view's explicit debt)**
- The Architecture view already did Phase 0 extraction of primitives precisely to enable this. The PCB view is the place where the final decision must be made: keep maintaining both the custom canvas and tscircuit, or fully migrate to tscircuit and delete the legacy path. Every month of delay multiplies the cost.

**P1 — Enforce provenance / verification at the placer and DRC level (the safety story must reach the PCB)**
- When placing a footprint or routing, consult the underlying CircuitInstance's provenance (`generatedFrom`, verificationLevel from Component Editor, lifecycle status).
- Add DRC rules or placer guards: "Cannot place unverified generative part", "Warning: part is EOL", "This footprint has no verified 3D model — mechanical fit cannot be guaranteed".
- Surface provenance badges on footprints in the PCB view (consistent with Component Editor, Exports, Order PCB, etc.).

**P1 — Ensure full bidirectional 3D <-> PCB sync for positions, rotations, side, and mechanical envelopes (the 3D rescue must be complete)**
- The comments show intent; the actual data flow for mechanical envelopes (from Component Editor 3D models) and airwire/clearance feedback from the 3D viewer back into PCB DRC must be verified and hardened.

**P2 — Continue the extraction / simplification of the remaining dense managers (InteractionManager, ComponentPlacer, LayerManager)**
- The Architecture view showed the value of neutral, testable primitives. Apply the same discipline to the remaining PCB hotspots so the orchestrator can become truly thin.

**P2 — Add or expand browser + a11y checks for the live canvas on laptop viewports with multiple side panels open**
- The classic risks (scroll traps, focus loss when the canvas is interactive, overflow in properties/comments panels) must be explicitly validated after any layout or panel change.

**Strengths (relative to peers):**
- The extraction into `views/pcb-layout/**` has already happened and is documented — this is more progress than many other heavy surfaces (e.g., the breadboard god file still has the "Phase 2 will split this" comment).
- Explicit 3D sync comments and View3DButton show the integration with the hardened 3D View is a first-class concern.
- The tscircuit v3 path is live and has dedicated tests — the future is already partially present.
- Uses the canonical Circuit* hooks (same model as Architecture, 3D, Exports) — data consistency is architecturally correct.

**Cross-Cutting Value (highest — this is the actual fabrication geometry source):**
- Every footprint placed here, every trace routed, every layer defined, every zone created is what ultimately becomes the Gerbers, drill files, pick-and-place, ODB++, IPC-2581, and STEP that go to the fab in the Order PCB / Exports flow.
- If provenance is not enforced here, unverified generative parts or EOL components can silently make it into a real board order.
- If 3D mechanical sync is incomplete, the "enclosure will fit" promise from the 3D View is broken at fabrication time.
- This is the single most important place where the entire safety/provenance/3D/exact-part campaign must be enforced before money is spent.

**Durable Lesson:**
Extracting modules (the Architecture Phase 0 work) is necessary but not sufficient. The PCB view now has many small files, but the total complexity is still extreme (854 CCN) and the dual-canvas maintenance burden is still being paid. Until the custom canvas is retired in favor of tscircuit, and until the placer/DRC actually consults the provenance and 3D mechanical data that lives on the CircuitInstances, the "ship with confidence" story has a hole right at the geometry that gets fabricated.

**Recommended for Codex (immediate high-ROI tasks after handoff):**
1. Make the explicit decision on dual-canvas retirement and create the plan to delete the legacy custom canvas path (or document why both must be kept).
2. Add provenance checks and badges in the ComponentPlacer and DRC (consult verificationLevel, generatedFrom, lifecycle on the underlying instances; block/warn on poor-provenance parts).
3. Verify and harden the full 3D <-> PCB bidirectional sync for positions, rotations, side, and mechanical envelopes (including feedback from 3D clearance into PCB DRC).
4. Continue extraction/simplification of the remaining dense managers (InteractionManager, ComponentPlacer, LayerManager) so the orchestrator can shrink further.
5. Add or expand browser + a11y checks for the live canvas + multiple side panels on realistic laptop viewports; ensure focus order and scroll behavior are correct.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc hotspots (854 CCN total, 270 in the orchestrator), explicit "thin wrapper" header vs reality, 3D sync comments, provenance gap in placer/DRC, dual-canvas debt (cross-ref to Architecture view), and cross-references to the entire 3D rescue, exact-part, breadboard-lab, Exports/Order PCB, Generative, Lifecycle, and provenance campaign from the same handoff audit.
- No production code mutated during this discovery-only pass.
- All findings tied directly to the Architecture extraction, 3D bidirectional sync, provenance enforcement, and UI Container Rule work from the same handoff campaign.

---

*PCB analysis complete. The view is the actual fabrication geometry source and has done significant extraction, with explicit 3D sync in place. However, it remains one of the heaviest surfaces (854 CCN), still carries the dual-canvas maintenance burden, and does not yet enforce the provenance/verification signals at the placer/DRC level. This is the single most important place where the entire safety story must be enforced before real boards are ordered. The extraction is real progress; the retirement of the legacy path and provenance enforcement are the remaining high-leverage gaps. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended PCB section (2026-05-23).*

---

## 2026-05-25 — R30 PCB Surface Provenance Dock

**Change landed:**
- Added a PCB canvas status/provenance dock in `PCBLayoutView.tsx` using the shared `TrustBadge` primitive.
- The dock is collapsible, scrollable, resizable, and positioned away from the existing layer stack/minimap overlays.
- Added `getPcbSurfaceStatus()` so provenance, placement, routing, and board-size status can be tested without driving the full canvas.
- Added `client/src/components/circuit-editor/__tests__/PCBLayoutView.status.test.tsx`.

**Durable lesson:**
- PCB is the fabrication geometry source, so provenance cannot live only in Export/Order PCB gates. The canvas itself needs a visible, low-friction signal before DRC/placer enforcement arrives.

**Next high-value follow-up:**
- Feed the same status into PCB DRC/placer rules so unverified generated footprints warn or block before fabrication/export actions.

---

## 2026-05-25 — R31 PCB DRC/Fabrication Safety Gate

**Change landed:**
- Extracted PCB surface trust/status logic into `client/src/lib/pcb/pcb-surface-status.ts` so DRC, validation, export, and money gates can consume the same truth.
- Added `getPcbSurfaceSafetyGate()` to separate "DRC can still run" from "fabrication is blocked or needs review."
- Routed the PCB context-menu Run DRC event through the workspace so gate warnings show before validation runs.

**Durable lesson:**
- PCB DRC should stay runnable even when provenance is bad, because it helps users find fixes. The hard stop belongs on fabrication/export readiness, while DRC receives and displays the gate context.

**Next high-value follow-up:**
- Make Exports and Order PCB consume `PcbSurfaceSafetyGate` so blocked PCB provenance cannot silently reach Gerber, pick-and-place, or order flows.

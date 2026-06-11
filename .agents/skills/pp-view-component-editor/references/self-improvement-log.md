# Component Editor Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Component Editor work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Component Editor behavior.

## Pending Proposals

- Add screenshots for the main Component Editor states.
- Add more specific gotchas after the next real Component Editor implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-component-editor)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-component-editor/scripts/inspect-component-editor.mjs` → **Status: ok** (5 tracked tests, main surface `ComponentEditorView.tsx` 1264 lines + 27 files under `component-editor/**`).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep quantitative + structural analysis:
   - scc on the full surface: 28 files, 7360 code LOC, **1498 total complexity** (ShapeCanvas 240 CCN, PathEditor 120, ShapeRenderer 138, GeneratorModal 89, DatasheetExtractModal 91, main view 266 CCN).
   - `client/src/components/views/ComponentEditorView.tsx` (orchestrator with provider wrapper, 6 view tabs, stacked modals for Generator/ExactDraft/Verify/Datasheet/Pin/Modify/Validation/Publish/Library, persistent Inspector + optional DRC/History panels, heavy trustSummary gating).
   - `client/src/lib/component-editor/ComponentEditorProvider.tsx` + reducer (isDirty, undo/redo, all shape/pin/meta mutations).
   - Key sub-editors: ShapeCanvas, PinTable, ComponentInspector, ExactPart*Dialogs, DRCPanel, SpiceSubcircuitEditor, GeneratorModal, etc.
   - Test surface: `ComponentEditorAutoSave.test.tsx` (5 tests, BL-0273 debounce investigation) + dedicated sub-tests in `component-editor/__tests__/` and `lib/component-editor/__tests__/`.
   - Backend hooks (`useCreateComponentPart`, `useUpdate...`, `useVerifyComponentPart`, `usePublishToLibrary`, `useComponentParts`) backed by `server/routes/components.ts` + `@shared/component-trust` + `exact-part-verification`.
   - Cross-referenced prior audits (breadboard-lab provenance, 3D mechanical fit, community assets, audit-trail, parts catalog).
4. Ran nearest test (`npm run test -- .../ComponentEditorAutoSave.test.tsx`) → 5/5 green.
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (Metadata / Pin Data / Footprint Readiness / Part Editing Safety):**

- **Strong safety & trust surface (major strength)**: This view is the primary authoring surface for "exact parts." It deeply integrates the canonical trust primitives (`getVerificationLevel`, `getVerificationStatus`, `summarizePartTrust`, `buildExactPartVerificationReadiness`, `verificationLevel: 'official-backed' | 'mixed-source' | 'community-only'`). Publish to library is explicitly blocked for unverified candidate exact parts. ExactPartDraftModal + ExactPartVerificationDialog + verification badges are first-class. This is the "Part Editing Safety" contract made real.

- **Rich visual + AI tooling (Generator, Datasheet/Pin extract, ShapeCanvas with DRC, SnapGuides, PathEditor)**: Tabs for Breadboard / Schematic / PCB / Metadata / Pin Table / SPICE live previews. AI-assisted creation (GeneratorModal, DatasheetExtractModal, PinExtractModal) + validation + DRC overlays. DiffPreview and HistoryPanel for auditability.

- **Critical complexity concentration (P1 tech debt)**: 1498 CCN across 28 files. ShapeCanvas + PathEditor + ShapeRenderer are the hot core (visual authoring of footprints/shapes). Any change here risks the "fixed height / scroll trap" gotcha called out in the skill. The main view JSX is a 1100+ line conditional rendering tree with many stacked dialogs.

- **Auto-save / persistence contract**: Dedicated test (BL-0273) proves debounce-on-dirty works (effect depends on isDirty + present + partId). The logic has moved/refactored since the test comment was written (no longer obvious in the 1264-line view), but the test still passes and the provider maintains isDirty on every mutation.

- **Integration debt & opportunity (cross-audit)**:
  - This is the natural "source of truth" for parts that power BreadboardLab exact-part placement, 3D mechanical envelopes, and the community parts catalog.
  - CommunityView has a `'3d-model'` + symbol/footprint type with zero import path here.
  - Breadboard "View in 3D" button work is the mirror; this editor should be able to "round-trip" a placed part back into the visual editor for refinement.
  - No visible "Publish to Community Library" flow that would feed the Community asset browser (the publish dialog exists but targets the internal library).

- **UI Container / Layout risks (per gotchas + UI Container Rule)**: Heavy use of modals + side panels + conditional canvas. Laptop-height viewports and long pin tables / shape lists are called out as things that must scroll cleanly. No evidence of recent violations in the code, but any future density work must re-run the browser checklist.

**P0 / P1 / P2 Backlog Items for Codex (added to master report):**

**P1 — Complexity & Maintainability of the Visual Core**
- ShapeCanvas (240 CCN), PathEditor (120), ShapeRenderer (138) are the immovable god files for part geometry. They need the same extraction discipline that ArchitectureView received in Phase 0 (neutral primitives for hit-testing, snapping, transforms).
- High risk of scroll traps or fixed-height containers when adding new inspector fields or canvas overlays.

**P1 — Round-trip & Provenance Closure with Maker Surfaces**
- After editing a part here (especially after verification), there should be an obvious "Use this part on Breadboard" / "Place in 3D scene" / "Add to active design" action that carries the full provenance (`community-only` vs `official-backed`, verification date, source evidence).
- The reverse (select a part on breadboard → "Edit in Component Editor") should exist and pre-load the correct partId + version.

**P2 — AI + Community Library Unification**
- The Generator + Extract modals are powerful. They should be able to seed from (or publish verified results to) the Community asset library we just audited, with proper trust receipts.
- "Fork from Community component" flow would be a natural bridge between the two "community" worlds.

**P2 — Test & Visual Verification Coverage**
- Only the auto-save debounce has a dedicated high-level test. The canvas, DRC, exact-part verification dialogs, and multi-view (breadboard/schematic/pcb) rendering have thin automated coverage relative to their complexity and safety importance.
- Browser checklist (laptop viewport, long pin tables scrolling, modal stacking, focus management during verify flows) must be re-run after any layout or density change.

**Strengths (notable in the full-app audit):**
- This is one of the best examples of "safety by default" in the entire codebase. The verification gate before public publish for exact parts is exactly the discipline the breadboard-lab provenance and audit-trail work are trying to enforce everywhere.
- Deep, first-class use of the shared component-trust and exact-part-verification modules (not bolted on).
- Live multi-view (breadboard/schematic/pcb) + DRC + SPICE + pin table in one place is a genuinely professional component authoring experience.
- AI assistance is present but gated behind the same safety/verify surface.

**Cross-Cutting Value:**
- The single most important authoring surface for anything that will ever touch real hardware in ProtoPulse (breadboard wiring guides, 3D mechanical fit, DRC on PCB, exact-part coach overlays).
- Natural place for future "mechanical envelope" editing that feeds the 3D View directly.
- Perfect testbed for richer provenance UI (show evidence list, "last verified by X on date Y", "used in N boards" stats) that the rest of the system can adopt.

**Durable Lesson:**
When you build the authoring tool for the data that powers safety-critical downstream experiences (breadboard health, 3D clearance, board verification), the highest-ROI investment is not more features — it is making the safety and provenance gates impossible to bypass and visually obvious at every step. ProtoPulse has done this correctly in the Component Editor. The remaining work is mostly making the high-complexity visual core more maintainable and closing the round-trip loops with the surfaces that consume the parts.

**Recommended for Codex (immediate high-ROI tasks):**
1. Extract reusable geometry/hit/snap primitives from ShapeCanvas + PathEditor (mirror the Architecture diagram extraction success).
2. Add explicit round-trip actions ("Edit this part in Component Editor" from BreadboardPartInspector and from 3D selection; "Place verified part on breadboard / in 3D" from the editor).
3. Strengthen the test surface around ExactPartVerificationDialog and the publish gate (the most safety-critical paths).
4. Ensure every long list/panel (pin table, shape list, history, DRC violations) respects the UI Container Rule on laptop viewports.
5. Decide/document the relationship between "publish to internal library" and "publish to Community asset browser" so the two community surfaces are not further fragmented.

**Evidence & Contract Compliance:**
- Inspector clean on entry and final re-run.
- Nearest test (auto-save) executed and green.
- Full self-improvement entry + master backlog section written before moving on.
- No production code mutated during this pure discovery pass.
- All findings tied back to the 3D hardening, breadboard-lab provenance, community assets, and exact-part trust work from the same audit campaign.

---

*This entry closes the analysis phase for Component Editor. The skill now carries a durable record of the safety-critical authoring surface at the Codex handoff moment. Warnings remain defects; any future layout or canvas work must re-execute the full browser + inspector checklist.*

---

**R17 Component Editor -> 3D bridge**

**Date:** 2026-05-24.

The Component Editor toolbar now has a `View in 3D` action for the active part. It publishes the current part title, package/model kind, exact-part verification status/level, trust family, and derived pin-map confidence through the generic 3D bridge before switching to `viewer_3d`. Until a full ComponentEditorView render test exists, TypeScript plus browser proof are the minimum checks for this bridge.

---

**R26 Component Editor Browser Bridge Proof**

**Date:** 2026-05-25.

The 3D bridge E2E spec now seeds a real exact-part row through `/api/projects/:projectId/component-parts`, opens Component Editor, selects that part, and clicks `button-view-3d`. The 3D viewer must show the part title, `Component Editor selection`, `official-backed`, `pin map exact`, package format, trust family, and `ready now`.

Durable lesson: this bridge should stay tied to the selected persisted part, not just the currently edited form. If future work changes part loading, part list behavior, or verification metadata, keep this browser proof green.

---

**R35 Component Editor 3D Bridge Contract**

**Date:** 2026-05-25.

The toolbar action now uses the same visible language as the other bridge entry points: `View in 3D`. The shared `viewer-3d-bridge` unit test now explicitly covers Component Editor exact-part payload fields, so source id, verification level/status, trust family, pin-map confidence, model kind/format, and ready state cannot drift silently while the browser proof covers the real route handoff.

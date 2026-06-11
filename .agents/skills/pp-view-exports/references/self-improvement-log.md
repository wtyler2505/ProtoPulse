# Exports Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Exports work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Exports behavior.

## Pending Proposals

- Add screenshots for the main Exports states.
- Add more specific gotchas after the next real Exports implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-exports)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-exports/scripts/inspect-exports.mjs` → **Status: ok** (ExportPanel.tsx 1244 lines / 75 CCN, 4 tests referenced in panel, supporting lib/export-*.ts + tests present).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep analysis:
   - scc on ExportPanel (1179 code, low density 6.36 CCN/line — declarative format registry + state orchestration).
   - Full structural read of `client/src/components/panels/ExportPanel.tsx` (categories for Schematic, Fabrication with "Complete Fab Package", 3D-CAD/STEP, Firmware, Documentation/BOM/PDF/FMEA; per-format validation + precheck flow; ReleaseConfidenceCard + TrustReceiptCard at top; CircuitSelector; ExportProfileSelector; ExportResultsPanel; full bidirectional Import flow with preview/warnings/repair/diff/history; special PickPlacePreview).
   - Core readiness logic: `client/src/lib/export-precheck.ts` (format-specific check runners, bomShortfallCheck BL-0150, stepChecks only requires pcbLayout), `export-validation.ts` (ProjectExportData shape — no 3D/exact-part/breadboard fields), `export-snapshot.ts`, trust-receipts, workspace-release-confidence.
   - Cross-referenced entire campaign (3D hybrid + R3F airwires, Component Editor exact-part verification + mechanical, breadboard-lab provenance + board health + coach, Digital Twin shadow/comparison, Dashboard health, Arduino firmware).
4. Ran scc + targeted reads/greps on precheck runners for STEP/3D, fab-package, pick-place.
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (Exports / Artifact Download / Format Readiness / Fab Handoff):**

- **Mature, comprehensive surface (major strength):** One of the richest panels analyzed. 20+ formats across 5 categories, including the flagship "Complete Fab Package" (Gerbers + drill + BOM + P&P in one zip — perfect for JLCPCB/PCBWay). Strong "Format Readiness" via `validateExportPreflight` + `runExportPrecheck` + per-format `ExportPrecheckPanel` with granular pass/warn/fail + "export anyway" override. Excellent provenance integration at the top (ReleaseConfidenceCard + TrustReceiptCard built from BOM/validation/architecture signals + `buildExportTrustReceipt`).

- **Bidirectional safety is first-class:** Full import pipeline (ImportPreviewDialog, ImportWarningsPanel, ImportRepairDialog, ImportHistoryPanel, DesignDiffPanel) with repair and diff — directly supports safe "fab handoff round-trip" and the "AI-generated or uncertain data is clearly marked" contract.

- **"Format Readiness" and "Fab Handoff" for PCB is strong; for 3D/Mechanical is thin (P1 gap):** 
  - STEP (3D-CAD category) precheck (`stepChecks`) only requires `pcbLayoutCheck` + session/project name. No checks for:
    - Presence of verified 3D models / mechanical envelopes from Component Editor.
    - Exact-part verification status or provenance level on the parts.
    - Breadboard placements or 3D fit data.
    - Digital Twin shadow / comparison confidence.
  - The `ProjectExportData` interface and the `exportData` memo in the panel collect zero signals from the 3D View, Component Editor verification, breadboard exact placements, or digital twin.
  - "Complete Fab Package" is PCB-centric; mechanical/3D handoff feels like a stub despite the massive recent investment in BoardViewer3D + exact parts + breadboard provenance.

- **Inventory / BOM signals are well integrated (BL-0150):** `bomShortfallCheck` and `bomShortfallUnits` from `useBomShortfalls` surface real "order parts before fab" warnings for pick-place and fab-package — excellent.

- **Panel size vs. density:** 1244 lines is large, but mostly the big `EXPORT_CATEGORIES` declarative table + per-format state + handlers. Complexity is low (75 CCN). The heavy lifting for readiness lives in the lib (good separation), but the 3D/STEP path has not kept up with the rest of the system.

- **No breadboard or digital-twin signals in any precheck:** Wiring guides, bench-specific BOM variants, coach reports, shadow comparison health — none of these surface in Format Readiness or get included in "fab handoff" artifacts.

**P0 / P1 / P2 Backlog Items for Codex (added to master report):**

**P1 — 3D/Mechanical Fab Handoff Readiness (highest leverage after 3D + Component Editor campaigns)**
- Extend `ProjectExportData` and the exportData builder to include 3D model presence, verified exact-part status, mechanical envelope completeness, and breadboard placement data for parts.
- Add real `stepChecks` / STEP-specific precheck items (e.g., "All placed components have verified 3D models", "Mechanical envelopes present for enclosure fit", "Exact-part verification level sufficient for fab").
- Consider a "Mechanical Fab Package" or enrichment of the Complete Fab Package that includes STEP + pick-place + breadboard-derived 3D fit reports.
- Wire the hardened BoardViewer3D + Component Editor verification state into the export trust receipt and release confidence for 3D formats.

**P1 — Surface Breadboard + Digital Twin in Fab Handoff**
- Add precheck items and optional export artifacts for breadboard-specific data (wiring guides, bench BOM, coach health summary) and digital twin (shadow channels, comparison health report) when the project has breadboard or live hardware data.
- Make these visible in the "Fabrication" or a new "Maker / Bench" category.

**P2 — Polish & Extraction**
- The 3D-CAD and Firmware categories feel lighter than Schematic/Fabrication/Documentation — give them the same precheck depth and UI affordances (previews where useful).
- Consider extracting the giant `EXPORT_CATEGORIES` + runner map into a registry + plugin-style format definition to keep the 1244-line panel from growing further as new formats (e.g., full 3D assembly with breadboard) are added.

**Strengths (relative to peers):**
- Best-in-audit example of "Format Readiness" with actionable per-format precheck panels and "export anyway" safety valve.
- Outstanding trust/provenance surface (Release + Trust cards) that directly serves the breadboard-lab + component-editor provenance identity.
- Mature bidirectional import with repair/diff/history — rare and valuable for fab workflows.
- BL-0150 inventory shortfall integration is thoughtful and practical.

**Cross-Cutting Value:**
- This is the final "ship it to the real world" surface. All the safety, provenance, 3D mechanical, exact-part, breadboard health, and digital twin work must ultimately be reflected here for the handoff to be trustworthy.
- Currently the strongest PCB fab handoff in the app; the weakest link for the new 3D + exact-part + breadboard mechanical story.

**Durable Lesson:**
A rich export center with excellent per-format readiness and provenance cards can still have a "3D tax" if the data model (`ProjectExportData`) and precheck runners were not updated when the 3D View, Component Editor verification, and breadboard provenance systems were built. The contract says "Format Readiness" and "Fab Handoff" must be visible — for mechanical/3D they currently are not at the depth the rest of the system now provides.

**Recommended for Codex (immediate high-ROI tasks):**
1. Extend `ProjectExportData` + exportData construction to pull 3D model / verification / breadboard placement signals (from Component Editor hooks, useCircuitInstances with pcbX/Y + side, breadboard state, etc.).
2. Add substantive checks to `stepChecks` (and any future 3D assembly formats) and wire them into the UI (warnings, precheck panel, trust receipt caveats).
3. Consider a "Mechanical / Enclosure Fab Package" or enrichment of the existing Complete Fab Package.
4. Add at least one integration test that exercises STEP precheck with (and without) verified 3D models + exact parts.
5. Ensure the 3D-CAD category gets the same visual treatment (icons, descriptions, previews if feasible) as Fabrication.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry written with scc numbers, exact precheck runners for STEP vs fab-package, data shape gaps, and explicit mapping to the four UX contract pillars + cross-audit (3D rescue, Component Editor, breadboard-lab, Digital Twin).
- No production code mutated during discovery.
- All findings tied to the 3D hardening, exact-part verification, breadboard provenance, and trust work from the same handoff campaign.

---

*Exports analysis complete. The panel is mature for PCB fab handoff and provenance, but the 3D/mechanical path has not kept pace with the rest of the system. Highest-leverage gap to close for a complete "ship with confidence" story. Ready for the next `/pp-view-xxx`.*

---

*End of appended Exports section (2026-05-23).*

## Implementation Note — 2026-05-23

- Added the first export precheck enforcement slice from the audit: fabrication and STEP exports now consult selected-circuit provenance/mechanical signals.
- `ExportPanel` derives those signals from active circuit instances plus component-part metadata (`aiGenerated`, `exactPartTrust`, `verificationStatus`, `breadboardModelQuality`).
- The precheck checklist now shows `AI-Generated Circuit Provenance`, `Exact-Part Verification`, and `Verified Mechanical Models` where relevant.
- Verification: export validation/precheck tests passed 126 cases, and the full TypeScript check passed after nearby handoff compile blockers were repaired.

## Implementation Note — 2026-05-24 R3

- `ExportPanel` now derives its safety-gate counts from the shared `buildValidationSafetyGateData()` helper instead of local provenance-only logic.
- Export prechecks now receive the same red breadboard-health, lifecycle/no-alternate, and estimated inventory-confidence counts that Validation displays.
- Verification: focused export/validation Vitest suite passed 146 tests; `npm run check`, `npm run check:api-types`, page-skill checks, and `npm run build` passed with the already-classified Vite large-chunk perf debt.

## Implementation Note — 2026-05-26 R59

- Fabrication-style Exports now share the upstream trust gates instead of letting individual formats bypass them: Gerber, tscircuit Gerber, drill, pick-and-place, ODB++, IPC-2581, etchable PCB, and fab-package all consume generative provenance, exact-part trust, breadboard health, lifecycle risk, and inventory-confidence signals.
- `etchable-pcb` now has a real export validator instead of falling through the unknown-format allowance.
- The export trust receipt now surfaces exact-part, 3D model, and breadboard-health facts and drops from ready to caution when formats technically pass but upstream trust warnings remain.
- Verification: focused export validation/precheck/trust receipt/safety-gate Vitest suite passed 187 tests before broader checks.

# AUDX-02: Import/Export Truthfulness and Roundtrip Audit

Date: 2026-03-30  
Author: Codex  
Wave: Deep Systems Expansion  
Purpose: Determine whether ProtoPulse import/export flows tell the truth about what they can preserve, then define how to turn interchange into a trustworthy product surface.

## Current Trust Posture
- `Safe for exploratory interchange`: partially
- `Safe for manufacturing handoff without manual verification`: no
- `Safe for roundtrip fidelity claims`: no

ProtoPulse has a broad and ambitious import/export surface, but current evidence still points to truthfulness gaps, contract drift, and multiple silent-loss or silent-mismatch risks.

## What Was Reviewed
- Prior import/export audits:
  - `docs/audits_and_evaluations_by_codex/11_FE-11_import_export_interop_ux_audit.md`
  - `docs/audits_and_evaluations_by_codex/23_BE-09_export_pipeline_audit.md`
- Route-surface and security context:
  - `docs/audits_and_evaluations_by_codex/17_BE-03_main_rest_route_surface_audit.md`
  - `docs/audits_and_evaluations_by_codex/29_BE-15_security_hardening_audit.md`
- Product claims and manufacturing framing:
  - `docs/product-analysis-checklist.md`
  - `docs/audits_and_evaluations_by_codex/33_UIUX-00_master_rollup.md`

## What Was Verified
- Reconfirmed that the FE and BE audit set already documents both user-flow breakage and backend truthfulness risks.
- Reconfirmed that import success and export readiness can still be overstated relative to actual state application and contract fidelity.
- Reconfirmed that no current audit artifact proves robust semantic roundtrip diffing across major file formats.
- No new external roundtrip tests were executed in this pass.

## Findings By Severity

### 1) `P0` Exporters can still silently assign wrong nets or otherwise emit semantically incorrect output
Evidence:
- `23_BE-09_export_pipeline_audit.md`
- Prior backend audit already flagged wire-to-net mapping risk in KiCad/Eagle export paths.

Why this matters:
- This is the most dangerous kind of import/export defect: an output file that looks valid but is electrically wrong.
- Silent wrongness is much worse than a hard failure.

Recommended direction:
- Treat semantic net-mapping validation as a release gate for serious export claims.
- Add post-generation sanity checks and explicit warning receipts.

### 2) `P1` Import UX can imply success without actually applying imported data to project state
Evidence:
- `11_FE-11_import_export_interop_ux_audit.md`
- Prior frontend audit already documented that the import control can parse a file but fail to project that imported state into the active design.

Why this matters:
- This creates the exact kind of trust break users never forget: “the app said it imported my design, but nothing changed.”

Recommended direction:
- Separate `parsed successfully` from `applied successfully`.
- Show an explicit mapping/apply/commit flow with a diff preview.

### 3) `P1` FE/BE export contract drift still undermines output truthfulness
Evidence:
- `11_FE-11_import_export_interop_ux_audit.md`
- Prior FE audit recorded:
  - `fzz` export contract mismatch
  - Gerber payload mismatch dropping layer files
  - export-panel auth/header drift
- `23_BE-09_export_pipeline_audit.md`
- Prior BE audit recorded:
  - ambiguous multi-circuit export targeting
  - inconsistent route-level preflight coverage

Why this matters:
- Even when generator code is sound, contract mismatches can make the product deliver incomplete bundles or the wrong target data.

Recommended direction:
- Define one typed export manifest contract per format family and enforce it end to end.

### 4) `P1` Manufacturing preflight is still inconsistent across export families
Evidence:
- `23_BE-09_export_pipeline_audit.md`
- DRC blocking was previously confirmed on Gerber routes but not consistently across other manufacturing outputs.
- `32_SH-02_shared_validation_standards_audit.md`
- Manufacturer template standards are implemented but not connected consistently to runtime validation.

Why this matters:
- A user can mistake “export succeeded” for “design passed the checks appropriate for fab.”

Recommended direction:
- Create one shared export preflight system for all manufacturing-bound outputs.
- Show which checks ran and which did not.

### 5) `P1` Archive and hostile-input protections are asymmetric
Evidence:
- `23_BE-09_export_pipeline_audit.md`
- `29_BE-15_security_hardening_audit.md`
- FZZ import path was previously called out as lacking archive-bomb protections present elsewhere.

Why this matters:
- Interchange features are one of the easiest hostile-input entry points in a desktop engineering tool.

Recommended direction:
- Standardize decompression limits, entry-count limits, and semantic parse limits across all archive-based formats.

### 6) `P2` Roundtrip fidelity is not measured, labeled, or surfaced to the user
Evidence:
- `11_FE-11_import_export_interop_ux_audit.md`
- Prior frontend audit already documented topology/refdes degradation and silent-loss risk on conversion.
- No audit artifact in the current corpus shows a roundtrip diff system or user-facing compatibility confidence layer.

Why this matters:
- Without roundtrip measurement, “supports KiCad/Eagle/Fritzing/STEP/FZZ” reads bigger than the evidence supports.

Recommended direction:
- Add format-level fidelity badges and roundtrip diff reports.

## Why It Matters
Import/export is where ProtoPulse stops being an internal workspace and starts making promises to the outside world. If those promises are vague, lossy, or silently false, users will not trust the app with existing projects or manufacturing handoff. The right bar is not universal perfect fidelity on day one. The right bar is explicit compatibility truth, visible preflight status, and receipts that explain exactly what survived, changed, or was skipped.

## Improvement Directions
1. Define a `truth receipt` for every import and export operation.
2. Add one canonical export manifest contract for every major output family.
3. Add explicit circuit/design selection instead of implicit first-circuit behavior.
4. Build semantic roundtrip tests and user-facing diff views.
5. Standardize archive parsing limits and hostile-input protections.
6. Make manufacturing outputs pass through one shared preflight and readiness layer.

## Enhancement / Addition / Integration Ideas
- Add a `Before you export` wizard showing missing footprints, unresolved nets, DRC status, fab preset, and output-specific warnings.
- Add `roundtrip preview` support for formats where ProtoPulse can re-import its own output.
- Add compatibility badges such as `geometry only`, `electrical mostly preserved`, `assembly data included`, `manufacturing-grade candidate`.
- Add export bundle manifests that list every generated file, version, checksum, and warnings.
- Add external-tool validation hooks for KiCad or fab-viewer sanity checks where feasible.
- Add `import mapping studio` flows for unknown packages, symbols, or metadata fields.
- Add `compare exported netlist to source netlist` tooling as part of serious manufacturing handoff.

## Quick Wins
1. Distinguish parse success from apply success in the import UX.
2. Fix known FE/BE contract mismatches for `fzz`, Gerber, and auth/header handling.
3. Require explicit target-circuit selection for multi-circuit export flows.
4. Add warning banners when export paths skip manufacturing preflight.
5. Add archive-bomb protections consistently across archive-based importers.

## Medium Lifts
1. Build structured export manifests and typed response contracts for every major output family.
2. Add roundtrip diff tooling for the highest-value formats.
3. Create format-specific confidence badges and warnings in the export UI.
4. Add canonical preflight receipts that show what checks passed, failed, or were skipped.
5. Create import-commit review screens with change summaries before project mutation.

## Big Swings
1. Build a `ProtoPulse Interchange Lab` that continuously measures roundtrip fidelity against golden projects.
2. Add one-click `fab handoff package` generation with semantic comparison, DRC receipt, BOM receipt, and assembly receipt bundled together.
3. Build an external compatibility certification program for major formats so the product can state not just that a format exists, but what level of fidelity is actually supported.

## Residual Unknowns
- No fresh real-world roundtrip corpus was executed in this pass.
- The audit corpus does not yet prove current STEP/Fritzing/firmware scaffold fidelity beyond route/generator presence.
- Manufacturing viewer validation outside ProtoPulse remains an open verification gap.

## Related Prior Audits
- `11_FE-11_import_export_interop_ux_audit.md` — confirmed
- `23_BE-09_export_pipeline_audit.md` — confirmed
- `17_BE-03_main_rest_route_surface_audit.md` — extended
- `29_BE-15_security_hardening_audit.md` — extended

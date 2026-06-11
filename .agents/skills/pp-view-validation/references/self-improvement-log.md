# Validation Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Validation work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Validation behavior.

## Pending Proposals

- Add screenshots for the main Validation states.
- Add more specific gotchas after the next real Validation implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

## Fast Workflow Execution Report — 2026-05-23 (pp-view-validation Full Audit Pass)

**User Command:** `/pp-view-validation`

**Inspector (entry + final exit):**
- Status: **ok** both times.
- Tracked tests: **62** (9 in ValidationView.test.tsx + 53 in export-validation.test.ts — one of the strongest test surfaces audited)
- Core sources: `ValidationView.tsx` (650 lines), `export-validation.ts` (427 lines), `validation/**` (BomCompletenessSection, DesignGatewaySection, DfmCheckSection, VirtualizedIssueList 432 lines, CustomRulesDialog, ValidationErrorBoundary, validation-helpers)
- scc: 9 files / 1,899 code / **462 CCN** (ValidationView 575c/135ccn, VirtualizedIssueList 416c/124ccn, export-validation 298c/85ccn)
- All references present. Re-run after discovery remained clean.

**Exact Fast Workflow Sequence Followed (non-negotiable contract):**
1. `node .agents/skills/pp-view-validation/scripts/inspect-validation.mjs` → ok (62 tests, all globs validated)
2. Read `references/page-map.md` (28 lines)
3. Read `references/ux-contract.md` (24 lines) — before any validation/precheck/layout synthesis
4. Read `references/testing.md` (28 lines)
5. Read `references/gotchas.md` (17 lines) — before any provenance/trust gate analysis
6. Read `SKILL.md` (Tier 1, strong test globs)
7. Deep source inspection (ValidationView + validation/** subdir + export-validation.ts + VirtualizedIssueList + DfmCheck + DesignGateway + BomCompleteness + CustomRules) + mandatory ast-grep + scc
8. Cross-campaign synthesis vs. Exports precheck, Order PCB, Procurement (the "last money gates"), provenance campaign, 3D/exact-part/generative/breadboard health, UI Container Rule on dense issue lists, Schematic/PCB/Architecture validation needs
9. Durable appends to this log + master report (section 40)
10. Final inspector re-run (ok)

**Quantitative Snapshot (scc on Validation surface):**
- 9 files / 1,899 code LOC / **462 CCN**
- Hotspots:
  - ValidationView: 575c / 135 CCN (coordinator with issue list, filters, custom rules, export precheck integration)
  - VirtualizedIssueList: 416c / 124 CCN (dense, performance-critical virtualized issue renderer)
  - export-validation.ts: 298c / 85 CCN (the actual precheck logic that feeds Exports/Order PCB/Procurement)
  - CustomRulesDialog, DfmCheckSection, DesignGatewaySection, BomCompletenessSection, validation-helpers, ValidationErrorBoundary
- Strong test coverage (62 cases) is a positive outlier vs. many previous surfaces.

**Source Ownership & Architecture:**
- `ValidationView.tsx` — page coordinator (uses useValidation, useCircuitDesigns, useBom, architecture, etc.; renders issue list, sections for BOM completeness / Design Gateway / DFM, custom rules, export precheck)
- `validation/**` — modular sections (BomCompleteness, DesignGateway, DfmCheck, VirtualizedIssueList, CustomRules, ErrorBoundary, helpers)
- `export-validation.ts` — the authoritative precheck logic (used by Exports, Order PCB, Procurement)
- Ties directly to the canonical model (CircuitDesign / CircuitInstance provenance must flow here)

**Deep Analysis vs. UX Contract + Campaign Cross-Refs (the "Last Money Gate" Test):**

- **Page Behavior & Workflow Clarity (strong functional surface, provenance gap fatal):**
  - Comprehensive validation surface: BOM completeness, Design Gateway (likely connectivity/ERC), DFM checks, custom rules, virtualized issue list, export precheck.
  - 62 tests + VirtualizedIssueList (performance-aware) + ErrorBoundary show real engineering maturity.
  - Feeds the downstream "last money gates" (Exports precheck + TrustReceipt, Order PCB wizard, Procurement risk).
  - **The fatal gap (P0 for the entire safety campaign)**: Exhaustive ast-grep across ValidationView + export-validation.ts + validation/** returned **zero** matches for TrustReceiptCard, ReleaseConfidenceCard, provenance, generatedFrom, exactPartVerification, VaultHoverCard, buildWorkspaceReleaseConfidence, etc.
  - The precheck layer that decides "is it safe to export/order/procure" does not consult or surface the upstream provenance (generative origin, Component Editor exact-part verification, 3D mechanical readiness, breadboard health, digital twin comparison, lifecycle status beyond basic checks, inventory confidence). A design with unverified generative parts, missing 3D models, red breadboard health, or EOL components can still pass validation and proceed to the money gates.

- **Layout & UI Container Rule (dense issue list risks):**
  - VirtualizedIssueList (124 CCN) + multiple sections + filters + custom rules dialog create the classic dense-surface risks (scroll traps, fixed heights, laptop viewport failures, focus management on long issue lists).
  - The inspector and gotchas correctly flag this; browser checks on realistic laptop heights with hundreds of issues are essential.

- **Tests (strong but provenance coverage likely missing):**
  - 62 tests is excellent (one of the best in the audit).
  - However, given the zero provenance signals in the source, the tests almost certainly do not cover "validation fails or warns on unverified generative / unexact / 3D-missing / breadboard-red designs." This is the highest-leverage missing test class for a Tier 1 gate.

**P0 / P1 / P2 Backlog Items for Codex:**

**P0 — Make Validation the provenance enforcement gate (the safety story dies here if it doesn't)**
- The export-validation logic and ValidationView issue engine must consult the underlying CircuitInstance / part verificationLevel, generatedFrom, hasVerified3D, breadboardHealthGrade, lifecycle status, inventory confidence, etc.
- Add hard/soft rules: "Cannot export/order with unverified generative parts", "Warning: part has no 3D model — mechanical fit unverified", "Red breadboard health — simulation results unreliable", etc.
- Surface provenance badges directly on issues and in the export precheck summary (consistent with the TrustReceiptCard / ReleaseConfidenceCard pattern used in Exports and Order PCB).

**P1 — Unify the Validation precheck with the authoritative Exports + Order PCB + Procurement trust receipts**
- Stop treating validation as an isolated DRC/ERC engine. The precheck output must feed (or be the same as) the TrustReceipt / ReleaseConfidence that is shown at the actual money gates.
- Validation must be the single source of truth for "is this design safe to fabricate/procure?"

**P1 — Enforce UI Container Rule on the virtualized issue list + side sections on laptop viewports**
- Long issue lists + multiple validation sections + filters must remain fully reachable and interactive on realistic laptop heights.

**P2 — Add explicit provenance-aware test cases** (unverified generative design fails/warns, missing 3D model, red breadboard health, EOL part with no alternate, etc.) in both ValidationView and export-validation test suites.

**P2 — Surface richer per-issue provenance context** (verification badge, generative origin link, 3D status, breadboard health) in the VirtualizedIssueList and detail views.

**Strengths (relative to peers):**
- One of the strongest test surfaces audited (62 cases, including deep export-validation logic).
- Modular section architecture (BomCompleteness, DesignGateway, DfmCheck, CustomRules) is clean and extensible.
- VirtualizedIssueList shows performance awareness for high-issue-count designs.
- ValidationErrorBoundary is good hygiene.
- Directly positioned as the precheck layer for the "last money gates" (Exports, Order PCB, Procurement) — the right architectural place for enforcement.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 62 tests — best-in-class).
- Mandatory ast-grep for all provenance/trust/generative signals returned zero matches across the entire Validation surface.
- Full scc report (1,899 code / 462 CCN, VirtualizedIssueList 124 CCN hotspot) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).
- All findings cross-referenced to Exports precheck + TrustReceiptCard (pp-view-exports), Order PCB (pp-view-order-pcb), Procurement (pp-view-procurement), Schematic/PCB/Architecture validation needs, the full provenance campaign (3D rescue, Component Editor exact-part gates, Generative stamps, breadboard-lab health, Digital Twin), UI Container Rule on dense issue lists, and the "last money gate" principle that has been the through-line of the entire handoff audit.
- Detailed Fast Workflow Execution Report appended here; master report section 40 written.

---

*Validation analysis complete. This is a Tier 1 safety-critical precheck surface (462 CCN, 62 tests) that is architecturally positioned as the gate before Exports, Order PCB, and Procurement — the "last money gates." The functional validation (BOM completeness, Design Gateway, DFM, custom rules, virtualized issues) is mature and well-tested. The critical gap is that it does not yet enforce or surface the upstream provenance story (generative origin, exact-part verification, 3D mechanical, breadboard health, etc.). Until Validation becomes the provenance enforcement layer, the entire safety investment upstream is theater at the point where real money leaves the building. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Validation section (2026-05-23).*

## Implementation Note — 2026-05-23

- First Codex continuation from `GROK_HANDOFF.md` landed the opening Validation/Exports provenance gate slice.
- `ProjectExportData` now carries AI-generated circuit instance counts, exact-part verification counts, and verified mechanical model counts.
- `fab-package` now blocks when AI-generated circuit instances still need exact-part verification; STEP warns when mechanical model coverage is incomplete.
- Verification: `npm run test -- client/src/lib/__tests__/export-validation.test.ts client/src/lib/__tests__/export-precheck.test.ts` passed 126 tests; `npm run check` passed after fixing unrelated handoff compile blockers.

## Implementation Note — 2026-05-24

- Extended the safety-gate preflight layer with red breadboard health, lifecycle risk, and inventory-confidence signals.
- `fab-package` now blocks red breadboard-health findings and lifecycle-risk parts without known alternates.
- `pick-place` and `bom-csv` now warn when inventory confidence is estimated or unknown.
- Verification: `npm run test -- client/src/lib/__tests__/export-validation.test.ts client/src/lib/__tests__/export-precheck.test.ts` passed 132 tests; `npm run check` passed.

## Implementation Note — 2026-05-24 R3

- Added `buildValidationSafetyGateData()` as the shared provenance/trust count builder for Validation and Exports.
- `ValidationView` now renders a visible Safety Gates section backed by the same structured export precheck checks for AI-generated provenance, exact-part verification, verified mechanical models, breadboard health, lifecycle risk, and inventory confidence.
- Added focused ValidationView coverage for unverified generative parts with red breadboard health, EOL/no-alternate risk, and estimated inventory confidence.
- Verification: focused Vitest suite passed 146 tests; `npm run check`, `npm run check:api-types`, page-skill checks, and `npm run build` passed. Targeted Validation Playwright a11y, keyboard-nav, and tab-route-matrix checks passed after the E2E project-id helper fix.

## Implementation Note — 2026-05-25 R38

- Safety gate blockers now render as first-class rows in `VirtualizedIssueList`.
- Warn/fail gates participate in the Validation header count and severity filters.
- The normal all-clear empty state is suppressed when provenance gates are the only active blockers.
- Gate rows use trust badges and review navigation to the likely repair surface: Generative, Component Editor, Breadboard, or Procurement.

Durable lesson: A release gate summary is not enough for a validation surface. If it can block money or fabrication, it belongs in the main issue list and must participate in counts, filters, and recovery navigation.

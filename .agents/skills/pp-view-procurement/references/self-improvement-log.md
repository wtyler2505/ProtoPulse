# Procurement Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Procurement work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Procurement behavior.

## Pending Proposals

- Add screenshots for the main Procurement states.
- Add more specific gotchas after the next real Procurement implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

## Fast Workflow Execution Report — 2026-05-23 (pp-view-procurement Full Audit Pass)

**User Command:** `/pp-view-procurement`

**Inspector (entry + final exit):** 
- Status: **ok** both times.
- Tracked tests: 117
- Main source: `client/src/components/views/ProcurementView.tsx` (547 lines noted by inspector; 470 code / 98 CCN by scc)
- All references present and valid.
- Test globs: `procurement-sub-components.test.tsx` (362 lines, 32 tests), `supplier-api.test.ts` (928 lines, 85 tests)
- No missing required files. Re-run after full discovery remained clean (no new warnings introduced).

**Exact Fast Workflow Sequence Followed (non-negotiable contract):**
1. `node .agents/skills/pp-view-procurement/scripts/inspect-procurement.mjs` → ok
2. Read `references/page-map.md` (28 lines)
3. Read `references/ux-contract.md` (24 lines) — before any user-facing or layout synthesis
4. Read `references/testing.md` (28 lines)
5. Read `references/gotchas.md` (17 lines) — before any trust/sync analysis
6. Read `SKILL.md` (full contract, auto-sync block confirming Tier 1 + exact globs)
7. Deep source inspection + structural search (ast-grep mandatory for all code patterns) + scc metrics
8. Cross-campaign synthesis against the 3D rescue, exact-part verification gates (Component Editor), generative provenance stamps, breadboard-lab health/trust, Exports precheck + TrustReceiptCard, Order PCB, Lifecycle, InventoryHealthAnalyzer, and the "last money gate" principle
9. Durable append to this log + master report section
10. Final inspector re-run (ok)

**Quantitative Snapshot (scc on full surface):**
- 42 files
- 7,896 total lines (7,008 code)
- 1,002 Complexity (CCN)
- Hotspots:
  - ProcurementView.tsx: 470 code / 98 CCN (coordinator with 16+ tabs, heavy local state, DnD, multiple live hooks)
  - OrderHistoryPanel.tsx: 524 / 41
  - PcbOrderTrackerPanel.tsx: 486 / 51
  - SupplierDrawer.tsx: 400 / 64
  - AssemblyRiskHeatmap.tsx: 387 / 64
  - AvlCompliancePanel.tsx: 353 / 40
  - BomTable.tsx: 321 / 95 (highest table logic density)
  - supplier-api/mock-data.ts, manager.ts, persistence.ts, bom-quote.ts, search.ts, pricing.ts, use-supplier-api.ts (rich real + mock distributor integration, rate limiting, caching, quote aggregation)
- This is a **Tier 1 heavy surface** (explicitly flagged in the page-skill auto-sync block).

**Source Ownership (from page-map + auto-sync):**
- `ProcurementView.tsx` + `views/procurement/**` (16+ specialized panels: BomTable/Toolbar/Settings, AssemblyGroups/Panel, CostOptimizer, RiskScorecard, ManufacturingValidator, AvlCompliance, SupplierPricing/Drawer, DamageAssessment, AlternateParts, CostSummary, OrderHistory, PcbOrderTracker, AssemblyRiskHeatmap, etc.)
- `lib/supplier-api/**` (search, pricing, bom-quote, manager, persistence, rate-limit, distributors, use-supplier-api hook, types with PartSearchResult + BomQuote + DistributorOffer + lifecycle enum)

**Deep Integration Analysis vs. Campaign Provenance / Trust / Safety Story (the critical "last money gate" test):**

- **What is present and strong:**
  - Mature supply-chain cockpit with real distributor offers (Octopart/Digi-Key/Mouser/etc. via supplier-api), pricing tiers, stockStatus, leadTime, MOQ, best-price aggregation, BOM quoting (`quoteBom`), live part search, cost optimization goals + preferred-supplier localStorage prefs, alternates, damage assessment, assembly risk heatmap, manufacturing validator (BOM-only slice), AVL compliance, risk scorecard, order history, PCB tracking, cross-project part usage, supply-chain alerts, BOM templates, personal inventory.
  - Lifecycle warnings surfaced in header (uses `classifyLifecycle` → NRND/EOL/Obsolete badges + counts). Good.
  - `pricingTrust: TrustBoundary` is carried on `BomItem` (built in bom-context.tsx using `asVerified('live_supplier_api')` vs `asUnverified('historical_estimate' + isMock)` + `normalizeTrustBoundary`). Partial trust metadata exists at the data layer.
  - DnD reordering of BOM with persistent sort order, inline editing, add-item, CSV export, filtering (search + ESD-only).
  - 16+ tab navigation in the main view — extremely rich workflow coverage.

- **The fatal gap (P0 for the entire safety campaign):**
  - **Zero consumption or surface of the upstream provenance / verification / 3D / generative / breadboard / full trust artifacts** in any tab, panel, quote flow, or checkout path.
  - Ast-grep searches across the entire procurement + supplier-api surface for `TrustReceiptCard`, `ReleaseConfidenceCard`, `provenance`, `generatedFrom`, `exactPartVerification`, `verificationReadiness`, `VaultHoverCard`, `buildWorkspaceReleaseConfidence`, `BoardViewer3D`, `View in 3D`, etc. all returned **no matches**.
  - `PartSearchResult` (supplier-api/types.ts) has only traditional `lifecycle` + offers + specs. No `verificationLevel`, `generatedFrom`, `mechanicalFit3D`, `breadboardHealth`, `trustReceipt` attachment.
  - When the user clicks "Get Quote", "Optimize Cost", or proceeds to real purchase, there is no warning, badge, or gate that says "This part has no verified 3D model", "This part was adopted from an un-reviewed generative design", "This part failed Component Editor exact-part verification", "Breadboard health for this placement is red", "Digital twin comparison shows drift", or "Workspace release confidence for the full assembly is low".
  - The `mfgPackageInput` passed to `ManufacturingValidatorPanel` is deliberately thin (empty gerbers, drill, placements, board) — only BOM entries. The real authoritative pre-fab package + full TrustReceipt lives in Exports / Order PCB. This tab is a convenience BOM-only checker, not the true last gate.
  - Result: The entire investment in 3D rescue (BoardViewer3DView + airwires + snap + WebGL recovery), Component Editor verification gates (6 tabs, exact-part vs starter), Generative `generatedFrom: 'generative-design'` stamps + adopt flow, breadboard-lab (exact-part stamping, board health, coach, "View in 3D" button), Exports precheck + TrustReceiptCard + ReleaseConfidenceCard, InventoryHealthAnalyzer (A-F grades), Lifecycle status CRUD, Digital Twin comparison — all of it is invisible and unenforceable exactly where real money leaves the building for parts.

**UX Contract Pillars Evaluation (against page-map / ux-contract / testing / gotchas):**

- **Page Behavior:** Strong operational tooling for cost, risk, sourcing, alternates, damage, AVL, assembly planning. Weak on the safety/provenance closure that the rest of the app now claims to provide. The "quote → order" happy path does not close the loop on the trust story.
- **Layout:** 16+ tabs + many dense sub-panels (BomTable 95 CCN, SupplierDrawer 64 CCN, multiple side drawers) creates high risk of UI Container Rule violations (clipped controls, fixed-height content, poor laptop viewport behavior with many panels open, focus/scroll management during DnD + live pricing). The bisect-minimal flag exists but the real surface is crowded.
- **Tests:** 117 tracked cases, excellent unit coverage on supplier-api (85 tests) and sub-components (32 tests). Coordinator view (ProcurementView) itself lightly tested at the skill level. No evidence of visual regression or full-flow E2E for the quote/checkout path with mixed verified/unverified parts. Browser checks remain essential.
- **Workflow Clarity:** Excellent for traditional procurement concerns (cost optimization, risk heatmaps, supplier preference, damage, AVL). Poor for the new "is it safe / provenance-backed / mechanically verified" dimension. A maker can happily quote and buy a part that the rest of the system would flag as high-risk.

**Cross-References to Prior Campaign Work (same handoff audit):**
- 3D View rescue (BoardViewer3DView + R3F overlay + NetAirwire3D + snapToViewAngle + WebGLContextRecovery) — the mechanical truth never reaches the parts buyer.
- Breadboard-lab + "View in 3D" button in BreadboardPartInspector (still needs parent dispatch) — placement health is invisible here.
- Component Editor (7360 LOC / 1498 CCN, 6-tab verification gauntlet, exact-part vs starter distinction, `buildExactPartVerificationReadiness`).
- Generative (provenance stamp on adopt but weak visual Trust Labels) + `generatedFrom`.
- Exports (mature ExportPrecheckPanel + TrustReceiptCard + "export anyway") and Order PCB (5-step wizard with TrustReceiptCard but DFM still legacy).
- Inventory / My Parts / Lifecycle / Part Usage — health signals exist but are not consulted at quote time.
- Dashboard as the front door that should aggregate these signals but currently does not drive procurement decisions.

**P0 / P1 / P2 Backlog Items for Codex (prioritized for the handoff):**

**P0 — Enforce provenance / verification / 3D / generative / breadboard signals at the quote, risk, and order paths (the safety story is broken until this lands)**
- Every BOM item / quote line must surface (or block on) the upstream verificationLevel, generatedFrom, 3D model presence + mechanical envelope status, breadboard health grade, and workspace release confidence.
- Add hard/soft gates in SupplierDrawer, CostOptimizer, RiskScorecard, quoteBom flow, and any real checkout: "Cannot quote unverified generative part without review", "Warning: no 3D model — physical fit unknown", "This assembly has red breadboard health — review before ordering".
- Attach or link a TrustReceipt / ReleaseConfidence summary for the full BOM before any money movement.

**P1 — Unify the Manufacturing Validator with the authoritative Exports precheck package**
- Stop passing the empty-shell `mfgPackageInput`. Consume the real validated package (gerbers + drill + placements + board + full provenance) that Exports already builds. Make the "Mfg Validator" tab here a read-only or drill-down view of the same truth used for board ordering.

**P1 — Surface rich Trust / Provenance UI consistently (VaultHoverCard, TrustReceiptCard, verification badges, 3D links) inside BomTable rows, SupplierDrawer, quote results, and risk panels**
- Match the pattern already used in Exports, Order PCB, Component Editor, Generative, and Learn.

**P1 — Address UI Container Rule risks on the 16-tab + dense-panel surface**
- Audit every tab and drawer for scroll/resize/collapse reachability on laptop viewports. The tab strip itself is already `overflow-x-auto` — good start, but sub-panels and long tables are the real risk.

**P2 — Strengthen test coverage on the coordinator flows (quote full BOM with mixed trust levels, DnD + live pricing sync, damage assessment end-to-end, optimization with preferred suppliers)**
- Add visual + a11y browser checks for the crowded tab experience.

**P2 — Continue extraction / simplification of dense subcomponents (BomTable 95 CCN, SupplierDrawer 64 CCN, etc.)** using the same neutral-primitive discipline demonstrated in Architecture + PCB extraction work.

**Strengths (relative to peers in the audit):**
- One of the most complete traditional supply-chain surfaces in the app — real distributor data, sophisticated cost/risk/assembly planning, alternates, damage, AVL, personal inventory integration.
- `pricingTrust` metadata shows the trust-boundary pattern is already partially adopted in the BOM pipeline.
- Lifecycle classification is wired and visible.
- Excellent test coverage on the supplier-api layer (85 tests) and sub-panels.
- The tab explosion actually delivers real workflow value (not just UI bloat).

**Durable Lessons for Future Agents:**
- "Last money gate" is not a slogan. If the provenance, 3D, exact-part, generative, and breadboard signals are not visible and enforceable in Procurement (and Order PCB), every upstream safety UI is theater. The money still leaves the building for unverified parts.
- Partial trust metadata (pricingTrust) is necessary but not sufficient. The full multi-dimensional trust receipt (mechanical + electrical + provenance + health) must be first-class in the data model and first-class in the UI at the point of commitment.
- A 16-tab procurement cockpit is powerful but creates exactly the UI Container Rule and discoverability problems the campaign has been auditing everywhere else. Density must be paired with progressive disclosure and reachability guarantees.
- The supplier-api types and BomQuote structures are the natural place to extend with provenance attachments — do it before more real distributor integrations harden the current shape.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 117 tests).
- Full ast-grep searches for all campaign provenance signals returned zero matches.
- scc report captured above with exact file hotspots.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).
- All findings cross-referenced to the 3D rescue, breadboard-lab, Component Editor, Generative, Exports, Order PCB, and provenance work from the identical handoff campaign.
- Ready for Codex to close the last money gate.

---

*Procurement analysis complete. This is the surface where real external money is spent on parts. The traditional supply-chain tooling is mature and valuable, but the safety/provenance story built everywhere else in the app is completely absent here. Closing this gap is the single highest-leverage item for making the "trust" claims real. The data model (PartSearchResult, BomItem) and the quote/checkout flows are the precise places the upstream signals must be injected and enforced. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Procurement section (2026-05-23).*

## Implementation Note — 2026-05-26 (R61 Procurement Money Gate)

- Procurement now builds a `procurement-package` precheck from the active circuit, component parts, BOM, shortfall data, and shared validation safety-gate signals.
- The main BOM management surface shows a compact Procurement Safety Gate and blocks CSV export when hard blockers exist.
- The live-pricing panel receives the same blocker/warning counts and disables whole-BOM quoting when upstream trust is incomplete.
- Supplier mock or fallback pricing now bubbles to quote items and is rendered with estimated trust badges/disclaimers.
- Test isolation in `supplier-api.test.ts` must clear the real `window.localStorage`; stubbing only `globalThis.localStorage` misses the browser test environment.
- Verification for this slice included focused tests, `npm run check`, API type check, page-skill checks, production build, Procurement route/a11y/keyboard browser checks, and a laptop-height screenshot at `logs/r61-procurement-safety-gate-laptop.png`.

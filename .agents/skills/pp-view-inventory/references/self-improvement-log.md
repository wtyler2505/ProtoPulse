# Inventory Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Inventory work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Inventory behavior.

## Pending Proposals

- Add screenshots for the main Inventory states.
- Add more specific gotchas after the next real Inventory implementation pass.
- Expand per-part provenance badges after the shared gate is in place.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-inventory)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-inventory/scripts/inspect-inventory.mjs` → **Status: ok** (StorageManagerPanel.tsx 994 lines / 116 CCN, 9 tracked tests in storage-manager.test.tsx).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep analysis:
   - scc: 876 code / 116 CCN (moderate — CRUD + health analyzer + barcode/QR physical storage UX).
   - Full structural read of `StorageManagerPanel.tsx` (BOM integration via useBom, InventoryHealthAnalyzer with A-F grades/factors/issues/recommendations, barcode scanner + QR label generation for physical bins, stock status (ok/low/critical/untracked), search/filter, health dashboard with collapsible details).
   - Helper mappings: bomToInventoryItem, bomToLabelItem; getStockStatus + badge helpers.
   - Cross-referenced entire campaign (BOM shortfalls BL-0150 in Exports precheck, breadboard-lab exact-part provenance + "local stock vs community", Component Editor exact-part verification, 3D mechanical, Generative output, Digital Twin, Dashboard health, Audit Trail).
4. Grepped for provenance/trust signals on saved parts, links to 3D/breadboard/generative, recovery flows.
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (Inventory / Local Storage / Saved Parts / Data Recovery):**

- **Excellent local inventory + physical storage UX + health dashboard (major strength):** Deep BOM integration, sophisticated `InventoryHealthAnalyzer` (overall grade A-F, per-factor bars, issues with severity, prioritized recommendations), barcode scanning for data entry/recovery, QR label printing for real bin labels. Stock status badges are clear. The "Inventory Health" card with gauge and "Details" toggle makes "Data Recovery" and "Inventory is visible" concrete and actionable. This directly powers Exports pre-flight (BL-0150 shortfall warnings) and breadboard exact-part decisions.

- **"Saved Parts" / local catalog provenance is thin (P1 gap):** The panel treats BomItem stock levels, but there is no visible trust/verification level per saved part (e.g., "this is a verified exact part from Component Editor" vs generic local stock vs community-sourced). AI-generated parts from the Generative view are not specially flagged in inventory. The "AI-generated or uncertain data is clearly marked" contract is not yet reflected here.

- **No visible links to 3D / breadboard / generative state (P1 gap after the 3D + breadboard + generative campaigns):** 
  - No indication which local parts have verified 3D models / mechanical envelopes.
  - No "used on breadboard" history or "bench stock" vs "main inventory" distinction.
  - No tie-in to generative proposals that were adopted (even though they carry `generatedFrom` stamps elsewhere).
  - "Saved Parts" feels like a flat BOM stock list rather than a rich local catalog that participates in the full provenance story.

- **Data Recovery is strong for physical bins (barcode/QR) but weak for design state recovery:** Excellent tools for recovering/updating physical stock via scanning and labels. However, there is no obvious "restore inventory snapshot" or integration with the Design History / Audit Trail for recovering lost stock data or provenance.

- **Panel size (994 lines) with health + scanner + label generation is dense:** Low-to-moderate complexity density, but the combination of health analyzer, physical I/O, and list management creates risk of scroll traps or container issues on laptop viewports (per UI Container Rule and gotchas). The health details panel is collapsible (good), but the overall surface must be checked.

- **9 tests recorded (reasonable but must cover health + recovery paths):** The test file exists; the skill has 9 tracked cases. Per the gotchas, passing lib tests do not prove the health dashboard, scanner integration, or label printing behave correctly in the browser under real BOM data.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Surface provenance/trust level on every saved part (directly serves the campaign identity)**
- Add trust/verification badges or columns (e.g., "Verified Exact Part", "Generative Origin", "Community-sourced", "Local unverified") pulled from Component Editor / generative stamps.
- Make uncertain/AI-generated stock visually distinct (consistent with VaultHoverCard / TrustReceiptCard patterns used in Exports, Component Editor, Generative, etc.).

**P1 — Bridge Inventory to 3D / breadboard / generative (make "Saved Parts" participate in the full system)**
- Show which local parts have associated 3D models / mechanical envelopes (link to Component Editor or 3D View).
- Indicate bench usage or "reserved for current breadboard" status.
- On adoption of a generative candidate, offer to create/update inventory entries with appropriate provenance flags.

**P1 — Strengthen Data Recovery for design/provenance state (beyond physical bins)**
- Add inventory snapshots or integration with Design History / Audit Trail so lost stock levels + provenance can be recovered/audited.
- Provide "reconcile with project" or "import from breadboard/3D" recovery flows.

**P2 — Polish the dense health + physical UX surface**
- Ensure the health details, scanner controls, label preview, and parts list all respect the UI Container Rule on laptop viewports (no fixed-height traps, proper scrolling, reachable controls).
- Add or expand tests that exercise the health analyzer output and recovery paths under realistic shortfall + provenance data.

**Strengths (relative to peers):**
- One of the best "physical + digital inventory" experiences analyzed — barcode/QR for real bins + sophisticated health analyzer with actionable recs.
- Deep, live integration with BOM shortfalls (directly used in Exports precheck BL-0150).
- Health dashboard (grade, factors, issues, prioritized recommendations) makes "Data Recovery" and "Inventory is visible" genuinely useful, not just a list.
- Stock status logic and visual badges are clear and practical.

**Cross-Cutting Value (very high):**
- This is the "local truth" for parts that powers BOM shortfalls in Exports, exact-part vs starter decisions in breadboard-lab, procurement, and physical data recovery.
- It must carry and prominently surface the same provenance/trust signals (exact-part verification, generative origin, community vs local) that the rest of the system now enforces, or the safety story has a hole at the inventory layer.

**Durable Lesson:**
A rich local inventory manager with excellent physical tooling (barcode/QR) and a sophisticated health analyzer can still leave "Saved Parts" provenance invisible if it does not pull and display verification status, generative origin, 3D model presence, or bench usage from the Component Editor, Generative, 3D View, and breadboard surfaces. The UX contract requires "Saved Parts" and "Data Recovery" to be visible with uncertainty clearly marked — after the provenance campaign, inventory must become a first-class consumer and producer of those signals.

**Recommended for Codex (immediate high-ROI tasks):**
1. Extend the parts list and health views to show trust/verification badges and generative provenance for each saved part (pull from Component Editor / generative stamps).
2. Add links or indicators for parts that have verified 3D models / mechanical data and/or are currently placed on breadboard.
3. Add inventory snapshot / reconciliation features tied to Design History and Audit Trail for design-state recovery.
4. Ensure the combined health dashboard + scanner + list surface respects the UI Container Rule on laptop viewports; run the full browser checklist.
5. Expand tests to cover health recommendations under mixed provenance + shortfall data and recovery flows.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc numbers, exact health analyzer integration, provenance gaps, physical recovery strengths, and cross-references to BOM shortfalls (Exports), breadboard-lab exact parts, Component Editor verification, Generative stamping, 3D, Digital Twin, Audit Trail, and Dashboard.
- No production code mutated during discovery.
- All findings tied directly to the provenance/trust, exact-part, 3D mechanical, and board health work from the same handoff campaign.

---

*Inventory analysis complete. Excellent local stock + physical tooling + health dashboard; provenance/trust labels and bridges to 3D/breadboard/generative are the clear gaps. This is the "local truth" layer that must carry the full safety story. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Inventory section (2026-05-23).*

---

## 2026-05-24 — R10 Inventory Confidence Gate

- Added a visible Inventory Confidence Gate to `StorageManagerPanel.tsx`.
- Added shared `inventory-review` precheck coverage for inventory lines, part numbers, estimated/unknown confidence, and BOM demand shortfalls.
- Label printing is blocked only for hard blockers such as no inventory lines; warning-only states remain actionable.
- Focused tests now cover Inventory gate Ready, Review, and Blocked states plus the shared `inventory-review` profile.

---

## 2026-05-26 — R63 Per-Row Provenance Markers

- Kept the shared Inventory Confidence Gate as the top-level money-gate signal.
- Added row-level saved-part markers for exact-part verification, AI/generated origin, estimated quantity confidence, verified 3D/mechanical readiness, and local-unverified fallback state.
- The markers intentionally read metadata defensively from current and future BOM row shapes instead of requiring a schema migration in the Inventory panel.

**Durable lesson:**
Inventory cannot just be a stock-count table after the trust campaign. Each saved part needs a visible provenance state, even when the state is "local unverified", because procurement, labels, breadboard selection, 3D fit, and recovery flows all depend on whether the stock line can be trusted.

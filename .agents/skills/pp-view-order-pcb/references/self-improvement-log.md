# Order PCB Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Order PCB work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Order PCB behavior.

## Pending Proposals

- Add screenshots for the main Order PCB states.
- Add more specific gotchas after the next real Order PCB implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-order-pcb)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-order-pcb/scripts/inspect-order-pcb.mjs` → **Status: ok** (PcbOrderingView.tsx 997 lines / ~83 CCN from similar large panels, 0 tracked tests).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep analysis:
   - scc on the view (large step-based wizard with board specs, fab selection, DFM, quotes, summary).
   - Full structural read of `PcbOrderingView.tsx` (5-step wizard: Board Specs → Select Fab → DFM Check → Quotes → Summary; uses `usePcbOrdering`, `runDfmCheck`; renders `ReleaseConfidenceCard` + `TrustReceiptCard` + `buildOrderingTrustReceipt` + `buildWorkspaceReleaseConfidence`; pulls from Architecture, BOM, Validation; has `VaultInfoIcon` and `FabApiSettings`).
   - DFM is still mostly classic board-spec/DFM checks (not yet consuming 3D mechanical, exact-part verification, breadboard health, generative provenance, lifecycle per part, inventory confidence, digital twin).
   - Trust/receipt primitives are present and rendered — the right hooks exist.
   - Cross-referenced entire campaign (Exports "Complete Fab Package" and precheck, Lifecycle status, Inventory health/shortfalls, Component Editor exact-part verification + 3D models, breadboard-lab provenance + coach + exact parts, 3D View mechanical/airwires, Generative `generatedFrom`, Digital Twin comparison, History/Audit Trail, Left Sidebar health, Dashboard, Learn source quality).
4. Grepped for DFM depth, trust receipt contents, AI/uncertain data handling, links to 3D/breadboard/generative/lifecycle/inventory.
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (PCB Order Flow / Fab Checks / Cost/Shipping / Final Review):**

- **Mature step-based ordering wizard with the right provenance hooks (strength):** 5-step flow with board specs, fab selection (multiple fabricators with API settings), DFM results (pass/fail with issues), quote comparison, and summary. It correctly renders `ReleaseConfidenceCard` + `TrustReceiptCard` and builds `buildOrderingTrustReceipt` + `buildWorkspaceReleaseConfidence` from BOM/validation/architecture data. This is the right architectural place for the final "Fab Checks" and "Final Review" with provenance visibility.

- **Fab Checks / DFM are still mostly legacy board-spec (P1 gap after the full campaign):** The DFM (`runDfmCheck`) operates on `BoardSpecification` (classic Gerber/DFM rules for the selected fab). It does **not yet** enforce or display the rich upstream safety/provenance work:
  - No checks for verified exact parts vs unverified community parts.
  - No 3D mechanical / enclosure fit / airwire clearance from the hardened BoardViewer3DView.
  - No breadboard health / coach warnings or exact-part placement provenance.
  - No generative origin (`generatedFrom`) or verification status on parts in the BOM.
  - No lifecycle status (EOL/obsolete parts should be blocked or strongly warned).
  - No inventory/personal stock confidence or shortfall signals.
  - No digital twin / sim-vs-actual validation results.
  The "AI-generated or uncertain data is clearly marked" contract is only partially served by the generic release confidence card; the specific per-part provenance is not yet in the DFM or final review.

- **"Final Review" has the trust cards but the data is incomplete (P1 gap):** The trust/receipt cards are rendered (good), but they are fed only the classic architecture/BOM/validation signals (same as Exports). The full campaign's signals (3D, exact-part verification, breadboard provenance, generative, lifecycle, inventory, digital twin) are not yet aggregated into the ordering trust receipt or DFM.

- **Cost/Shipping and Fab selection are present and practical:** Multiple fabricators, quote comparison, API settings — this part of the flow is mature.

- **0 tests recorded (notable gap for the final money-spending gate):** The skill records zero tests. Per the gotchas, this increases risk for the DFM, quote, and final review flows where all the safety signals must be enforced.

- **Large wizard (997 lines) with the right structure:** Step state, DFM results, quote comparison, trust cards — the bones are excellent. The gap is data depth, not UI structure.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Enrich DFM Checks and Ordering Trust Receipt with the full provenance/safety signals from the campaign (highest-ROI for "ship with confidence")**
- Extend `BoardSpecification` / DFM inputs and `buildOrderingTrustReceipt` to include:
  - % or list of verified exact parts vs unverified (from Component Editor)
  - 3D mechanical / enclosure fit / clearance status (from BoardViewer3DView + Component Editor)
  - Breadboard health / coach score / exact-part placement provenance
  - Generative origin count + verification status on adopted parts
  - Lifecycle status summary (any EOL/obsolete in the design?)
  - Inventory / personal stock confidence and shortfall signals
  - Digital twin comparison health (if a twin exists for this design)
- Block or strongly warn on "Final Review" / before quote/ordering if critical provenance signals are missing (e.g., unverified generative parts, no 3D mechanical for enclosure designs, EOL parts, poor breadboard health).

**P1 — Make "AI-generated or uncertain data" explicitly visible and actionable in the final review**
- In the Summary / Final Review step, surface a clear "Provenance Summary" section (or enhance the existing TrustReceiptCard) that lists:
  - Number/percentage of parts with full verification + source evidence
  - Generative-adopted parts (with link to candidate and verification status)
  - Parts with 3D mechanical data vs missing
  - Breadboard vs schematic-only provenance
- Provide one-click actions: "Go verify these parts in Component Editor", "Preview in 3D", "Run breadboard coach", "Open Digital Twin".

**P2 — Add automated pre-order checklist that aggregates all upstream readiness**
- Before allowing the user to proceed to "Quotes" or "Place Order", run a composite "Fab Readiness" check that includes the classic DFM + the new provenance/safety signals above, with clear pass/warn/fail and "go fix" links back to the relevant view (3D, Component Editor, Breadboard, Lifecycle, Inventory, Generative, etc.).

**P2 — Test coverage for the final gate**
- Record test globs in the skill and add coverage for DFM results, trust receipt contents, provenance summary, and blocking/warning behavior on poor provenance signals.

**Strengths (relative to peers):**
- Excellent step-based ordering wizard structure with the right provenance primitives already wired in (`TrustReceiptCard`, `ReleaseConfidenceCard`, `buildOrderingTrustReceipt`).
- Practical fab selection, DFM results display, quote comparison, and API settings.
- Uses the same trust/release confidence system as Exports — consistency is there.
- `VaultInfoIcon` and teaching affordances are present.

**Cross-Cutting Value (highest in the entire campaign):**
- This is the **final money-spending gate** — the one place where all the safety, provenance, 3D mechanical, exact-part, breadboard health, generative, lifecycle, inventory, and digital twin work must be visible, enforced, and actionable before the user can place a real fabrication order.
- If this view does not consume and display the full upstream campaign, the "ship with confidence" promise is broken at the last step.

**Durable Lesson:**
A beautiful step-based ordering wizard that already renders `TrustReceiptCard` and `ReleaseConfidenceCard` has done the UI and hook work correctly. The remaining work is data depth: feeding the DFM and the ordering trust receipt with the rich provenance, 3D mechanical, exact-part verification, breadboard health, generative origin, lifecycle, inventory, and digital twin signals built throughout the rest of the system. The final handoff surface must be the place where "AI-generated or uncertain data" is not just marked but actively blocked or strongly warned before money is spent.

**Recommended for Codex (immediate high-ROI tasks):**
1. Extend the DFM inputs and `buildOrderingTrustReceipt` to consume the full provenance/safety signals (exact-part verification %, 3D mechanical status, breadboard health/provenance, generative origin + verification, lifecycle summary, inventory confidence, digital twin health).
2. In the Final Review / Summary step, add a clear "Provenance & Safety Summary" (or enrich the existing trust card) that lists the above with "go fix" deep links to the relevant views.
3. Add blocking/warning logic before quotes or order placement for critical gaps (unverified generative parts, missing 3D mechanical for enclosure designs, EOL parts, poor breadboard health, etc.).
4. Add automated "Fab Readiness Checklist" that aggregates classic DFM + the new signals above.
5. Record tests in the skill and add coverage for the enriched trust receipt, provenance summary, and blocking behavior.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc, exact DFM scope (legacy board-spec), trust hook presence vs data depth gap, and cross-references to Exports, Lifecycle, Inventory, Component Editor, 3D View, breadboard-lab, Generative, Digital Twin, History, Audit Trail, Left Sidebar, Dashboard, and all provenance work from the same handoff campaign.
- No production code mutated during discovery.
- All findings tied directly to the "ship with confidence" / fab handoff / provenance / 3D mechanical / exact-part / breadboard health story built throughout the entire audit.

---

*Order PCB analysis complete. Mature step-based wizard with the right trust/receipt hooks already in place, but the DFM and final review are still mostly legacy board-spec checks — the rich provenance, 3D mechanical, exact-part, breadboard, generative, lifecycle, inventory, and digital twin signals from the campaign are not yet consumed or displayed. This is the final money gate where everything must be visible and enforced. The UI bones are excellent; the data depth is the gap. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Order PCB section (2026-05-23).*

## R23 Keyboard Lesson

Board-spec numeric fields are money-gate controls, so visible labels are not enough for this suite. Keep explicit `aria-label` values on `spec-quantity`, `spec-width`, and `spec-height` to preserve keyboard/a11y proof before fabrication actions.

## Implementation Note - 2026-05-26 R60

- Order PCB now feeds the same fab-package trust precheck used by Exports into the visible ordering safety gate and the ordering trust receipt.
- `buildOrderingTrustReceipt()` can report fabrication safety blockers/warnings and returns `Safety blocked` when upstream trust fails even if DFM and quotes are otherwise available.
- Place Order remains disabled when the fabrication safety gate has blockers.
- Verification: focused Order PCB view + trust receipt Vitest suite passed 27 tests before broader checks.

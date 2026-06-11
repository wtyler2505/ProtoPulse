# Lifecycle Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Lifecycle work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Lifecycle behavior.

## Pending Proposals

- Add screenshots for the main Lifecycle states.
- Add browser screenshots for Lifecycle release-gate blocked/review/ready states.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-24 — R9 Lifecycle Release Gate Implementation

- Added the first dedicated Lifecycle dashboard test file:
  - `client/src/components/views/__tests__/LifecycleDashboard.test.tsx`
- Added a shared `lifecycle-review` export precheck profile so the page consumes the same lifecycle-risk rule shape as Exports, Procurement, BOM Templates, and Supply Chain.
- The dashboard now shows a visible Lifecycle Release Gate and disables CSV export when hard lifecycle blockers exist.
- Durable rule: EOL or obsolete parts without known alternates are hard blockers; EOL/NRND parts with alternates are review warnings.
- Keep this skill's test references current when lifecycle-risk gate behavior changes.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-lifecycle)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-lifecycle/scripts/inspect-lifecycle.mjs` → **Status: ok** (LifecycleDashboard.tsx 861 lines / 83 CCN, 0 tracked tests).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep analysis:
   - scc: 804 code / 83 CCN (moderate — large aggregator table + filters + dialog for component lifecycle CRUD).
   - Full structural read of `LifecycleDashboard.tsx` (status model active/NRND/EOL/obsolete/unknown with color config, search + statusFilter, counts per status, table of ComponentLifecycle records, dialog for editing, sort, history of changes via updatedAt).
   - Data from `@shared/schema` ComponentLifecycle; integrates with BOM/Inventory/Exports (fab handoff readiness), Component Editor (part creation), provenance (lifecycle status as trust signal).
   - Cross-referenced entire campaign (Exports "Complete Fab Package" and precheck, Inventory health/shortfalls, Component Editor exact-part verification, breadboard-lab exact parts, Left Sidebar health indicators, Dashboard project health, History/Audit Trail, Generative output, Digital Twin, Learn source quality).
4. Grepped for project-level vs component-level lifecycle, history depth, provenance on lifecycle changes, links to 3D/breadboard/generative.
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (Project Lifecycle / Maturity Stages / Readiness / History):**

- **Focused, practical component lifecycle management surface (strength):** Clear status model (active → NRND → EOL → obsolete), visual badges, counts, search/filter, editable table, and dialog. Directly supports "Maturity Stages" and "Readiness" for individual parts heading into fab/export (critical for Exports "Fab Handoff" and Inventory "Saved Parts" trust). "History" is present via updatedAt and change tracking in the records.

- **"Project Lifecycle" vs "Component Lifecycle" scope is component-centric (P1 clarification needed):** The view is named LifecycleDashboard and the contract talks about "Project Lifecycle," but the data and UI are per-ComponentLifecycle records. It does not appear to aggregate into a higher-level project maturity/readiness score (e.g., "overall project is 70% ready for first fab run" combining architecture completeness, BOM coverage, verified exact parts, 3D mechanical, breadboard health, generative provenance, etc.). This may be intentional (component-level only) or a gap vs the contract's "Project Lifecycle" pillar.

- **Provenance / uncertainty marking on lifecycle changes is thin (P1 gap):** The contract requires "AI-generated or uncertain data is clearly marked." Lifecycle status changes (especially for generative-adopted parts or community-sourced exact parts) should carry or display provenance (who changed it, linked to generative candidate, verification status, source evidence). Currently it looks like standard CRUD with updatedAt — no visible link to the rich provenance system built elsewhere (Component Editor verification, Generative `generatedFrom`, breadboard-lab exact-part provenance).

- **No visible integration with 3D / breadboard / generative state (P1 gap):** A part's lifecycle status should influence or be influenced by:
  - Whether it has verified 3D models / mechanical envelopes (Component Editor + 3D View)
  - Whether it is placed and verified on breadboard (breadboard-lab)
  - Whether it came from generative design (Generative view)
  - Current stock / shortfall in Inventory
  No such signals or actions are visible in the dashboard.

- **"Readiness" and "History" are present but could be richer for fab handoff:** The view helps decide "is this part ready to ship?" (lifecycle status), and has history. But for the full "Fab Handoff" story (Exports), it should be one of the primary sources for trust receipts and precheck warnings (e.g., "EOL part in BOM — replace before generating Complete Fab Package").

- **0 tests recorded (notable gap for a readiness surface):** The skill records zero tests. Per the gotchas, this increases risk for filters, dialog state, and any future aggregation logic.

- **Large aggregator (861 lines) with low density (good sign):** Mostly table + filters + dialog wiring. The complexity lives in the data model and downstream consumers (Exports, Inventory, breadboard exact-part decisions).

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Clarify and (if needed) expand scope from Component Lifecycle to Project Lifecycle / Readiness aggregate (contract pillar)**
- Decide whether this view is intentionally component-only or should become the aggregator for overall project maturity/readiness (architecture completeness + BOM coverage + verified exact parts % + 3D mechanical coverage + breadboard health + generative provenance + inventory health + export readiness).
- If the latter, surface a high-level "Project Readiness Score" or lifecycle stage that feeds the Dashboard and Left Sidebar health indicators.

**P1 — Surface provenance on lifecycle records and changes (directly serves the provenance identity)**
- Show/edit provenance metadata on each ComponentLifecycle record (source: generative / manual / community / verified exact part, linked candidate/verification ID, trust level).
- When lifecycle status changes for a generative-adopted or unverified part, make the provenance visible in the table and history.

**P1 — Wire Lifecycle status into Exports / Inventory / Breadboard / 3D readiness flows**
- Make lifecycle status a first-class input to Exports precheck (warn/block on EOL/obsolete in BOM or fab package).
- Surface in Inventory health and breadboard coach ("this placed part is NRND — consider replacement").
- Link from Component Editor when editing a part's lifecycle.

**P2 — Enrich History view inside the dashboard**
- If not already rich, make the per-record history show who changed status, why (linked design snapshot or lab result), and provenance context.

**P2 — Test coverage**
- Record test globs in the skill and add coverage for filters, status transitions, provenance display, and (once implemented) project-level aggregation.

**Strengths (relative to peers):**
- Clean, focused component lifecycle status management with good visual model (active/NRND/EOL/obsolete with colors/icons) and practical editing flow.
- Directly supports critical fab/export readiness decisions.
- Low complexity density for its size — mostly declarative table + dialog wiring.

**Cross-Cutting Value (very high):**
- This is the "part maturity / readiness" layer that must feed Exports fab handoff, Inventory health, breadboard exact-part decisions, provenance trust receipts, and project-level health dashboards.
- It is one of the key places where the safety/provenance story (verification status, generative origin, lifecycle stage) becomes actionable for "can I ship this?"

**Durable Lesson:**
A dedicated component lifecycle dashboard with clear status stages is necessary but not sufficient for the "Project Lifecycle" and "Readiness" pillars if it remains isolated from the richer provenance, 3D mechanical, breadboard health, and generative systems built elsewhere. Lifecycle status changes for AI-generated or unverified parts must carry and display provenance, and the view should either aggregate into a project-level readiness score or be explicitly scoped while another surface (Dashboard or a new Project Readiness aggregator) owns the higher-level view.

**Recommended for Codex (immediate high-ROI tasks):**
1. Decide and document whether this view owns "Project Lifecycle / Readiness" aggregation or is intentionally component-only; if the former, add a high-level project readiness score/lifecycle stage.
2. Add provenance metadata to ComponentLifecycle records and display it in the table/history (source, linked generative candidate or verification, trust level).
3. Wire lifecycle status into Exports precheck, Inventory health, breadboard coach, and Component Editor flows.
4. Enrich per-record history with provenance context and links to design snapshots or lab results.
5. Record tests in the skill and add coverage for status transitions, provenance display, and aggregation (once implemented).

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc, exact component-centric scope, provenance gaps, integration opportunities with Exports/Inventory/breadboard/3D/Generative, and cross-references to the full provenance, health, and fab handoff campaign.
- No production code mutated during discovery.
- All findings tied directly to the provenance/trust, exact-part, 3D mechanical, breadboard-lab, Exports, Inventory, and Dashboard work from the same handoff audit.

---

*Lifecycle analysis complete. Clean, focused component lifecycle status management that directly supports fab/export readiness, but scope is component-centric (not yet a full "Project Lifecycle" aggregator), provenance on lifecycle changes is thin, and integration with 3D/breadboard/generative provenance is missing. This is a key readiness surface that must carry the safety story into Exports and project health. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Lifecycle section (2026-05-23).*

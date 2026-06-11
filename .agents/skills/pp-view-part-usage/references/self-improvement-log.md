# Part Usage Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Part Usage work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Part Usage behavior.

## Pending Proposals

- Add screenshots for the main Part Usage states.
- Add more specific gotchas after the next real Part Usage implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-part-usage)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-part-usage/scripts/inspect-part-usage.mjs` → **Status: ok** (PartUsageBrowserView.tsx 153 lines / 28 CCN, 0 tracked tests — lightweight cross-project usage browser).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep analysis:
   - scc: 145 code / 28 CCN (light — aggregated usage list + lazy per-project drill-down via Collapsible + usePartUsage).
   - Full read of `PartUsageBrowserView.tsx` (high-level "Cross-Project Usage" list via useUsageBrowse showing projectCount, totalQuantityNeeded, totalPlacements; expandable UsageRow that lazy-loads per-project breakdown (projectName, stock needed vs on hand, placementCount) using usePartUsage; grouped display with ScrollArea).
   - Uses `useUsageBrowse` and `usePartUsage` from `@/lib/parts/use-*`.
   - Cross-referenced entire campaign (LifecycleDashboard for part status, Component Editor exact-part verification, breadboard-lab placements + provenance, 3D mechanical usage, Generative output, Inventory/My Parts stock, Exports/ Order PCB fab impact, History/Audit Trail of changes, Left Sidebar health, Dashboard project health, provenance/trust story).
4. Grepped for lifecycle status display, provenance/trust badges on usage rows, 3D/breadboard-specific impact, actionability (bulk replace, flag for review), links to generative origin.
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (Where Used Data / Usage Impact / Project Links / Part Lifecycle):**

- **Clean, effective cross-project usage browser (strength):** Excellent high-level view of "which parts are used across many projects" with project count, total quantity needed, and total placements. Expandable rows provide per-project drill-down (stock needed vs on hand, placement count). This directly serves "Where Used Data," "Usage Impact," and "Project Links." The lazy-loading via Collapsible + usePartUsage when expanded is a good UX pattern for performance.

- **"Part Lifecycle" pillar is completely missing (direct P1 contract violation):** The UX contract explicitly requires "Part Lifecycle is visible enough." The current implementation has **zero** lifecycle status, maturity stage, or EOL/obsolete warnings on the usage rows or in the drill-down. A part that is heavily used (high projectCount + placements) but has gone NRND or EOL in the Lifecycle view is not flagged here. This is a critical gap for impact analysis ("this part I'm about to obsolete is used in 12 projects — here's the blast radius").

- **Provenance / "AI-generated or uncertain data" is not marked on usage (P1 gap):** When a generative-adopted part or an unverified community-sourced exact part is used across many projects, the usage browser does not surface its origin or verification status. The contract requires uncertain data to be clearly marked. A user looking at high-usage parts has no way to see "these 7 projects are all using the same unverified generative part."

- **No 3D / breadboard-specific impact or actionability (P1 gap):** The drill-down shows generic "placements" and stock numbers, but does not break down:
  - How many placements are on breadboard vs schematic-only.
  - Whether the parts have verified 3D mechanical models / enclosure fit.
  - Direct links to open the breadboard or 3D view filtered to usages of this part.
  - "Bulk replace this part across all projects" or "flag all usages for review because lifecycle changed" actions.

- **No integration with Lifecycle / Component Editor / Generative changes (P1 gap):** When a part's lifecycle status changes in the Lifecycle view, or a generative part is adopted and then used, or an exact part's verification status changes in Component Editor, there is no visible propagation or notification in the Part Usage browser. The "impact" is computed but not connected to the events that should trigger review.

- **0 tests recorded (notable gap for an impact analysis surface):** The skill records zero tests. Per the gotchas, this increases risk for the lazy-loading drill-down, aggregation correctness, and any future provenance/lifecycle display.

- **Low complexity, clean code (positive):** 28 CCN on 145 LOC — deliberately thin and focused. Good use of Collapsible for progressive disclosure and lazy data loading. The UI follows the "keep text inside its container" and ScrollArea principles.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Surface Part Lifecycle status and impact on usage rows (direct contract violation)**
- Add lifecycle status badges (active/NRND/EOL/obsolete) to every UsageRow and in the per-project drill-down.
- When a part has poor lifecycle status (NRND/EOL/obsolete) and high usage (many projects or placements), make it visually prominent (warning color, "High Impact — Lifecycle Change" badge).
- Link to the Lifecycle view for that part with "change status" or "find replacement" actions.

**P1 — Add provenance / uncertainty markers on usage rows (AI-generated / unverified / community-sourced)**
- Pull and display verification status and origin (generative candidate link, exact-part verification level, source evidence) on the high-level rows and in the drill-down.
- Flag high-usage parts that have uncertain provenance ("This part used in 9 projects has pending verification — review before fab").

**P1 — Add 3D / breadboard-specific impact and direct navigation**
- Break down placements into "breadboard placements" vs "schematic only" and "has verified 3D model" vs "missing mechanical data."
- Provide one-click actions: "Open all breadboards using this part", "Preview mechanical fit in 3D for all usages", "Find replacement part with full 3D + verified status."

**P1 — Wire change events from Lifecycle / Component Editor / Generative into usage impact visibility**
- When a part's lifecycle or verification status changes, surface those parts at the top of the usage browser with "Recently Changed — Review Impact" callouts and links to the affected projects.

**P2 — Add actionability for bulk impact (replace, flag, notify)**
- "Bulk replace this part across all projects" (with provenance-preserving migration).
- "Flag all usages of this part for review" (creates tasks or audit entries).
- Export usage impact report (for fab handoff or supplier negotiation).

**P2 — Test coverage for aggregation, lazy drill-down, and (once implemented) lifecycle/provenance display**
- Record test globs in the skill and add coverage for useUsageBrowse aggregation, usePartUsage per-project data, and the new lifecycle/provenance UI.

**Strengths (relative to peers):**
- Clean, focused "where used" browser with good progressive disclosure (high-level aggregated list + lazy per-project drill-down on expand).
- Practical metrics (project count, total quantity needed, total placements) that directly answer "what is the blast radius of changing this part?"
- Lightweight and performant (lazy loading only when the user expands a row).
- Good separation from the per-project Inventory views — this is the portfolio-level impact view.

**Cross-Cutting Value (extremely high):**
- This is the **impact analysis / blast radius** layer that makes the Lifecycle view, Component Editor verification changes, Generative adoptions, and Inventory stock decisions actionable across the entire project portfolio.
- When a part goes EOL or its verification status changes, this view should be the first place a user goes to understand "which projects, breadboards, and 3D assemblies are affected and how much work is required to mitigate."
- It is one of the primary consumers that should make the entire provenance and safety story (verification, generative origin, lifecycle, breadboard/3D usage) visible at the "what parts are used where and with what risk?" level.

**Durable Lesson:**
A clean where-used browser that shows project counts, quantities, and placements can still leave the most important "impact" questions unanswered if it does not surface Part Lifecycle status and provenance/uncertainty on the high-usage parts. The contract requires both "Usage Impact" and "Part Lifecycle" to be visible — after the Lifecycle, Component Editor verification, Generative, and breadboard-lab campaigns, the usage browser must become the place where users see the combined risk (heavily used + EOL + unverified generative part = high priority for replacement).

**Recommended for Codex (immediate high-ROI tasks):**
1. Add Part Lifecycle status badges (active/NRND/EOL/obsolete) to every UsageRow and in the per-project drill-down; visually highlight high-usage + poor lifecycle combinations.
2. Add provenance / uncertainty markers (generative origin, exact-part verification status, source confidence) on usage rows using existing VaultHoverCard / TrustReceiptCard patterns.
3. Break down placements and add direct navigation to breadboard and 3D usages ("Open breadboards using this part", "Preview 3D mechanical fit for all placements").
4. Wire change events from Lifecycle / Component Editor / Generative so affected high-usage parts surface with "Recently Changed — Review Impact" callouts.
5. Add actionability (bulk replace, flag for review, export impact report) and record tests in the skill for the new lifecycle/provenance/impact UI.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc (28 CCN), exact missing lifecycle and provenance UI on usage rows, integration opportunities with Lifecycle/Component Editor/Generative/breadboard/3D/Exports, and cross-references to the full provenance/trust, exact-part, breadboard-lab, Lifecycle, Inventory, Exports, Order PCB, and health work from the same handoff campaign.
- No production code mutated during discovery.
- All findings tied directly to the provenance/trust, Lifecycle, Component Editor, Generative, breadboard-lab, 3D, Exports, Order PCB, and impact analysis work from the same handoff audit.

---

*Part Usage analysis complete. Clean, effective cross-project where-used browser with good lazy drill-down and practical impact metrics (projects, quantity, placements), but "Part Lifecycle" and provenance/uncertainty markers are completely missing from the usage rows. This is the blast-radius view that should make Lifecycle changes, Generative output, and verification status actionable at the portfolio level — currently the most important risk signals (heavily used + EOL + unverified) are invisible. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Part Usage section (2026-05-23).*

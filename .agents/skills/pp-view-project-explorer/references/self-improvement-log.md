# Project Explorer Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Project Explorer work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Project Explorer behavior.

## Pending Proposals

- Add screenshots for the main Project Explorer states.
- Add more specific gotchas after the next real Project Explorer implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

## Fast Workflow Execution Report — 2026-05-23 (pp-view-project-explorer Audit)

**User Command:** `/pp-view-project-explorer`

**Inspector (entry + final exit):**
- Status: **ok** both times.
- Tracked tests: **0** (no test globs recorded in auto-sync or page-map)
- Main source: `client/src/components/layout/sidebar/ProjectExplorer.tsx` (253 lines per inspector; 215 code / 48 CCN by scc)
- Companion tree renderer: `ComponentTree.tsx` (249 code / 41 CCN)
- Combined surface: 2 files / 464 code / 89 CCN
- All references present. Re-run after full discovery remained clean.

**Exact Fast Workflow Sequence Followed (non-negotiable contract):**
1. `node .agents/skills/pp-view-project-explorer/scripts/inspect-project-explorer.mjs` → ok
2. Read `references/page-map.md` (25 lines)
3. Read `references/ux-contract.md` (24 lines) — before any layout/user-facing synthesis
4. Read `references/testing.md` (27 lines)
5. Read `references/gotchas.md` (17 lines) — before any sync/persistence/density analysis
6. Read `SKILL.md` (Tier 3, single primary file, zero tests recorded)
7. Deep source inspection (ProjectExplorer.tsx + ComponentTree.tsx) + structural ast-grep searches + scc metrics
8. Cross-campaign synthesis vs. Left Sidebar (Tier 1 shell), canonical GraphNode model, selection/expansion state ownership, DnD integration, provenance visibility, UI Container Rule
9. Durable append to this log + master report (section 31)
10. Final inspector re-run (ok)

**Quantitative Snapshot (scc):**
- ProjectExplorer.tsx: 215 code / 48 CCN (section headers, count/severity logic, orchestration of ComponentTree for architecture only)
- ComponentTree.tsx: 249 code / 41 CCN (recursive GraphNode tree, @dnd-kit draggable categories + nodes, fuzzy search + highlight, context menu, category expansion)
- Total: 464 code / 89 CCN — one of the lightest surfaces audited (appropriate for Tier 3 nav)
- Very low complexity relative to Procurement (1002 CCN), PCB (854 CCN), Component Editor (1498 CCN)

**Source Ownership (from page-map + auto-sync + code):**
- Primary: `ProjectExplorer.tsx` (skill-owned)
- Critical neighbor: `ComponentTree.tsx` (actual recursive project tree / file navigation implementation; owned by the same sidebar module)
- Parent coordinator: `Sidebar.tsx` (lifts nodes, searchQuery, selectedNodeId, expandedCategories, focusNode, bom, issues, etc. and passes them down)
- Other sidebar siblings: HistoryList, CoachPanel, ProjectSettingsPanel, SidebarHeader (previously audited under pp-view-left-sidebar)

**Deep Analysis vs. UX Contract Pillars (Project Tree / File Navigation / Sidebar Density / Selection):**

- **Project Tree & File Navigation (strong implementation, narrow scope):**
  - Renders 6 fixed sections: Architecture (real tree), Schematics, PCB Layout, Components, Bill of Materials, Validation (count + severity badges + direct view navigation).
  - Only "architecture" gets the recursive `<ComponentTree>` (GraphNode categories: mcu/sensor/power/comm/connector/generic with draggable headers, expand/collapse, fuzzy search + `highlightMatches`, context menu, selection via `focusNode`).
  - Other sections act as smart shortcuts: show live counts (from `useCircuitDesigns`, bom, issues, nodes) + validation severity badges, and navigate to the corresponding ViewMode.
  - Excellent use of the canonical `GraphNode` model from the architecture layer. DnD integration (`useDraggable`, PROTOPULSE_DRAG_TYPE) lets users drag categories/nodes directly onto Breadboard or other surfaces.
  - Search is wired from parent (`searchQuery`) and highlighted in the tree.

- **Selection & State Ownership (prop-drilled, parent owns truth):**
  - `selectedNodeId`, `focusNode`, `expandedCategories` / `setExpandedCategories` are all passed from `Sidebar.tsx`.
  - This is consistent with the Left Sidebar audit (Tier 1 shell owns the dense coordinated panels). Project Explorer is a pure presenter/orchestrator for the tree + section headers.
  - Expansion for the 6 top-level sections is local state in ProjectExplorer (only architecture starts true); category expansion inside the tree is lifted to parent.

- **Sidebar Density & UI Container Rule (risk exists, not yet a defect in this file):**
  - The explorer lives inside the left sidebar (previously audited). The component itself is lightweight (`mt-0.5 space-y-0.5` + pl-2.5 indent for the tree).
  - Gotchas explicitly call out "Fixed heights and nested overflow can create scroll traps" — this surface inherits any scroll/height problems from the Sidebar shell.
  - No fixed heights inside ProjectExplorer or ComponentTree themselves (good), but the parent Sidebar must guarantee the explorer region is reachable/scrollable when the project has many GraphNodes or long search results.
  - a11y note at top of file: heavy use of `role="button"` on `<div>` for SectionHeader and DraggableCategoryHeader (tracked under E2E-552 / InteractiveCard Phase 3 migration). Keyboard handling is present (Enter/Space), but semantic buttons are the planned fix.

- **Provenance / Trust / Generative Visibility (complete absence — expected for Tier 3 nav but still a gap vs. campaign):**
  - Zero matches for `Trust*`, `provenance`, `generatedFrom`, `verification`, `exactPart`, `VaultHover`, `ReleaseConfidence`, etc.
  - The tree shows node type + label + drag handle + search highlight. No verification badges, no generative-origin stamps, no "this node came from an un-reviewed AI adoption" indicators.
  - Selection in the explorer is the primary way users discover and focus parts of the project. When the rest of the app (Component Editor, 3D, Exports, Procurement) now carries rich provenance, the discovery surface should at minimum surface a small badge or tooltip so users can see at a glance which parts of their architecture are "trusted" vs. "AI-generated / uncertain" (per the ux-contract "AI-generated or uncertain data is clearly marked" rule).

- **Tests (structural gap):**
  - 0 tracked tests for the skill. No dedicated glob in page-map or auto-sync.
  - Nearest tests are in the same directory (`CoachPanel.test.tsx`, `sidebar-constants.test.ts`) but do not cover ProjectExplorer or ComponentTree.
  - Browser checks (per testing.md) are the current safety net: load, reachability, scroll, no overflow, keyboard/focus.

**Cross-References to Prior Campaign Work:**
- Left Sidebar (pp-view-left-sidebar) — this is the "Project Tree / File Navigation" sub-piece inside the Tier 1 shell. State lifting, density, and scroll behavior were already called out there.
- Architecture view (graph model, GraphNode, selection sync) — ProjectExplorer + ComponentTree are the primary sidebar consumers of the live architecture graph.
- Breadboard-lab + DnD (dragging from the tree onto the bench is a first-class flow).
- 3D rescue, Component Editor verification gates, Generative stamps, Exports precheck — all of these now attach provenance that the discovery tree never surfaces.
- UI Container Rule enforcement across the entire left sidebar.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Surface minimal provenance / verification indicators in the Architecture tree (the discovery surface must reflect the safety story)**
- Even a small badge or tooltip on GraphNode rows (or category headers) for `generatedFrom`, verificationLevel, or "AI-suggested" would make the "AI-generated or uncertain data is clearly marked" contract real at the point of selection.
- Coordinate with Component Editor (where the verification lives) and the GraphNode enrichment pipeline.

**P1 — Ensure Sidebar shell guarantees scroll/reachability for the explorer region (UI Container Rule)**
- The explorer itself is clean and lightweight. The risk is inherited from the parent Sidebar (fixed heights, multiple competing panels, laptop viewports). Re-validate after any Sidebar density changes.

**P2 — Add at least smoke + interaction tests for ProjectExplorer + ComponentTree (selection, expand/collapse, search highlight, DnD data, keyboard nav)**
- A nav surface used on every project deserves some coverage beyond "browser check."

**P2 — Complete the InteractiveCard / semantic button migration (remove the eslint-disable at top of file)**
- Already tracked as E2E-552 / Plan 03 Phase 4.

**P2 — Consider whether "Schematics", "PCB Layout", "Components", "BOM", "Validation" sections should show richer status (e.g., "3 unverified parts", "last validated 2h ago", provenance summary) instead of raw counts only.**

**Strengths (relative to peers):**
- Extremely clean, low-complexity implementation for a Tier 3 surface (89 CCN total).
- Excellent separation of concerns: ProjectExplorer owns the 6-section orchestration + counts + severity badges; ComponentTree owns the recursive draggable/searchable tree.
- Tight integration with the canonical GraphNode + useCircuitDesigns + validation issues model.
- Live counts + error/warning badges on the Validation section are genuinely useful at a glance.
- DnD from the tree is first-class (drag handles appear on hover, proper mime types).
- Fuzzy search + highlight works inside the tree without bloating the component.

**Durable Lessons for Future Agents:**
- Even "just a tree in the sidebar" (Tier 3) is the primary discovery and selection surface for the entire canonical project model. When the rest of the app invests heavily in provenance and verification, the tree must eventually reflect it — otherwise users have no way to know which parts of their architecture are trustworthy before they drill into Component Editor or 3D.
- Prop drilling of selection/expansion/search state from the Sidebar shell is the correct pattern for coordinated left-sidebar panels; do not fight it.
- Zero tests on a constantly-used nav component is a real (if low-priority) gap. Browser checks + inspector are the current contract, but they are not sufficient for regression safety on DnD, search highlight, or keyboard category expansion.
- The a11y debt (div-as-button) is explicitly tracked and linked to a plan — good hygiene.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 0 tests).
- Mandatory ast-grep for provenance signals returned zero matches in the entire surface.
- Full scc metrics captured (lightweight, appropriate for Tier 3).
- Sequential reads of all four references + SKILL.md before any synthesis.
- No production code mutated (pure discovery pass).
- All findings cross-referenced to the Left Sidebar audit, Architecture graph model, DnD flows into breadboard, the provenance campaign (3D, Component Editor, Generative, Exports, Procurement), and the UI Container Rule.
- Detailed Fast Workflow Execution Report appended here; corresponding master report section 31 written.

---

*Project Explorer analysis complete. This is the lightweight Tier 3 "project tree + section shortcuts" surface inside the left sidebar. It is clean, low-complexity, and well-integrated with the GraphNode / circuit design / validation model. Its primary gaps are (1) complete absence of provenance/verification visibility on the discovery tree (a campaign-level consistency issue), (2) zero recorded tests for a surface used on every project, and (3) inherited scroll/density risks from the parent Sidebar shell. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Project Explorer section (2026-05-23).*

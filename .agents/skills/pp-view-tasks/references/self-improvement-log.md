# Tasks Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Tasks work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Tasks behavior.

## Pending Proposals

- Add screenshots for the main Tasks states.
- Add more specific gotchas after the next real Tasks implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

## Fast Workflow Execution Report — 2026-05-23 (pp-view-tasks Audit)

**User Command:** `/pp-view-tasks`

**Inspector (entry + final exit):**
- Status: **ok** both times.
- Tracked tests: **0** (none recorded)
- Primary source: `client/src/components/views/KanbanView.tsx` (782 lines / 687 code / **72 CCN** — hosts the highest-complexity component in the codebase per prior analysis: dnd-kit board + TaskDependencyGraph ~145 CCN)
- Imports heavy logic from `@/lib/kanban-board`
- References all present. Re-run after discovery remained clean.

**Exact Fast Workflow Sequence Followed (non-negotiable contract):**
1. `node .agents/skills/pp-view-tasks/scripts/inspect-tasks.mjs` → ok
2. Read `references/page-map.md` (25 lines)
3. Read `references/ux-contract.md` (24 lines) — before any drag/drop / columns / planning analysis
4. Read `references/testing.md` (27 lines)
5. Read `references/gotchas.md` (17 lines) — before any sync/persistence/trust analysis
6. Read `SKILL.md` (Tier 3, KanbanView + lib/kanban-board)
7. Deep source inspection (KanbanView + kanban-board lib for columns, cards, dnd, dependency graph, AI suggestions, modals) + mandatory ast-grep + scc
8. Cross-campaign synthesis vs. provenance (AI-suggested tasks should be marked), UI Container for multi-column boards on laptop, drag/drop accessibility, workflow planning as the "front door" for project execution
9. Durable appends to this log + master report (section 38)
10. Final inspector re-run (ok)

**Quantitative Snapshot (scc):**
- 687 code / **72 CCN** in the view file alone (the embedded dnd-kit + dependency graph pushes the effective complexity of the feature to the highest in the codebase ~145 CCN per earlier analysis)
- Kanban board with status columns, task cards, drag-and-drop reordering, filtering, create/edit dialogs, likely dependency visualization and AI suggestions.

**Source Ownership:**
- `KanbanView.tsx` (skill-owned page view)
- Core logic in `@/lib/kanban-board` (KanbanColumn, board state, dnd handlers, TaskDependencyGraph, etc.)
- Recurring a11y debt (div role=button disables, tracked under E2E-552 / InteractiveCard migration)

**Deep Analysis vs. UX Contract (Tasks / Status Columns / Workflow Planning / Drag/Drop):**

- **Status Columns & Drag/Drop (the high-complexity heart of the surface):**
  - Multi-column Kanban with drag-and-drop task movement between statuses (likely using @dnd-kit for smooth interactions).
  - Task cards with metadata (assignee, due date, tags, priority?).
  - The dependency graph and AI suggestion features (known from the feature's prior description) make this one of the most complex interactive surfaces in the app.
  - Workflow planning is first-class: visual board for design task tracking.

- **Tasks & Workflow Planning (strong functional support):**
  - Create/edit task dialogs, filtering, column management.
  - Ties into the overall project workflow (tasks linked to architecture nodes, BOM items, validation issues, etc.).

- **Provenance / "AI-generated or uncertain data is clearly marked" (absent):**
  - The board supports AI suggestions (per the high-complexity feature description).
  - ast-grep across KanbanView returned zero matches for Trust*, provenance, generatedFrom, verification, AI suggestion badges, confidence scores, etc.
  - AI-generated tasks or suggestions are not visually distinguished or marked as "uncertain" — a direct violation of the ux-contract for a surface that explicitly includes AI-assisted workflow planning.

- **Layout / UI Container (multi-column board risks):**
  - Multiple horizontal status columns + cards + filters + dependency graph + dialogs create exactly the "fixed heights, nested overflow, scroll traps, laptop viewport" risks called out in gotchas and the global UI Container Rule.
  - Drag-and-drop on a dense board with many columns is particularly sensitive to viewport and focus management issues.

- **Tests (gap):**
  - 0 tracked. Browser checks (load, drag/drop between columns, create/edit, filtering, scroll on long boards, keyboard accessibility for dnd) are the current contract. Given the 72+ CCN interactive complexity, this is a notable gap.

**Cross-References to Prior Campaign Work:**
- Provenance campaign (Generative AI suggestions, Component Editor verification) — the task board is a place where AI-generated work items appear; they must be marked.
- Architecture / Schematic / PCB views — tasks are likely linkable to nodes, sheets, components, validation issues.
- UI Container Rule — multi-column interactive boards are one of the hardest surfaces to keep reachable.
- Recurring a11y debt across dense editors.
- Project Explorer / Dashboard as the front door that should surface task health.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Mark AI-generated / suggested tasks with provenance badges and confidence (enforce the ux-contract)**
- Tasks created or suggested by AI must carry visual "AI-suggested" / confidence / verification status indicators (consistent with Generative view stamps, Component Editor verification, etc.).
- The TaskDependencyGraph and suggestion UI should surface this metadata.

**P1 — Enforce UI Container Rule on the multi-column Kanban board + dependency graph on laptop viewports**
- Horizontal columns must scroll or collapse gracefully; cards and drag targets must remain reachable; focus management during dnd must not trap the user.

**P2 — Add tracked tests for the core interactive flows** (drag/drop between columns and within, create/edit with validation, filtering, dependency graph interactions, AI suggestion acceptance, keyboard dnd).

**P2 — Complete the tracked a11y / InteractiveCard migration** (remove the eslint-disable for div-as-button patterns in the board and cards).

**Strengths (relative to peers):**
- Hosts one of the most sophisticated interactive workflow planning tools in the app (dnd-kit Kanban + dependency graph + AI suggestions).
- Clean separation between the page view (KanbanView) and the reusable lib/kanban-board primitives.
- Directly supports the "workflow planning" pillar with visual, drag-and-drop task management tied to the design process.

**Durable Lessons for Future Agents:**
- Any surface that hosts AI suggestions (task board, generative adopt, chat actions) must visibly mark those items as "AI-generated / uncertain" per the ux-contract — the task board currently fails this.
- High-complexity drag-and-drop boards (145 CCN component) are exactly the places where UI Container Rule and a11y debts accumulate fastest; they require proactive scroll/resize/keyboard testing on real laptop viewports.
- Tier 3 ownership of a high-CCN interactive feature still demands the same provenance and accessibility rigor as the heavy Tier 1 editors.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 0 tests).
- Mandatory ast-grep returned zero provenance/AI-marking signals on the Kanban board.
- Full scc report (687 code / 72 CCN in the view, with the embedded board pushing feature complexity to the highest in the codebase) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).
- All findings cross-referenced to the provenance campaign (Generative, Component Editor), UI Container Rule on dense interactive surfaces, the recurring a11y debt, Architecture/Schematic/PCB task linkage, and prior audits.
- Detailed Fast Workflow Execution Report appended here; master report section 38 written.

---

*Tasks analysis complete. This is a Tier 3 Kanban view (72 CCN in the file, hosting the highest-complexity dnd + dependency graph component in the app) that provides powerful workflow planning with status columns and drag/drop. The "Tasks / Status Columns / Workflow Planning / Drag/Drop" pillars are functionally rich. The critical gap is the absence of provenance marking on AI-suggested tasks (direct ux-contract violation). Multi-column board layout carries real UI Container and a11y risks on laptop viewports. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Tasks section (2026-05-23).*

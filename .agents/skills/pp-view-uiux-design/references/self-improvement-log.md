# UI/UX + DESIGN Skill Self-Improvement Log

## Accepted Learnings

- Tyler wants simpler language in direct explanations.
- UI work should focus on usefulness, sizing, spacing, density, and workflow clarity before decoration.
- The app has been too loud from too many icons and stacked bars.
- Menus that can grow must be scrollable.
- Browser screenshots are part of verification for visual work.
- `DESIGN.md` color tokens must stay in sync with the base `@theme` CSS variables via `npm run design:check`.

## Pending Proposals

- Add a design regression screenshot set for workspace header, left sidebar, right sidebar, Breadboard, Schematic, and Architecture.
- Add a menu overflow checklist for every top-bar More menu.

## Implemented Guardrails

- 2026-05-24: Added `npm run design:check` and `scripts/design/check-token-drift.mjs` to fail when `DESIGN.md` color tokens drift from base `client/src/index.css` `@theme` variables. Added focused coverage in `scripts/__tests__/design-token-drift.test.ts`.

## Rejected Or Deferred

- Do not solve loud UI by adding another visible control row.

## Fast Workflow Execution Report — 2026-05-23 (pp-view-uiux-design — Design System Capstone Audit)

**User Command:** `/pp-view-uiux-design`

**Inspector (entry + final exit):**
- Status: **ok** both times.
- Tracked tests: **28** (a11y.test.tsx, WorkspaceHeader.test.tsx + reducer + hover-peek, button + button.a11y, plus many ui component tests)
- Core validated sources:
  - DESIGN.md (405 lines) — the single source of truth for tokens, colors, typography, visual direction
  - client/src/index.css (836 lines) — global CSS variables and base styles
  - Workspace shell: ProjectWorkspace.tsx (920 lines), WorkspaceHeader.tsx (558 lines), ViewRenderer, MobileNav, workspace-reducer, useHoverPeekPanel
  - High-impact primitives: button.tsx, dropdown-menu.tsx, scroll-area.tsx, dialog, tooltip, tabs, card, input, and many more in ui/**
- All references present and valid. Re-run after discovery remained clean.

**Exact Fast Workflow Sequence Followed (non-negotiable contract):**
1. `node .agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs` → ok (validated DESIGN.md + index.css + ui/** + workspace shell + 28 tests)
2. Read `references/page-map.md` (36 lines) — explicitly names DESIGN.md as design direction owner, index.css for tokens, ui/** for primitives, workspace/** for shell
3. Read `references/ux-contract.md` (35 lines) — before any visual synthesis (quiet hardware workbench, cyan/purple accents only, no noise, no nested cards, laptop height, no too many bars, visible focus, text fits, scrollable menus, no layout shift on hover)
4. Read `references/testing.md` (33 lines) — a11y tests + component tests + mandatory browser screenshots for visual truth
5. Read `references/gotchas.md` (27 lines) — theme drift, top-bar multiplication, fixed-height + nested overflow scroll traps, cards-in-cards, Radix portal/focus, tooltip-only meaning, screenshots as verification, console warnings as defects
6. Read `SKILL.md` (Tier 1 meta-skill)
7. Deep source inspection (DESIGN.md tokens, index.css fidelity, ui/** primitives, workspace shell layout/density/peek, a11y tests) + scc on the design surface + cross-audit synthesis
8. Synthesis of all 38 previous view audits against this skill's contract/gotchas (the recurring visual debt we documented everywhere)
9. Durable appends to this log + master report (section 39 — the design-system capstone)
10. Final inspector re-run (ok)

**Quantitative Snapshot (scc on the design-system surface):**
- DESIGN.md: 405 lines (token + rationale source of truth)
- index.css: 836 lines (global variables + base styles)
- ui/** + workspace/**: 117 files, ~13k+ code LOC, **1161+ CCN** (massive cross-cutting surface)
- Hotspots: sidebar.tsx (661 lines), WorkspaceHeader (557), EmbedDialog, chart, TutorialOverlay, ViewRenderer, GlobalSearchDialog, UnifiedComponentSearch, RadialMenu, command-palette, etc.
- This is the largest Tier 1 surface in the entire audit — the owner of visual identity and component library for every page we audited.

**Deep Analysis — The Design System as the Source of Recurring Debt Across the Entire Audit**

The inspector, page-map, ux-contract, gotchas, and self-improvement log form the strongest, most explicit design contract of any skill we audited. The problem is **enforcement and fidelity** between the contract and the 38+ individual page surfaces.

**What the contract and gotchas explicitly forbid (and what we saw repeatedly):**
- "Too many upper bars made the app feel loud" — observed in Right Sidebar (chat column + overlays + prediction + tutorial), Schematic (multiple side panels + floating decay/JIT cards + dialogs), PCB, Architecture, Procurement (16+ tabs + dense panels), Tasks (multi-column + graph + filters), Simulation (multiple viewers + history + trust cards), etc.
- "Fixed heights and nested overflow can create scroll traps" — observed in almost every dense view (WaveformViewer + side panels, ChatPanel long threads, ActivityFeed slide-over, SupplyChainAlerts ScrollArea inside Card, Kanban multi-column board, etc.).
- "Cards inside cards make the interface feel heavy" + "Page sections should not be nested cards" — observed across many panels and views.
- "Small-height desktop viewports catch many layout failures" + "Responsive layout must work on laptop-height screens" — the recurring "laptop viewport" failure mode we documented in nearly every Tier 1/2 surface.
- "Primary and accent colors should guide attention, not flood the whole screen" + "Avoid decorative blobs, orbs, and empty visual noise" — the "quiet hardware workbench" vision vs. reality.
- "Tooltip-only meaning is weak for important actions" + "Clear labels when an icon is not obvious" — recurring in dense toolbars and side panels.
- "Passing tests do not prove good layout" + "Screenshots are required for real UI/UX confidence" + "Console warnings are defects" — the exact verification policy we enforced in every audit.

**Positive foundation:**
- The existence of a single DESIGN.md with explicit tokens, a ui/** primitive library, a11y tests, WorkspaceHeader tests, and the inspector that validates the design sources is a **strong architectural win**.
- The self-improvement log already captures the right lessons ("too loud from too many icons and stacked bars", "menus that can grow must be scrollable", "browser screenshots are part of verification").
- Pending proposals (screenshot regression set for key surfaces, CSS/token audit script comparing DESIGN.md to active variables, menu overflow checklist) are exactly the enforcement mechanisms needed.

**The gap the handoff must close:**
- The design system is **declarative** (DESIGN.md + contract) but enforcement is **advisory** (page skills are supposed to read the ux-contract before visual work, but many surfaces were built before this discipline was strict).
- No automated token drift detection.
- No mandatory screenshot regression for the core shell (header, sidebars, key viewers).
- Many ui primitives still allow (or encourage) the anti-patterns the contract forbids (easy to nest cards, easy to create fixed-height containers without scroll, easy to add another top bar).
- Provenance UI (TrustReceiptCard, ReleaseConfidenceCard, verification badges) is not yet a first-class, consistently styled primitive that every surface is required to use when showing AI-generated or uncertain data.

**P0 / P1 / P2 Backlog Items for Codex (Design System Tightening):**

**P0 — Make the design system the enforceable owner of the visual contract (not just advisory)**
- Add a pre-commit / CI gate that fails if DESIGN.md tokens drift from index.css variables.
- Mandate the pending "screenshot regression suite" for header + left sidebar + right sidebar + Breadboard + Schematic + Architecture + Kanban as part of every visual PR.
- Update the ui/** primitives (or create higher-level layout primitives) so that the anti-patterns (nested cards, fixed-height without scroll, easy top-bar stacking) are harder or impossible to do by default.

**P1 — Bake provenance visibility into the design system primitives**
- Create first-class, consistently styled components for TrustReceiptCard, ReleaseConfidenceCard, "AI-generated" badges, verification level indicators, source confidence badges.
- Update the ux-contract and gotchas to require every surface that shows AI-generated or unverified content to use these primitives (this would have caught the zero-match gaps we found in Schematic, PCB placer, Procurement, Tasks board, Kanban, etc.).

**P1 — Enforce laptop-height + UI Container Rule at the primitive level**
- Make ScrollArea, Card, Panel, Sidebar, and layout primitives default to behaviors that prevent scroll traps on small-height viewports.
- Add explicit "laptop viewport" stories and tests to the component library.

**P2 — Continue the InteractiveCard / semantic button a11y migration** across the entire ui/** and workspace shell (the recurring eslint-disable we saw in almost every dense editor).

**P2 — Add the menu overflow + "More" menu checklist** as an automated or review-time gate (the pending proposal in the log).

**Strengths (relative to peers):**
- The only skill in the entire audit that has an explicit, written, versioned design contract (DESIGN.md + ux-contract + gotchas) that directly predicts and explains the visual debt we documented in 38 other views.
- Strong test surface (28 tracked tests including a11y and button.a11y) and inspector that validates the design sources.
- The self-improvement log and pending proposals are already the right next steps — the handoff just needs to execute them.
- The existence of a dedicated Tier 1 design-system skill is the correct architectural pattern for a product that wants to stay "quiet, useful, hardware-workbench focused."

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 28 tests, all design sources validated).
- The ux-contract, gotchas, and self-improvement log are the single source of truth that explains why the same visual/layout problems appeared across every page skill we audited.
- Full scc report on the massive design surface captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass — this skill is the one that would own any future visual fixes).
- This report is the capstone synthesis of the entire 39-view handoff audit, with every recurring defect traced back to gaps in enforcement of this skill's own contract.
- Detailed Fast Workflow Execution Report appended here; master report section 39 written.

---

*UI/UX + DESIGN (design-system capstone) analysis complete. This is the Tier 1 meta-skill that owns the single source of truth (DESIGN.md + index.css + ui/** primitives + workspace shell) and the explicit contract that directly predicts and explains the visual/layout debt we documented in every one of the 38 previous views. The foundation is strong; the gap is enforcement and fidelity between the written contract and the implemented surfaces. The pending proposals in the self-improvement log (screenshot regression, token audit script, menu overflow checklist) plus making the primitives themselves prevent the anti-patterns are the highest-leverage next steps for the handoff. Inspector remained clean. This is the final page-skill audit in the sequence. Ready for the next `/pp-view-xxx` or explicit Codex continuation / handoff wrap-up.*

---

*End of appended UI/UX + DESIGN (design-system capstone) section (2026-05-23).*

## R23 Keyboard Lesson

The broad keyboard gate became tractable once low-risk accessible-name and native-control traps were fixed first. Keep keyboard work in this order: name reachable controls, remove native/platform focus traps, then handle composite canvas behavior. The full suite now passes with only the intentional 3D canvas skip.

---
name: "ARIA grid pattern for SVG canvas with 830 cells (breadboard) — vault-gap stub"
description: "Gap flagged by 03-a11y-systemic.md Wave 10 Task 10.3 + Phase 7 (breadboard tie-points). Seed for /extract."
captured_date: 2026-04-19
extraction_status: extracted
extracted_date: 2026-04-19
extracted_notes:
  - aria-grid-pattern-fits-breadboard-terminal-strips-but-not-the-full-canvas-because-power-rails-lack-row-column-semantics
  - breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones
  - aria-grid-role-is-an-anti-pattern-for-anything-that-is-not-a-spreadsheet
  - role-application-suppresses-screen-reader-browse-mode-and-should-be-avoided-for-mixed-content
  - roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management
  - aria-rowindex-and-aria-colindex-let-sparse-grids-announce-position-without-rendering-all-cells
  - highly-interactive-items-without-meaningful-row-column-relationships-are-not-grids
triage_status: gap-stub
source_type: vault-gap-seed
origin:
  plan: docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
  task: Wave 10 Task 10.3 (also Phase 7 breadboard tie-point labels)
coverage_at_gap: missing
strong_hits_at_gap: 0
research_questions:
  - How does WAI-ARIA 1.2/1.3 define the `role="grid"` pattern? Which child roles (gridcell, row, columnheader)?
  - What are the `aria-rowindex` and `aria-colindex` conventions for sparse/large grids?
  - How does `role="application"` differ from `role="grid"` for custom SVG canvases?
  - What's the right pattern for a breadboard with 2 power rails × 2 sides + 63 rows × 10 columns (~830 tie-points)?
  - Keyboard navigation spec: arrow keys move focus between cells; what are the escape-hatch shortcuts?
  - Screen-reader announcement pattern: "Power rail left positive, position 5" vs "Column A, row 7" — what do NVDA, JAWS, VoiceOver actually say for each approach?
unblocks:
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/07-breadboard.md
topics:
  - vault-gap-seed
  - aria
  - a11y
  - breadboard-intelligence
  - keyboard-navigation
---

## Gap context

The breadboard canvas renders ~830 tie-point holes as SVG elements with `testid="hole-r:<rail>:<N>"` but no ARIA labels. E2E-625 marks this as a critical a11y gap. The fix is structural: either `role="grid"` with aria-rowindex/aria-colindex on each cell, OR a `role="application"` wrapper with a focused-element announcer. This note needs to make the authoritative case for which pattern wins and document the chosen keyboard-nav contract.

## Primary sources to consult

- W3C WAI-ARIA 1.2 — Grid Pattern https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- W3C WAI-ARIA 1.2 — Application Role https://www.w3.org/WAI/ARIA/apg/roles/application-role/
- Adrian Roselli — "Grid, Table, and ARIA" (on when to use which)
- Heydon Pickering — Inclusive Components (re: keyboard navigation in dense UIs)
- Nielsen Norman — "Screen Reader UX: Dense Interfaces"
- Real-world test: plug in NVDA + Firefox on Wokwi or Tinkercad breadboard canvas and observe announcements (if accessible)

## Suggested extraction output

Primary atomic note: `knowledge/aria-grid-pattern-for-large-svg-canvas-breadboard.md`
Companion: `knowledge/breadboard-keyboard-nav-arrow-key-contract.md`

## Instructions for /extract

1. Research the grid vs application tradeoff. Test with screen readers if possible (or cite NNgroup findings).
2. Decide: for 830 cells, which pattern yields best UX? (Hint: `role="grid"` has significant screen-reader overhead; `role="application"` with focused-element-announces may be lighter.)
3. Produce the notes with clear implementation pseudocode.
4. Cross-link to `breadboard-intelligence` MOC + `maker-ux` MOC.

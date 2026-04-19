---
description: "Higley's rule: a surface only deserves `role=\"grid\"` if BOTH conditions hold — interaction is the primary purpose AND there is a meaningful row-column relationship users navigate along both axes; visually 2D but semantically 1D layouts (photo galleries, app launchers, card grids) are lists or landmarks, not grids."
type: claim
created: 2026-04-19
topics:
  - "[[a11y]]"
  - "[[architecture-decisions]]"
---

# Highly interactive items without meaningful row-column relationships are not grids

Sarah Higley's grids-vs-tables framework resolves the most common author confusion: "my UI has rows and columns visually, so it's a grid, right?" The answer is no, and the missing test is whether the row/column axes *mean* something the user needs to navigate along. A grid is two-dimensional navigation over two-dimensional semantics. Visually-2D-but-semantically-1D surfaces are lists with a CSS grid layout, not ARIA grids.

The test has two conjuncts, both required:

1. **Interaction is the primary purpose.** Users come here to edit, manipulate, or rapidly act on cells, not to read. If they come here to read first and occasionally click, it is a table (for tabular reading data) or a list (for cards, search results, galleries).

2. **The row and column axes carry meaning users navigate along.** A spreadsheet passes trivially: row 5 column C is "Q2 revenue for West region" — both axes are data dimensions. A photo gallery fails: the fact that the 7th photo happens to be in the "second row, third column" is a layout accident, not a semantic claim. Navigating "down a column" has no meaning to the user; they want "next photo" or "next by date."

Examples that fail the test:

- **App launcher grid** (iOS home screen, macOS Launchpad): visually 2D, but arrow-down to "the app below Calendar" is arbitrary layout, not semantic relationship. Correct role: list or `role="grid"` with authored row/column semantics of "prev page/next page" if the layout is meaningful.
- **Photo gallery**: the grid is for visual density. Correct: list of items with descriptive labels.
- **Responsive card layout**: collapses to one column on mobile. If arrow-up/down worked horizontally on desktop, it breaks on mobile. Not a grid.
- **Search results in a table-like layout**: primary task is reading, clickability is secondary. Plain table or list.
- **Dashboard widgets**: each widget is independent; there is no "next widget along the row" that matters.

Examples that pass:

- **Spreadsheet**: every cell is semantic, both axes carry data.
- **Calendar month view** (arguable): rows are weeks, columns are weekdays; navigating "down" means "same weekday next week" which IS semantically meaningful for scheduling.
- **Genuine coordinate grids** like pixel art editors, chess boards, cell-based level editors.

For the breadboard: the canvas as a whole fails the test (the 4 power rails and 2 terminal strips are *zones*, not a single row-column matrix), but each terminal strip internally passes — within one strip, row 17 column B genuinely means "tie-point 17B that is electrically bonded to 17A, 17C, 17D, 17E." See [[aria-grid-pattern-fits-breadboard-terminal-strips-but-not-the-full-canvas-because-power-rails-lack-row-column-semantics]] for the zone-by-zone decision.

The practical consequence: if you cannot complete the sentence "navigating {up/down/left/right} from this cell takes me to..." with a meaningful semantic description, the surface is not a grid.

---

Source: [[2026-04-19-aria-grid-for-svg-canvas-830-cells]]

Relevant Notes:
- [[aria-grid-role-is-an-anti-pattern-for-anything-that-is-not-a-spreadsheet]] — Roselli's sibling claim with empirical evidence
- [[aria-grid-pattern-fits-breadboard-terminal-strips-but-not-the-full-canvas-because-power-rails-lack-row-column-semantics]] — breadboard-specific application of the test

Topics:
- [[a11y]]
- [[architecture-decisions]]

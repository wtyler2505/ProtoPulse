---
description: When a grid does not render every logical cell in the DOM — virtualized, collapsed, or intentionally partial...
type: claim
created: 2026-04-19
topics:
- a11y
- implementation-patterns
---
# aria-rowindex and aria-colindex let sparse grids announce position without rendering all cells

A grid is "sparse" when the DOM does not contain every cell of the logical grid — either because the grid is virtualized for performance (only the visible rows are rendered), collapsed for density (zoom level hides the non-selected rows), or intentionally partial (only the cells that currently hold a component get rendered to SVG). The problem is that a screen reader computes "cell 5 of 63" by counting DOM siblings, and if only 12 of 63 rows are in the DOM, the count is wrong.

`aria-rowindex` and `aria-colindex` solve this by letting the cell *declare* its logical position regardless of DOM order. A cell with `aria-rowindex="47" aria-colindex="3"` announces "row 47, column 3" to the screen reader even if it is the second `<g>` element under the grid container. `aria-rowcount` and `aria-colcount` on the container declare total dimensions so the screen reader can announce "row 47 of 63".

The rules are strict:

1. **Values are 1-indexed.** Not 0-indexed. Screen readers announce the raw number; off-by-one feels like a screen-reader bug from the user's side.
2. **Every cell in the DOM must have its index.** Missing values are treated as undefined position; the W3C warns that inconsistent values cause NVDA/JAWS table-reading commands to "skip rows or simply stop functioning."
3. **Counts go on the grid, indices go on the cells.** Mixing them (putting `aria-colcount` on a row, say) produces undefined behavior per role inheritance rules.
4. **Values must match visual order.** If a cell visually belongs at column 5 but carries `aria-colindex="3"`, arrow-key navigation from the screen reader's internal model breaks.

For ProtoPulse's breadboard, this is the mechanism that lets us keep a partial DOM for large projects. The canvas has `aria-rowcount="63"` (terminal strip row count) per zone, and each rendered tie-point carries its `aria-rowindex`/`aria-colindex`. A sparsely populated breadboard — say 12 components, ~40 active tie-points — still announces "column B, row 17 of 63" correctly, because the logical position comes from the declared attribute, not DOM counting.

The failure mode to watch for: keeping index attributes in sync across React rerenders. If a row changes visual position (scroll-into-view triggers a virtualization shift) but its `aria-rowindex` still reflects the old logical row, screen-reader state diverges from visual state. Compute indices from the data model, never from DOM order, and assert equality in tests.

Combine with [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] for the full focus-and-announce contract.

---

Source: [[2026-04-19-aria-grid-for-svg-canvas-830-cells]]

Relevant Notes:
- [[aria-grid-pattern-fits-breadboard-terminal-strips-but-not-the-full-canvas-because-power-rails-lack-row-column-semantics]] — where sparse-grid indexing applies on the canvas
- [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] — focus companion to position announcement

Topics:
- [[a11y]]
- [[implementation-patterns]]

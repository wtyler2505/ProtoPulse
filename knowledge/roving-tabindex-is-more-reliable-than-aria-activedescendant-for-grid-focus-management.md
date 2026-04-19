---
description: "Roving tabindex (set tabindex=0 on the focused cell, tabindex=-1 on all others) gives screen readers a real DOM focus event and lets the browser auto-scroll the cell into view; aria-activedescendant only moves a virtual pointer and has known VoiceOver bugs on grid/combobox roles."
type: claim
created: 2026-04-19
topics:
  - "[[a11y]]"
  - "[[implementation-patterns]]"
---

# Roving tabindex is more reliable than aria-activedescendant for grid focus management

Both techniques solve the same problem — how to let arrow keys move an "active" cell around a grid while keeping the grid as a single tab stop in the page sequence — but they take different contracts with the browser and screen reader.

**Roving tabindex** moves *real DOM focus* between cells. Exactly one cell at a time has `tabindex="0"`; all other cells have `tabindex="-1"`. When the user presses an arrow key, the handler sets the current cell to `tabindex="-1"`, sets the new cell to `tabindex="0"`, and calls `.focus()` on it. The browser fires a standard `focus` event, updates `document.activeElement`, and — crucially — auto-scrolls the newly focused cell into view when it is off-screen.

**aria-activedescendant** leaves DOM focus on the grid container and uses an ARIA pointer: `aria-activedescendant="cell-id-47"` tells assistive technology "the active element is the one with this id." No DOM focus moves. No `focus` event fires. The browser does not auto-scroll. The author must scrollIntoView manually.

The spec presents these as equivalent alternatives, but in practice roving tabindex wins on three dimensions:

1. **VoiceOver grid/combobox bug**: VoiceOver does not announce the active descendant when `aria-activedescendant` changes on elements with `role="grid"` or `role="combobox"` in iOS Safari and macOS versions. This is documented in the MIND Patterns and Higley's writing. Roving tabindex sidesteps it entirely because VoiceOver tracks real focus correctly.

2. **Auto-scroll-into-view**: Real focus triggers the browser's built-in scroll-focused-element-into-view behavior. `aria-activedescendant` requires `element.scrollIntoView({block: "nearest"})` on every arrow press, and getting the timing right — before paint, after state update — is subtle on React canvases that rerender.

3. **Event model familiarity**: Every other focus-related library (focus-visible polyfill, focus-trap, popover positioning, form validation timing) listens for focus/blur events. Roving tabindex integrates with all of them for free. `aria-activedescendant` bypasses the entire event system and requires custom integration with each one.

The one case `aria-activedescendant` is preferable: virtualized lists where the target element may not exist in the DOM at arrow-press time. Focus cannot move to an element that is not rendered. But for a breadboard's ~830 tie-points — all present in the SVG from mount — this is a non-issue. Render all the cells, use roving tabindex, and let the browser do the focus heavy lifting.

Combine with [[aria-rowindex-and-aria-colindex-let-sparse-grids-announce-position-without-rendering-all-cells]] to communicate position without forcing the DOM to mirror the grid axis-by-axis structure.

---

Source: [[2026-04-19-aria-grid-for-svg-canvas-830-cells]]

Relevant Notes:
- [[aria-grid-pattern-fits-breadboard-terminal-strips-but-not-the-full-canvas-because-power-rails-lack-row-column-semantics]] — the surface this technique applies to
- [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]] — the keyboard contract roving tabindex implements
- [[aria-rowindex-and-aria-colindex-let-sparse-grids-announce-position-without-rendering-all-cells]] — complementary: position announcement without full DOM mirror

Topics:
- [[a11y]]
- [[implementation-patterns]]

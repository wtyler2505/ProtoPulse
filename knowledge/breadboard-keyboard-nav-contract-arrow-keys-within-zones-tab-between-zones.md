---
description: 'The breadboard''s keyboard contract: Tab cycles through the six zones (4 rails + 2 terminal strips); within a zone...'
type: pattern
created: 2026-04-19
topics:
- a11y
- breadboard-intelligence
- maker-ux
- ux-patterns
related_components:
- client/src/components/breadboard/BreadboardCanvas.tsx
- client/src/components/breadboard/useGridKeyboard.ts
---
# Breadboard keyboard nav contract: arrow keys within zones, Tab between zones

The breadboard canvas is divided into six zones (see [[aria-grid-pattern-fits-breadboard-terminal-strips-but-not-the-full-canvas-because-power-rails-lack-row-column-semantics]]), and the keyboard contract has to serve two audiences simultaneously: the keyboard-only sighted user who wants to place a component without touching the mouse, and the screen-reader user who needs every move announced in electrical-topology terms. Both audiences share the same key bindings; the difference is what the screen reader says after each move.

**The contract, full specification:**

| Key | Context | Action | SR announcement (example) |
|-----|---------|--------|---------------------------|
| Tab | Any zone | Move focus to first focus target of next zone (or out of canvas to next toolbar control) | "Upper terminal strip, row 1 column A, empty" |
| Shift+Tab | Any zone | Move to previous zone (or out to previous toolbar control) | "Top negative rail, position 1 of 30, empty" |
| → / ← | Terminal strip | Move one column left/right within same row | "Row 17 column C, LED anode" |
| ↑ / ↓ | Terminal strip | Move one row up/down within same column | "Row 18 column B, empty" |
| → / ← | Power rail | Move one position along the rail (both visual columns treated as one list) | "Top positive rail, position 18 of 30, empty" |
| ↑ / ↓ | Power rail | No-op (power rails are 1D) — emit a subtle audio cue but do not move focus | silence |
| Home | Terminal strip | Move to column A of current row | "Row 17 column A" |
| End | Terminal strip | Move to column E of current row | "Row 17 column E" |
| Ctrl+Home | Terminal strip | Move to row 1, column A | "Row 1 column A" |
| Ctrl+End | Terminal strip | Move to row 63, column E | "Row 63 column E" |
| Home | Power rail | Move to position 1 | "Position 1 of 30" |
| End | Power rail | Move to position 30 | "Position 30 of 30" |
| PageUp / PageDown | Terminal strip | Move 10 rows up/down (clamped) | "Row 7 column B" |
| Enter / Space | Any tie-point | Activate: either place component at cursor, wire from cursor, or open context menu per current tool | "Placing LED anode at row 17 column B" |
| Escape | Any zone | Return focus to canvas toolbar's current-tool button | "Tool selector, wire tool" |
| F6 / Shift+F6 | Any zone | Jump to next/previous canvas region (component palette, canvas, BOM panel) — app-wide landmark cycling | region-label announcement |

**Why Tab between zones (not within):** Roselli's critique of grid role centers on the confusion of "Tab doesn't move to the next control." Our escape hatch: Tab still moves between *logical sections* of the canvas — the six zones are each a "section" in keyboard terms. A user who presses Tab repeatedly visits rail → rail → strip → strip → rail → rail → exit, which matches the mental model of the physical board ("now I'm working on the top rail; now I'm working on the strip"). Within a section, arrow keys take over, matching the grid/list role's arrow-key contract.

**Why no-op on vertical arrows in rails:** The rail is a 1D list. Up/down have no semantic meaning. Mapping them to left/right would violate the least-surprise principle — a user who arrows-up in the top rail expects to escape the canvas, not traverse the rail. We instead emit a subtle sub-audible click (via Web Audio API, respecting `prefers-reduced-motion`) so the user knows the keypress was received and deliberately ignored, not broken.

**Why Escape returns to toolbar, not out of canvas:** A keyboard user who opens a context menu, starts a wire, or enters a placement preview needs an unambiguous "get me out" key that does not exit the entire canvas (losing their zone position). Escape returns to the toolbar; a second Escape from the toolbar exits the canvas entirely. This is the same two-stage exit pattern used by VS Code and Figma.

**Focus restoration:** Each zone remembers the last focused tie-point within it. Tab-leaving and Tab-returning to a zone restores focus to the last position, not the first. This lets a user Tab-cycle quickly through zones without losing their place — critical when wiring a component across zones.

**No focus traps.** The canvas never prevents the user from Tabbing out. The ONLY modal focus trap in the system is dialog-class popovers (component-property editors, confirmation dialogs), which follow the standard Radix focus-trap-return pattern and are explicitly NOT part of this canvas contract.

**Test requirements (goes with implementation):**
1. Playwright: Tab from toolbar enters first zone; six Tabs exit canvas into next landmark.
2. Playwright: arrow keys within terminal strip move by one; arrow-up from row 1 does not wrap, stays at row 1.
3. Playwright: Escape from mid-placement returns focus to toolbar tool button.
4. NVDA: manual walkthrough, verify announcements match table above.
5. Unit test: `useGridKeyboard` hook returns next position per keypress for all edge cases (corners, rail boundaries, Ctrl+Home on rail).

Combine with [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] for the focus-implementation technique and [[aria-grid-pattern-fits-breadboard-terminal-strips-but-not-the-full-canvas-because-power-rails-lack-row-column-semantics]] for the semantic zoning the contract operates over.

---

Source: [[2026-04-19-aria-grid-for-svg-canvas-830-cells]]

Relevant Notes:
- [[aria-grid-pattern-fits-breadboard-terminal-strips-but-not-the-full-canvas-because-power-rails-lack-row-column-semantics]] — the zone taxonomy this contract navigates
- [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] — focus-management implementation detail
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] — prerequisite: focus indicators must be visible for this contract to be usable
- [[multi-channel-severity-encoding-is-the-standard-pattern-for-a11y-compliant-status-ui]] — companion for announcing validation state at a focused tie-point

Topics:
- [[a11y]]
- [[breadboard-intelligence]]
- [[maker-ux]]
- [[ux-patterns]]

---
description: "The breadboard's ~830 tie-points split into six zones — 4 linear power rails and 2 terminal strips (63 rows × 5 columns each); only the terminal strips pass Higley's two-axis semantic test, so grid role applies per-zone, not canvas-wide."
type: architecture-decision
created: 2026-04-19
topics:
  - "[[a11y]]"
  - "[[breadboard-intelligence]]"
  - "[[architecture-decisions]]"
  - "[[maker-ux]]"
related_components:
  - "client/src/components/breadboard/BreadboardCanvas.tsx"
  - "client/src/components/breadboard/TiePoint.tsx"
---

# ARIA grid pattern fits breadboard terminal strips but not the full canvas because power rails lack row-column semantics

The breadboard canvas renders ~830 SVG tie-point holes, and the instinctive fix for the Wave 10 a11y gap is to slap `role="grid"` on the `<svg>` root and be done with it. That fix is wrong on inspection: the breadboard is not a single 2D grid. It is six zones, and only two of them pass the grid-role test.

**The zone taxonomy** (standard half-size breadboard, 830-point layout):

| Zone | Structure | Row-column semantics? | Correct ARIA |
|------|-----------|----------------------|--------------|
| Top-rail + (red) | 2 columns × 30 holes, electrically bonded as one rail | No: column is cosmetic (same net on both sides) | `role="group"` + `aria-label="Top positive rail"`, list of 30 tie-points with `aria-posinset`/`aria-setsize` |
| Top-rail − (blue) | Same | No | Same |
| Bottom-rail + | Same | No | Same |
| Bottom-rail − | Same | No | Same |
| Upper terminal strip | 63 rows × 5 columns (A–E), each row is one electrical net | **Yes**: row = net, column = position within net | `role="grid"` with 63 × 5 = 315 `role="gridcell"` children |
| Lower terminal strip | 63 rows × 5 columns (F–J), each row is one electrical net | **Yes** | Same as upper strip |

The power rails fail Higley's test (see [[highly-interactive-items-without-meaningful-row-column-relationships-are-not-grids]]): the two visual columns are cosmetic because any hole in a rail is electrically bonded to every other hole in that rail. Arrow-left/right between the two columns of a rail has no semantic meaning. A rail is a **1D list of 30 tie-points** with an announcement like "Top positive rail, position 17 of 30."

The terminal strips pass: navigating row 17 → row 18 moves to a different electrical net, navigating column B → column C stays on the same net but at a different position within it. Both axes carry meaning. A terminal strip is a **2D grid** with an announcement like "Upper strip, row 17, column C."

**Why not role="application"?** See [[role-application-suppresses-screen-reader-browse-mode-and-should-be-avoided-for-mixed-content]]. The canvas area also contains component labels, wire overlays, coach-tooltip text, and DRC warning glyphs — browseable content that `role="application"` would hide. Restricting each grid/list role to its zone keeps the canvas as normal browseable content with interactive sub-regions.

**Why not role="grid" on the whole canvas?** See [[aria-grid-role-is-an-anti-pattern-for-anything-that-is-not-a-spreadsheet]]. A canvas-wide grid would force arrow-up from terminal-strip row 1 to land on a power rail, which has no row-column meaning and would require fabricated coordinates. It also prevents the power-rail announcement from using "position 17 of 30" which is the maker-natural phrasing; a grid would force the linear-in-2D-coords lie "row 1 column 17" instead.

**Sparse-DOM strategy**: Every tie-point is always rendered (830 SVG elements is trivial for modern browsers; we already render them all), so we do not need aria-rowcount/aria-colcount tricks from [[aria-rowindex-and-aria-colindex-let-sparse-grids-announce-position-without-rendering-all-cells]] — but we still set the indices defensively because it makes future virtualization (if we ever render a giant prototyping board) a non-breaking change.

**Focus management**: Roving tabindex per zone. See [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]] for the full contract. The canvas root is NOT a tab stop; the first focusable tie-point in each zone is. Users Tab into the canvas, then arrow-navigate within the zone, then Tab out to the next zone.

**Implementation pseudocode** (per zone):

```tsx
// Terminal strip (63 × 5 grid)
<g
  role="grid"
  aria-label="Upper terminal strip, 63 rows, 5 columns"
  aria-rowcount={63}
  aria-colcount={5}
>
  {rows.map((row, rIdx) => (
    <g role="row" aria-rowindex={rIdx + 1} key={row.id}>
      {row.cells.map((cell, cIdx) => (
        <TiePoint
          key={cell.id}
          role="gridcell"
          aria-colindex={cIdx + 1}
          aria-label={`${cellLabel(rIdx, cIdx)}${occupantLabel(cell)}`}
          tabIndex={cell.isFocusTarget ? 0 : -1}
          onKeyDown={handleGridArrowKeys}
        />
      ))}
    </g>
  ))}
</g>

// Power rail (30-item list)
<g
  role="group"
  aria-label="Top positive rail"
>
  {railHoles.map((hole, idx) => (
    <TiePoint
      key={hole.id}
      aria-label={`Top positive rail, position ${idx + 1} of 30${occupantLabel(hole)}`}
      aria-posinset={idx + 1}
      aria-setsize={30}
      tabIndex={hole.isFocusTarget ? 0 : -1}
      onKeyDown={handleRailArrowKeys}
    />
  ))}
</g>
```

The consequence is a more structured implementation — 6 focus zones instead of 1 — but it matches the breadboard's actual electrical topology, which is what a screen-reader user needs to hear.

---

Source: [[2026-04-19-aria-grid-for-svg-canvas-830-cells]]

Relevant Notes:
- [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]] — companion keyboard contract
- [[aria-grid-role-is-an-anti-pattern-for-anything-that-is-not-a-spreadsheet]] — rationale for zone-scoped grid role
- [[role-application-suppresses-screen-reader-browse-mode-and-should-be-avoided-for-mixed-content]] — rationale for not using application role
- [[highly-interactive-items-without-meaningful-row-column-relationships-are-not-grids]] — Higley's test applied per zone
- [[aria-rowindex-and-aria-colindex-let-sparse-grids-announce-position-without-rendering-all-cells]] — sparse-grid defense
- [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] — focus management technique
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] — sibling a11y debt on the same surfaces
- [[precise-real-world-pcb-and-silkscreen-colors-improve-hardware-verification-fidelity-in-virtual-breadboards]] — tension: visual realism priorities vs. a11y semantic structure

Topics:
- [[a11y]]
- [[breadboard-intelligence]]
- [[architecture-decisions]]
- [[maker-ux]]

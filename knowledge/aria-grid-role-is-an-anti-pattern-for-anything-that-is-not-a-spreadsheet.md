---
description: 'Roselli''s rule: `role="grid"` is designed for Excel-class editing surfaces, and applying it to lists, tables-with-clickable-rows...'
type: claim
created: 2026-04-19
topics:
- a11y
- architecture-decisions
- ux-patterns
---
# ARIA grid role is an anti-pattern for anything that is not a spreadsheet

The most common misuse of WAI-ARIA is reaching for `role="grid"` because a UI *looks* gridlike or because the author wants to collapse many tab stops into one. Both motivations produce worse accessibility than doing nothing. Adrian Roselli's empirical testing shows that when a table or list gets `role="grid"` bolted on, screen readers simultaneously announce "grid" and "table" semantics (confusing), lose row/column-position announcements inconsistently (per NVDA/JAWS version), and force keyboard users into arrow-key-only navigation that contradicts the universal "Tab moves to the next control" expectation.

Sarah Higley's complementary criterion sharpens the rule: grids are appropriate when the **primary purpose is interaction** — editing, manipulating, or rapidly traversing content where every cell is a potential action target — AND there is a **meaningful row-column relationship** that users need to navigate along both axes. Both conditions must hold. A spreadsheet passes. A data table with clickable rows fails (only the row matters, not the column; use a list or a plain table). A photo gallery fails (visually 2D but no column semantics). A responsive table fails harder because the carefully crafted arrow navigation becomes meaningless once the layout reflows to a single column on mobile.

The failure mode that bites hardest is subtle: because [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] and similar mistakes are *visible* in code review, they get caught. But `role="grid"` looks like correct ARIA — it passes linters, it passes axe-core's structural checks — and still produces a broken experience. The damage shows up only when a real screen-reader user tries to navigate.

The practical consequence for ProtoPulse: most gridlike surfaces in the app — BOM tables, DRC result lists, procurement cards — should be plain tables or lists, never grids. The ONE place `role="grid"` *might* be defensible is a sub-region of the breadboard canvas where terminal strips genuinely have `row × column` tie-point semantics and keyboard editing is the primary task. Even there, see [[aria-grid-pattern-fits-breadboard-terminal-strips-but-not-the-full-canvas-because-power-rails-lack-row-column-semantics]] for why the canvas as a whole does not qualify.

Roselli's rule of thumb: "Congratulations. You have found an edge or corner case." If you think you need `role="grid"`, you almost certainly do not, and the proof is that native HTML almost always delivers the same UX for free with better screen-reader coverage.

---

Source: [[2026-04-19-aria-grid-for-svg-canvas-830-cells]]

Relevant Notes:
- [[aria-grid-pattern-fits-breadboard-terminal-strips-but-not-the-full-canvas-because-power-rails-lack-row-column-semantics]] — the breadboard case where the rule forces zone-specific decisions
- [[highly-interactive-items-without-meaningful-row-column-relationships-are-not-grids]] — Higley's complementary criterion
- [[role-application-suppresses-screen-reader-browse-mode-and-should-be-avoided-for-mixed-content]] — the other tempting-but-wrong ARIA escape hatch
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] — contrast: visible-in-code-review a11y bug vs. invisible-in-code-review grid misuse

Topics:
- [[a11y]]
- [[architecture-decisions]]
- [[ux-patterns]]

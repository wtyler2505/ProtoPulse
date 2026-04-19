---
description: Topic map for ProtoPulse UX patterns — accessibility-grounded interaction design where every visual affordance has a keyboard path...
type: moc
topics:
- index
- a11y
- architecture-decisions
---
# ux-patterns

ProtoPulse UX patterns codify the ways interactions are composed in this codebase. The organizing principle is that UX and a11y are the same decision, not parallel concerns — every interaction pattern captured here resolves both the sighted-maker ergonomics and the assistive-tech contract in one move. Patterns live here when they are reusable across at least two surfaces; single-surface quirks go in [[gotchas]].

## Synthesis

Three meta-claims run through every pattern below:

1. **Pick the narrowest correct primitive.** Whether choosing between disclosure and dialog, dialog and popover, or severity icon vs color swatch, the pattern that imposes the fewest contracts on its consumers wins. Fewer contracts means fewer regression surfaces — see [[protopulse-uses-dialog-for-modal-and-popover-for-anchored-overlays]] for the modal-vs-anchored cut.
2. **Layered overlays compose LIFO.** Nested dialogs, popovers-in-dialogs, and tooltips-on-triggers-in-popovers all work only when the stack honors last-in-first-out focus and Escape routing — [[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]] is the load-bearing rule.
3. **Every channel must carry meaning independently.** Color alone fails WCAG 1.4.1; position alone fails keyboard-only users; focus alone fails screen readers. [[multi-channel-severity-encoding-is-the-standard-pattern-for-a11y-compliant-status-ui]] generalizes this across icons, text, color, and motion.

## Core Ideas

- [[multi-channel-severity-encoding-is-the-standard-pattern-for-a11y-compliant-status-ui]] — the severity-UI recipe (icon + text + color + optional motion) that keeps status legible across color-vision, screen-reader, and cognitive axes
- [[protopulse-uses-dialog-for-modal-and-popover-for-anchored-overlays]] — the modal-vs-anchored decision rule; picks the right Radix primitive for every overlay
- [[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]] — the LIFO focus-trap contract that makes multi-level overlays survive; foundational to any nested UX
- [[radix-dialog-focus-trap-and-escape-hierarchy]] — implementation pattern for the focus trap plus Escape handling, in the ProtoPulse Radix wrapping layer
- [[popover-trigger-aschild-requires-tooltip-outside-to-avoid-slot-forwarding-collision]] — the trigger-composition gotcha that bites whenever Tooltip wraps a Popover trigger
- [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]] — the zone-based 2D navigation pattern for spatial canvases, borrowed by any grid-like surface
- [[aria-grid-role-is-an-anti-pattern-for-anything-that-is-not-a-spreadsheet]] — the "not everything 2D is a grid" rule that saves designers from importing grid contracts they cannot honor
- [[a11y]] — parent a11y topic map; every UX pattern here answers to WCAG and ARIA criteria catalogued there

## Cross-Cutting Concerns

Patterns in this MOC touch adjacent domains:

- **Testing** — focus-trap and keyboard-nav patterns demand real-browser testing, not JSDOM. See [[testing-patterns]] and specifically [[playwright-focus-trap-testing-requires-real-tab-sequences-not-jsdom]].
- **Implementation** — roving-tabindex vs activedescendant, virtualized grid announcements, and Drizzle transaction patterns all live under [[implementation-patterns]].
- **Gotchas** — surface-specific regressions that don't generalize (yet) collect in [[gotchas]].

## Tensions

- **Composability vs primitive purity.** Composing Tooltip + Popover + Dialog works only when each layer stays in its lane. Every additional layer increases the risk of slot-forwarding collisions like [[popover-trigger-aschild-requires-tooltip-outside-to-avoid-slot-forwarding-collision]]. No clean resolution — just discipline and tests.
- **Motion channel vs prefers-reduced-motion.** Severity encoding can use motion, but motion must respect `prefers-reduced-motion`. The multi-channel rule in [[multi-channel-severity-encoding-is-the-standard-pattern-for-a11y-compliant-status-ui]] includes motion but does not mandate it.

## Open Questions

- Should the UX pattern catalog expand to include form-validation UX (inline vs summary, live vs on-blur)?
- Are there enough canvas-interaction patterns (zoom/pan, selection box, connection-draw) to justify a dedicated canvas-interaction MOC?

## Agent Notes

When building a new interactive component, grep this MOC first for the nearest existing pattern — if a sibling exists, extend it rather than inventing. When in doubt between two patterns, the narrower one wins.

---

Topics:
- [[index]]
- [[a11y]]
- [[architecture-decisions]]

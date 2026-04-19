---
description: ARIA role=tooltip is strictly a description carrier referenced via aria-describedby — it cannot contain buttons, links...
type: claim
audience:
- intermediate
- expert
confidence: verified
created: 2026-04-19
topics:
- a11y
- wcag
- architecture-decisions
- maker-ux
provenance:
- source: W3C WAI-ARIA Authoring Practices Guide — Tooltip Pattern
  url: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
- source: 'MDN — ARIA: tooltip role'
  url: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tooltip_role
- source: Vispero — Tooltips are presentational
  url: https://vispero.com/resources/tooltips-are-presentational/
- source: Radix UI Primitives — Tooltip
  url: https://www.radix-ui.com/primitives/docs/components/tooltip
- source: W3C — WCAG 2.1 SC 1.4.13 Content on Hover or Focus
  url: https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html
---
# ARIA tooltip role is describe-only and cannot contain interactive content

The APG tooltip pattern is the most commonly misused widget in modern UI libraries because its constraints are stricter than the name suggests. A tooltip is **purely descriptive** — it supplements the accessible name of the element it describes, is referenced via `aria-describedby` on the owning element (not `aria-labelledby`, and not on the tooltip itself), and must contain no interactive children. No buttons. No links. No form fields. The moment a "tooltip" contains something focusable, it is structurally a different widget — typically a popover or non-modal dialog — and should carry that role instead.

The behavioral contract is equally rigid. A tooltip MUST appear when its owning element receives keyboard focus, not only on mouse hover — the focus path and the pointer path must trigger the same display. SC 1.4.13 Content on Hover or Focus (WCAG 2.1 Level AA) then adds three requirements for any triggered content (tooltips included): (1) the tooltip must be **dismissible** without moving pointer or keyboard focus, typically via Escape; (2) the tooltip must be **hoverable** — the pointer must be able to traverse from the owning element onto the tooltip without the tooltip disappearing, which constrains implementations that use `mouseout` naively; (3) the tooltip must be **persistent** — it must remain visible until the hover/focus is dismissed, the user dismisses it via Escape, or the information is no longer valid. A tooltip that vanishes after a timeout while the user is still focused on the element fails this SC.

The delay guidance from APG ("one to five seconds typical") applies only to the *appearance* delay, not the dismiss delay. Screen reader users experience zero delay because `aria-describedby` causes the tooltip text to be announced immediately on focus — the visual delay is a UX optimization for sighted users, not an accessibility requirement. Radix's `Tooltip` primitive defaults to a 700ms `delayDuration` and exposes it as a prop; setting it to 0 is acceptable for accessibility but produces a "twitchy" pointer experience. The floor for sighted-user comfort is around 400ms; the ceiling before users lose the connection between trigger and tooltip is around 2000ms.

The "no interactive content" rule is where most codebases regress. If the tooltip needs a close button, a link, a "learn more" control, or any actionable element, it is not a tooltip — it is a popover (anchored overlay, non-modal, clickable contents) or a non-modal dialog. Putting interactive children inside `role="tooltip"` breaks screen readers because (a) the tooltip contents are announced via `aria-describedby`, which flattens them to a text string — buttons and links inside become unlabeled announcements, (b) keyboard focus cannot enter the tooltip because tooltips are meant to dismiss on blur of the trigger, (c) most screen readers do not advertise the tooltip as a landing zone for focus at all. Radix Tooltip is safe here because its `Tooltip.Content` does not accept interactive children in the intended API; codebases that stuff buttons inside anyway create silent failures.

For ProtoPulse, tooltips are the correct primitive for at least these surfaces: the BreadboardLab component hover that shows pin names, the schematic-node hover that shows net impedance, the BOM cell that shows the part's full datasheet URL, the icon-only buttons in the toolbar that need text labels (though here `aria-label` on the button is often sufficient and cheaper than a tooltip). Tooltips are the WRONG primitive for: the "learn more" affordance on a DRC error (contains a link → popover), the help icon that opens a mini-tutorial (contains multiple buttons → dialog), the component-picker preview (contains "add to schematic" action → popover). The architectural discipline is the same as [[aria-disclosure-is-button-plus-aria-expanded-and-anything-more-complex-is-a-different-pattern]]: the narrower the widget's ARIA contract, the fewer ways it can break, so picking the narrowest correct primitive is always better than the most flexible one.

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[protopulse-uses-dialog-for-modal-and-popover-for-anchored-overlays]] — tooltip is the fifth primitive; popover handles anchored+interactive, tooltip handles anchored+describe-only
- [[aria-disclosure-is-button-plus-aria-expanded-and-anything-more-complex-is-a-different-pattern]] — same narrow-contract discipline
- [[popover-trigger-aschild-requires-tooltip-outside-to-avoid-slot-forwarding-collision]] — when both tooltip and popover target the same trigger, the composition order matters

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]

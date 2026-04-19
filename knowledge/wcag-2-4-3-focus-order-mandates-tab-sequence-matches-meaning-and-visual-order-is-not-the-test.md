---
description: "WCAG 2.4.3 Focus Order (Level A) is often summarized as 'Tab order matches visual order' — but the criterion actually says Tab order must match the content's MEANING, which is usually but not always visual order, and CSS flex/grid reordering can create cases where visual and DOM order intentionally diverge in ways that still pass the criterion."
type: claim
audience: [intermediate, expert]
confidence: verified
created: 2026-04-19
topics:
  - "[[a11y]]"
  - "[[wcag]]"
  - "[[architecture-decisions]]"
  - "[[maker-ux]]"
provenance:
  - source: "W3C WCAG 2.1 Understanding SC 2.4.3 Focus Order"
    url: "https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html"
  - source: "W3C WCAG 2.1 Understanding SC 2.4.7 Focus Visible"
    url: "https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html"
---

# WCAG 2.4.3 Focus Order mandates Tab sequence matches meaning and visual order is not the test

SC 2.4.3 Focus Order (Level A) is widely summarized as "Tab order should match visual order" but the criterion text is more precise: "If a Web page can be navigated sequentially and the navigation sequences affect meaning or operation, focusable components receive focus in an order that preserves meaning and operability." The subject is **meaning**, not visual sequence. For the common case of a linear document, meaning and visual order coincide and "Tab matches visual" is a useful proxy. But CSS flex-direction:reverse, CSS grid placement, and `order` properties can legitimately reverse visual order for presentation reasons while DOM order continues to reflect meaning — in which case Tab should follow DOM (meaningful) order, not visual (presentational) order.

The criterion's intent is that users who navigate sequentially encounter content in an order consistent with the author's logical structure. A form where the "Submit" button visually appears before the field labels it validates would be a 2.4.3 concern if Tab reaches Submit before the fields, because the meaningful order is field-first-submit-last. But a marketing layout where a testimonial visually appears to the right of the headline, yet DOM-orders testimonial after headline, is not a 2.4.3 violation — the meaning (headline is primary, testimonial is secondary) is preserved in the Tab sequence. The failure mode is when CSS positioning makes elements *functionally* appear to belong to a different section than DOM order assigns them to — a "Cancel" button positioned visually inside a "Confirm" panel via `position: absolute` but DOM-located in a sibling section fails 2.4.3 because the visual grouping implies a meaning that the Tab order contradicts.

The companion criterion SC 2.4.7 Focus Visible (Level AA) says focus must be visible at all times during keyboard navigation — which is the criterion [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] covers. Together, 2.4.3 and 2.4.7 ensure that keyboard users can (a) see where they are and (b) predict where they will be next. Without 2.4.7, 2.4.3 compliance is invisible to the user; without 2.4.3, 2.4.7 compliance is disorienting. The pair must hold simultaneously.

One often-missed application of 2.4.3 is in modal dialogs with focus traps. The criterion requires the trap sequence — the path through focusable elements inside the modal — to be meaningful, not just that focus stays contained. A modal with Close-button-first, form-fields-in-middle, Submit-last is meaningful (Close provides escape affordance first, form work follows, Submit confirms). A modal with form-fields-first, Submit-middle, Close-last is not meaningful because Tab forces users through the entire form before reaching the affordance to cancel — and users who navigate modals by keyboard routinely want to cancel before committing. ProtoPulse's `ConfirmDialog` and `CreateProjectDialog` must be reviewed for this — placing Close/Cancel after Submit in the Tab sequence is a 2.4.3 concern even though it passes 2.1.2.

The harder case is dynamic content injection. When a disclosed content region appears (via [[aria-disclosure-is-button-plus-aria-expanded-and-anything-more-complex-is-a-different-pattern]]), where does Tab go next after the disclosure button — into the newly-revealed content, or past it to the next sibling? SC 2.4.3 does not mandate either direction explicitly; the APG recommends Tab into the disclosed content because that matches user intent (they just revealed it, they probably want to interact with it). But this is convention, not criterion. The actual 2.4.3 failure would be if Tab unpredictably jumped past the disclosed content into a far-off region with no structural relationship.

For ProtoPulse specifically, the BreadboardLab has a potential 2.4.3 concern in the zone-based navigation from [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]]: if Tab order between zones doesn't match the visual left-to-right, top-to-bottom reading order, users navigating without spatial awareness will struggle. The schematic editor's multi-panel layout (parts palette / canvas / properties) must Tab in a consistent order — palette-to-canvas-to-properties — that matches a mental model users can build, and the order should not flip if panels are reordered visually via CSS grid for a theme change.

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] — companion SC 2.4.7 Focus Visible
- [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]] — 2D canvas zone-order is a 2.4.3 surface
- [[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]] — modal Tab sequence must be meaningful not just contained

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]

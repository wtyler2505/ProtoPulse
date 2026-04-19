---
description: "The ARIA disclosure pattern is the simplest APG widget — a native <button> with aria-expanded and aria-controls — and its power is that it explicitly is NOT a menu, popover, or tooltip, so developers who reach for role=menu to build a disclosure are over-engineering and importing keyboard-interaction bugs that disclosure does not have."
type: claim
audience: [beginner, intermediate, expert]
confidence: verified
created: 2026-04-19
topics:
  - "[[a11y]]"
  - "[[wcag]]"
  - "[[architecture-decisions]]"
  - "[[maker-ux]]"
provenance:
  - source: "W3C WAI-ARIA Authoring Practices Guide — Disclosure Pattern"
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/"
  - source: "W3C APG — Disclosure Navigation Menu Example"
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/"
  - source: "Radix UI Primitives — Collapsible"
    url: "https://www.radix-ui.com/primitives/docs/components/collapsible"
---

# ARIA disclosure is button plus aria-expanded and anything more complex is a different pattern

The APG disclosure pattern has exactly four requirements: (1) the toggle element is a native `<button>` (not a `<div>` with `role="button"` unless native button is impossible — which it almost never is), (2) `aria-expanded="true"` when content is visible and `aria-expanded="false"` when hidden, (3) `aria-controls` pointing at the id of the disclosed region, and (4) Enter and Space both toggle the button. That is the entire pattern. There is no arrow-key handling, no focus trap, no popup, no portal, no `aria-haspopup`, no role on the disclosed content. The disclosed region is just a regular container — a `<div>`, a `<section>`, whatever — with no special ARIA role and no focus management.

This austerity is a feature, not a limitation. Most accessibility regressions in "expandable" UI come from importing menu or dialog semantics into what is structurally a disclosure. Common misfires: putting `role="menu"` on the disclosed container (forcing arrow-key navigation contract and up/down cycling the team didn't implement), adding `aria-haspopup="dialog"` (which tells screen readers to announce "dialog" when the button is focused, then no dialog opens), wrapping in a focus trap (which steals focus from the page). The APG specifically defines disclosure as the pattern that says "this content exists, you can reveal it, no special interaction contract applies once revealed" — picking any other pattern imposes contracts the implementation won't honor.

The distinction from adjacent patterns is sharp: a **popover** is positioned/anchored and may be dismissed by outside-click; a **tooltip** is describe-only and cannot contain interactive children; a **menu** has arrow-key navigation and `role="menuitem"` children; a **dialog** requires a focus trap. A disclosure has none of these. If the revealed content has links and buttons, they are reached by Tab in document order — the disclosure adds no focus semantics at all. Which means [[protopulse-uses-dialog-for-modal-and-popover-for-anchored-overlays]] has a missing third row: disclosure is the primitive for "expands in place, no overlay, no anchoring, no dismiss contract". Radix ships this as `Collapsible` (not `Disclosure`, naming divergence from APG).

Visual design carries one accessibility implication. The chevron or caret that indicates expansion state must be decorative (`aria-hidden="true"`) because the disclosure state is already announced via `aria-expanded`. Leaving the icon exposed produces double-announcement — "Details expanded chevron up" instead of just "Details expanded" — which the W3C guidance explicitly calls out. The icon may rotate via CSS, but its semantic meaning is zero; the truth is in the ARIA attribute.

For ProtoPulse, disclosure is the correct primitive for at least five surfaces that teams commonly over-engineer: the BOM line-item "show full datasheet link list" expand, the component-properties "advanced settings" collapse, the error-panel "show stack trace" expand, the schematic-node "show all nets connected" toggle, and the project-sidebar "show archived files" toggle. Each of these was at some point built or proposed as a Popover or DropdownMenu — with accompanying focus-trap bugs, outside-click bugs, and portal-layering bugs. Collapsible has none of those bugs because it has none of those behaviors. The architectural discipline is: **before reaching for Popover/DropdownMenu/Dialog, ask whether the content just needs to reveal in place with no dismiss contract — if yes, disclosure is always the right answer.**

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[protopulse-uses-dialog-for-modal-and-popover-for-anchored-overlays]] — disclosure is the third primitive in this taxonomy, for in-place-reveal without anchoring or dismissal
- [[aria-combobox-requires-input-plus-popup-because-the-role-alone-does-not-describe-the-widget]] — opposite failure mode: combobox is under-engineered as a plain input, disclosure is over-engineered as a menu

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]

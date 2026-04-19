---
description: APG splits tabs into two variants — automatic activation (panel shown on arrow-key focus) and manual activation (panel shown only on...
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
- source: W3C WAI-ARIA Authoring Practices Guide — Tabs Pattern
  url: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- source: W3C APG — Tabs with Manual Activation Example
  url: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-manual/
- source: W3C APG — Tabs with Automatic Activation Example
  url: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/
- source: Radix UI Primitives — Tabs
  url: https://www.radix-ui.com/primitives/docs/components/tabs
---
# ARIA tabs pattern requires manual activation when panel content is not instantly available

The APG defines three coordinating roles — `tablist` (the strip), `tab` (each clickable header, owned by tablist), and `tabpanel` (the content region). The wiring runs both directions: each `tab` has `aria-controls` pointing at its `tabpanel`'s id, and each `tabpanel` has `aria-labelledby` pointing at its `tab`'s id. Exactly one tab has `aria-selected="true"` at any time; the others have `aria-selected="false"`. This is where most hand-rolled implementations drift — they either omit `aria-selected` entirely (relying on visual highlight, failing SC 4.1.2 Name, Role, Value) or leave stale `aria-selected` values during animated transitions.

Focus management uses roving tabindex, not `aria-activedescendant`: only the active tab has `tabindex="0"`, all others have `tabindex="-1"`. Arrow keys move focus between tabs within the tablist; Tab moves focus *out* of the tablist into the active panel. Home/End jump to the first/last tab. This is why [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] generalizes — tabs, grids, radio groups, and toolbars all share the roving pattern, and the ratio "one container, many children, one child focusable at a time" is the heuristic.

The choice between automatic and manual activation is the architectural decision that drives the rest. **Automatic activation** means pressing Left/Right arrow moves focus *and* immediately displays the corresponding panel. **Manual activation** means arrow keys only move focus; the panel does not change until the user presses Enter or Space. APG's rule is explicit: use manual activation unless panels can be displayed instantly — i.e., all panel DOM already exists, no data fetch occurs, no heavy re-render fires. Automatic activation under any other condition produces (a) screen reader announcement storms as users arrow-through the tablist and each panel load re-announces the page, (b) perceivable lag that makes keyboard navigation feel slower than mouse, and (c) accidental state changes if the panel mutates URL or persists selection.

For ProtoPulse, this means the Settings panel tabs (which show locally-present forms) can use automatic activation safely, but the Documentation tabs (which MDX-lazy-load), the BreadboardLab mode switcher (which triggers a significant canvas remount), and the AI-chat conversation switcher (which refetches history) must use manual activation. Radix's `Tabs` primitive defaults to automatic activation — the `activationMode="manual"` prop flips the behavior and must be set explicitly on every consumer that lazy-loads. Omitting it is the silent regression. The test: arrow-key through the tabs and time each transition against a 100ms budget; anything slower needs manual mode.

A second subtle requirement is that the tabpanel itself must be focusable when its content contains no focusable elements. The APG says this is achieved by giving the tabpanel `tabindex="0"`. If the panel has focusable children (a button, a link), `tabindex="0"` on the panel is redundant and can be omitted — because Tab from the tab itself lands on the first interactive child. Radix's `Tabs.Content` handles this automatically by setting `tabindex="0"` when it detects no focusable descendants, but hand-rolled implementations routinely miss it, producing a dead Tab press that skips the panel entirely. The assumption that "the panel doesn't need focus" is wrong for purely-informational panels, because keyboard users need *some* tabstop to confirm the Tab moved them into the newly-revealed content region, and screen readers need a focus event to re-announce the `aria-labelledby` relationship.

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] — tabs share the roving-tabindex pattern with grids, radio groups, and toolbars
- [[aria-combobox-requires-input-plus-popup-because-the-role-alone-does-not-describe-the-widget]] — contrast: combobox uses aria-activedescendant (text focus must stay on input), tabs use roving tabindex
- [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]] — the "arrow within, Tab between" contract generalizes beyond breadboard to every tablist

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]

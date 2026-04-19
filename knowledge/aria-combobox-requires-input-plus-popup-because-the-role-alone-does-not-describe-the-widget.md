---
description: The ARIA combobox role is a container contract, not a widget...
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
- source: W3C WAI-ARIA Authoring Practices Guide — Combobox Pattern
  url: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- source: W3C APG — Editable Combobox With List Autocomplete Example
  url: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/
- source: 'MDN — ARIA: combobox role'
  url: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/combobox_role
- source: Radix UI Primitives — Select component (NOT a combobox)
  url: https://www.radix-ui.com/primitives/docs/components/select
---
# ARIA combobox requires input plus popup because the role alone does not describe the widget

The ARIA combobox role is the most commonly botched widget in the APG because developers treat `role="combobox"` as a self-contained component, when the spec defines it as a **coordination contract** between two distinct elements: a focusable input that carries the combobox role, and a separate popup that presents suggestions. The popup's own role determines the variant — `listbox` (the 95% case), `grid` (tabular suggestions), `tree` (hierarchical), or `dialog` (rich composite). The combobox role without a popup is meaningless; the popup without the wiring is an orphan. This is why single-node "combobox" components ship broken.

The required wiring, from APG 1.2, is narrower than most implementations: the combobox element (typically `<input type="text">`) carries `role="combobox"`, `aria-expanded` that mirrors popup visibility, `aria-controls` pointing at the popup's id, and **optionally** `aria-autocomplete` set to `list`, `inline`, or `both` when the input suggests completions. DOM focus stays on the input at all times — the popup never receives focus. Instead, screen readers track the "active" suggestion via `aria-activedescendant` on the combobox, which points at the id of the currently highlighted option inside the popup. This inversion — DOM focus on one element, assistive-technology focus on another — is the subtlest part of the pattern and the reason `roving-tabindex` (which [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] prefers for grids) is the *wrong* choice here: combobox input must retain text-editing focus, so `aria-activedescendant` is mandatory, not optional.

The surprise for Radix-first codebases like ProtoPulse is that **Radix Primitives does not ship a Combobox**. The `Select` primitive is a non-editable dropdown built on the button + listbox pattern — it has no text input, no autocomplete, no free-text entry. Confirmed against the Radix docs as of April 2026: `Select.Root`, `Select.Trigger`, `Select.Content`, `Select.Viewport`, `Select.Item` — no combobox primitive. Teams that need editable autocomplete (component part-number search, net-label typeahead, net-color picker) must either (a) compose their own from `Popover` + an `<input>` + manual ARIA wiring, (b) adopt Base UI's `Combobox` (the Radix team's successor library, which does ship a combobox), (c) use Downshift/react-aria-components, or (d) fall back to `<datalist>` where semantics permit. Option (a) is the default trap: hand-rolled comboboxes almost always miss `aria-activedescendant` management on arrow keys, mis-wire `aria-expanded` on outside-click close, or trap focus incorrectly when the popup renders in a portal — the same bugs [[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]] exists to prevent for modals.

Three keyboard behaviors are non-negotiable per APG and will fail automated axe-core runs if missing. **Down Arrow** with a closed popup must open it and move visual highlight to the first (or matched) option without moving DOM focus. **Enter** with a highlighted option must select that option and close the popup. **Escape** must close the popup and restore the pre-open input value when the combobox supports autocomplete — this last rule is the most-missed, because naive implementations treat Escape as a generic dismiss and leave the partially-typed suggestion in the input, violating SC 3.2.2 On Input (value must not change without user action, and arrow-highlighted suggestion was not a user action). Tab must *not* move through individual options; it moves to the next focusable element in the page, because the popup is not a composite widget from the tabindex perspective.

For ProtoPulse specifically, this pattern surfaces in at least four planned features: component library search in BreadboardLab's part-picker, net-name autocomplete in the schematic editor, color/token pickers in the theme panel, and BOM part-number search against the parts database. All four would fail conformance if built with naive `<input>` + absolute-positioned `<ul>` scaffolding. The architectural decision is: **standardize on one combobox solution project-wide, not per-feature**, because `aria-activedescendant` bugs replicate identically across every instance of the pattern and a single source lets [[playwright-focus-trap-testing-requires-real-tab-sequences-not-jsdom]]-style keyboard integration tests cover every consumer at once.

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] — contrasts: grids prefer roving-tabindex, but combobox MUST use aria-activedescendant to keep text focus on the input
- [[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]] — combobox Escape behavior has the same "unwind one level" contract as dialog stacks
- [[protopulse-uses-dialog-for-modal-and-popover-for-anchored-overlays]] — combobox popup is an anchored overlay, so Popover is the primitive to compose combobox on top of in the Radix stack
- [[role-application-suppresses-screen-reader-browse-mode-and-should-be-avoided-for-mixed-content]] — sibling pattern where the correct ARIA role depends on the container semantics

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]

---
description: "The APG listbox pattern forces a pick-one choice between aria-selected (selection is tracked separately from focus) and aria-checked (each option is independently toggleable) — the two cannot coexist on the same listbox, and 'selection follows focus' is an explicit opt-in variant, not the default behavior."
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
  - source: "W3C WAI-ARIA Authoring Practices Guide — Listbox Pattern"
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/listbox/"
  - source: "W3C APG — Listbox Grouped Options Example"
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-grouped/"
  - source: "W3C APG — Scrollable Listbox Example"
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-scrollable/"
---

# ARIA listbox must choose aria-selected or aria-checked never both and selection follows focus is optional

The APG listbox pattern has a less-known but load-bearing constraint: an implementation MUST pick exactly one of two conventions for encoding selection state, and mixing them is a bug that screen readers report inconsistently. Option A: use `aria-selected` on each option, with the listbox carrying `aria-multiselectable="true"` when more than one can be selected. Option B: use `aria-checked` on each option, modeling each as an independent toggle (and omitting `aria-multiselectable`). The APG explicitly recommends "aria-selected for single-select, aria-checked for multi-select" as a default convention but emphasizes this is preference, not mandate — the hard rule is **never specify both attributes on the same listbox**. Implementations that set both (common in libraries that defensively add "all the attributes") produce "selected and checked" double-announcements on NVDA and state confusion on VoiceOver.

The listbox container has `role="listbox"`; each selectable item has `role="option"`. The options MUST be DOM children of the listbox (no wrapping `<div>` between them and the listbox — this breaks the accessibility tree parent-child relationship). `aria-activedescendant` on the listbox points at the currently focused option's id; DOM focus stays on the listbox element, not on individual options. This is the same inversion as in [[aria-combobox-requires-input-plus-popup-because-the-role-alone-does-not-describe-the-widget]] and for the same reason: keeping DOM focus on the container lets keyboard events bubble predictably and avoids the focus-jump flash that roving-tabindex causes on screen magnifiers.

"Selection follows focus" is the APG term for the variant where pressing arrow keys moves focus *and* updates selection in lock-step — the native `<select>` element behaves this way. This is explicitly called an **optional** variant, not the default. The alternative — "select on Space, focus with arrows" — decouples navigation from commitment and is required whenever selection has side effects more expensive than a quick re-render. For a part-picker that shows a detail panel on selection, selection-follows-focus creates "flashing panels" as the user arrows through options and expensive re-renders on every step. The correct pattern for expensive-side-effect listboxes: arrow keys navigate with `aria-activedescendant`, Space or Enter commits selection. The incorrect pattern: arrow keys navigate AND commit. The APG's decision checklist: if navigation between options is faster than the side effect of selecting one, decouple them.

For multi-select specifically, the APG specifies Shift+Space (select range from anchor) and Ctrl+Space (toggle current option without affecting others) as the canonical modifier keys, mirroring desktop conventions. Ctrl+A (select all) is optional but recommended when the listbox is long. A multi-select listbox that only supports mouse clicks with modifiers — no keyboard equivalent — fails WCAG 2.1.1 Keyboard (Level A) outright. This is where ProtoPulse's BOM "select multiple parts to export" feature must be keyboard-operable with these specific modifier combinations, not "click each one while holding Ctrl" as the only path.

The subtle Radix consideration: Radix does not ship a standalone `Listbox` primitive. The `Select` primitive wraps a listbox internally but only exposes single-select semantics. For a multi-select listbox in Radix-first codebases, the options are (a) compose from a container + `role="option"` children + manual keyboard handling, (b) adopt Base UI's `Selector` (which does ship multi-select), or (c) use `Checkbox` inside a custom list for independent-toggle semantics — which is a different pattern, not a listbox. Option (c) is often the right call for ProtoPulse because it reduces to well-understood Checkbox ARIA and avoids the `aria-selected`-vs-`aria-checked` trap entirely. The architectural decision: "multi-select list" is often better modeled as "a list of checkboxes" than as "a listbox with `aria-multiselectable`", because the second pattern's keyboard-modifier contract is complex enough to mis-implement.

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[aria-combobox-requires-input-plus-popup-because-the-role-alone-does-not-describe-the-widget]] — combobox listbox popup uses the same aria-activedescendant focus inversion
- [[aria-grid-role-is-an-anti-pattern-for-anything-that-is-not-a-spreadsheet]] — listbox vs grid choice: 1D selection → listbox, 2D cells → grid
- [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] — contrast: listbox prefers aria-activedescendant, grid prefers roving-tabindex

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]

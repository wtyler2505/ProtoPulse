---
description: "Topic map for accessibility in ProtoPulse — organized by WAI-ARIA widget pattern, WCAG success criteria, screen-reader testing, and Radix-specific gotchas — with a 'pattern selection' decision tree for picking the narrowest correct primitive."
type: moc
created: 2026-04-19
topics:
  - "[[a11y]]"
  - "[[wcag]]"
  - "[[architecture-decisions]]"
  - "[[maker-ux]]"
---

# Topic map: A11y, WCAG, and ARIA patterns

Accessibility is one of ProtoPulse's first-class quality dimensions. This topic map organizes the vault's ARIA-pattern, WCAG-criterion, and screen-reader knowledge into a decision-graph agents can traverse when implementing or auditing any interactive component. The organizing principle is **pick the narrowest correct primitive**: the ARIA pattern that imposes the fewest contracts on its consumers is almost always the right choice, because fewer contracts means fewer ways to regress.

## Synthesis

Three meta-claims cut across every note below:

1. **Implementation without articulation is incomplete.** The vault captures not just "use Radix Dialog for modals" but *why* the focus-trap contract works ([[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]]), *when* it fails ([[oncloseautofocus-must-fallback-when-trigger-is-unmounted]]), and *how* to test it ([[playwright-focus-trap-testing-requires-real-tab-sequences-not-jsdom]]).
2. **ARIA roles are contracts, not decorations.** Every role imposes specific keyboard, focus, and announcement contracts that the implementation must honor. Importing `role="menu"` onto site navigation ([[aria-menu-role-is-for-application-menus-not-navigation-and-importing-it-breaks-web-conventions]]) or `role="grid"` onto a non-tabular canvas ([[aria-grid-role-is-an-anti-pattern-for-anything-that-is-not-a-spreadsheet]]) creates silent regressions.
3. **Automated a11y scanners catch structural violations but not effective ones.** Axe-core validates that `aria-live` is present, not that it is `polite`/`assertive` and firing on time. Real screen-reader testing ([[screen-reader-testing-must-cover-nvda-and-voiceover-minimum-because-jaws-and-nvda-disagree-on-aria-live-timing]]) is the only way to catch the effective failures.

## Pattern Selection Decision Tree

When designing or auditing an interactive component, walk this graph to pick the ARIA pattern:

- **Does it toggle content visibility in place, with no overlay, no dismiss contract?** → disclosure ([[aria-disclosure-is-button-plus-aria-expanded-and-anything-more-complex-is-a-different-pattern]])
- **Does it describe another element, with no interactive children, dismissible on blur?** → tooltip ([[aria-tooltip-role-is-describe-only-and-cannot-contain-interactive-content]])
- **Is it an anchored overlay with interactive children, non-modal, closes on outside click?** → popover ([[protopulse-uses-dialog-for-modal-and-popover-for-anchored-overlays]])
- **Does it require a focus trap, user attention, and dismiss action?** → dialog or alertdialog ([[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]])
- **Does it present mutually-exclusive content panels selected by one of a strip of tabs?** → tabs ([[aria-tabs-pattern-requires-manual-activation-when-panel-content-is-not-instantly-available]])
- **Is it a text input with a suggestions popup?** → combobox ([[aria-combobox-requires-input-plus-popup-because-the-role-alone-does-not-describe-the-widget]])
- **Is it a list of selectable options, no text input?** → listbox ([[aria-listbox-must-choose-aria-selected-or-aria-checked-never-both-and-selection-follows-focus-is-optional]])
- **Is it a hierarchy of expandable nodes?** → tree ([[aria-tree-view-requires-aria-level-aria-posinset-and-aria-setsize-when-nodes-are-virtualized]])
- **Is it an application command palette?** → menu / menubar ([[aria-menu-role-is-for-application-menus-not-navigation-and-importing-it-breaks-web-conventions]])
- **Is it a numeric-range selector?** → slider or spinbutton ([[aria-slider-and-spinbutton-both-require-aria-valuenow-aria-valuemin-aria-valuemax-and-a-valuetext-fallback-for-non-numeric-values]])
- **Is it a status announcement without focus?** → aria-live region ([[radix-toast-ships-aria-live-off-by-default-which-silently-hides-notifications-from-screen-readers]])

## Core Widget Patterns

- [[aria-combobox-requires-input-plus-popup-because-the-role-alone-does-not-describe-the-widget]]
- [[aria-tabs-pattern-requires-manual-activation-when-panel-content-is-not-instantly-available]]
- [[aria-disclosure-is-button-plus-aria-expanded-and-anything-more-complex-is-a-different-pattern]]
- [[aria-tooltip-role-is-describe-only-and-cannot-contain-interactive-content]]
- [[aria-menu-role-is-for-application-menus-not-navigation-and-importing-it-breaks-web-conventions]]
- [[aria-listbox-must-choose-aria-selected-or-aria-checked-never-both-and-selection-follows-focus-is-optional]]
- [[aria-tree-view-requires-aria-level-aria-posinset-and-aria-setsize-when-nodes-are-virtualized]]
- [[aria-slider-and-spinbutton-both-require-aria-valuenow-aria-valuemin-aria-valuemax-and-a-valuetext-fallback-for-non-numeric-values]]
- [[aria-grid-pattern-fits-breadboard-terminal-strips-but-not-the-full-canvas-because-power-rails-lack-row-column-semantics]]
- [[aria-grid-role-is-an-anti-pattern-for-anything-that-is-not-a-spreadsheet]]
- [[aria-rowindex-and-aria-colindex-let-sparse-grids-announce-position-without-rendering-all-cells]]
- [[role-application-suppresses-screen-reader-browse-mode-and-should-be-avoided-for-mixed-content]]
- [[protopulse-uses-dialog-for-modal-and-popover-for-anchored-overlays]]
- [[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]]
- [[radix-dialog-focus-trap-and-escape-hierarchy]]
- [[oncloseautofocus-must-fallback-when-trigger-is-unmounted]]
- [[popover-trigger-aschild-requires-tooltip-outside-to-avoid-slot-forwarding-collision]]

## WCAG Success Criteria

- [[wcag-2-1-1-and-2-1-2-form-a-pair-every-feature-reachable-by-keyboard-and-no-feature-traps-keyboard]] — SC 2.1.1 Keyboard, SC 2.1.2 No Keyboard Trap (Level A)
- [[wcag-2-4-3-focus-order-mandates-tab-sequence-matches-meaning-and-visual-order-is-not-the-test]] — SC 2.4.3 Focus Order (Level A)
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] — SC 2.4.7 Focus Visible (Level AA)
- [[wcag-2-1-sc-1-4-11-requires-focus-indicators-to-hit-3-to-1-contrast-against-adjacent-colors]] — SC 1.4.11 Non-text Contrast (Level AA)
- [[wcag-2-1-sc-1-4-1-color-cannot-be-sole-channel-for-meaning]] — SC 1.4.1 Use of Color (Level A)
- [[wcag-3-2-1-and-3-3-2-prevent-surprise-no-context-change-on-focus-alone-and-every-input-must-be-labeled]] — SC 3.2.1 On Focus, SC 3.3.2 Labels or Instructions (Level A)
- [[wcag-4-1-2-and-4-1-3-define-the-assistive-tech-contract-every-component-has-name-role-value-and-status-messages-announce-without-focus]] — SC 4.1.2 Name Role Value (Level A), SC 4.1.3 Status Messages (Level AA)

## Focus Management

- [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] — when to pick roving-tabindex vs aria-activedescendant
- [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]] — zone-based 2D navigation
- [[playwright-focus-trap-testing-requires-real-tab-sequences-not-jsdom]] — CI test strategy

## Status Messaging

- [[radix-toast-ships-aria-live-off-by-default-which-silently-hides-notifications-from-screen-readers]] — Radix Toast bug and workarounds
- [[multi-channel-severity-encoding-is-the-standard-pattern-for-a11y-compliant-status-ui]] — severity encoding pattern

## Screen Reader Testing

- [[screen-reader-testing-must-cover-nvda-and-voiceover-minimum-because-jaws-and-nvda-disagree-on-aria-live-timing]] — testing priorities and divergences

## Tensions and Open Questions

- **Manual vs automatic tab activation trade-off.** APG says manual when panels lazy-load, automatic when they are present — but ProtoPulse's Settings panel uses localized conditional rendering that blurs the distinction. Needs empirical decision.
- **Toast durations vs VoiceOver idle thresholds.** The 5-second floor may still be too short for VoiceOver in some configurations. Open research question: measure actual announcement latency per screen reader.
- **Grid pattern for 2D canvas.** [[aria-grid-pattern-fits-breadboard-terminal-strips-but-not-the-full-canvas-because-power-rails-lack-row-column-semantics]] establishes that power rails break the grid semantics — the BreadboardLab canvas may need a composite pattern (grid-per-zone + application-mode-wrapper) that does not have a clean APG analog.
- **Mobile screen reader coverage (TalkBack, VoiceOver iOS).** Currently out of scope; revisit when PartScout ships and mobile ProtoPulse becomes real.

## Explorations Needed

- Build a reusable `RangeField` wrapper enforcing all three `aria-value*` attributes as described in [[aria-slider-and-spinbutton-both-require-aria-valuenow-aria-valuemin-aria-valuemax-and-a-valuetext-fallback-for-non-numeric-values]].
- Codify the "disclosure first, dialog last" primitive-selection rule into a lint rule or PR template.
- Add screen-reader-native test harness to CI (NVDA automation via AT-Driver once it stabilizes, VoiceOver-as-a-service on Mac runners).
- Decide combobox strategy codebase-wide: Base UI vs Downshift vs custom Popover composition — pick one, migrate all.

## Agent Notes

When editing any interactive component, grep this topic map for the relevant widget pattern first — the note almost certainly exists, and re-deriving the APG contract from training knowledge risks importing stale or hallucinated behavior. For new patterns not yet captured, consult the W3C WAI-ARIA Authoring Practices Guide at https://www.w3.org/WAI/ARIA/apg/ and the Radix UI Primitives docs at https://www.radix-ui.com/primitives before writing any code.

---

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]

---
description: WCAG 2.1.1 Keyboard (Level A) demands every interactive feature be operable without a pointer...
type: claim
audience:
- beginner
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
- source: W3C WCAG 2.1 Understanding SC 2.1.1 Keyboard
  url: https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html
- source: W3C WCAG 2.1 Understanding SC 2.1.2 No Keyboard Trap
  url: https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html
---
# WCAG 2.1.1 and 2.1.2 form a pair every feature reachable by keyboard and no feature traps keyboard

These two Level A criteria are the bedrock of keyboard accessibility and they must be read together because either alone is insufficient for conformance. SC 2.1.1 Keyboard requires that "all functionality of the content is operable through a keyboard interface without requiring specific timings for individual keystrokes" — every button, link, form control, drag-and-drop interaction, and custom widget must have a keyboard path. The exception is "where the underlying function requires input that depends on the path of the user's movement and not just the endpoints" — which covers freehand drawing and is almost never invoked correctly. Most features developers think are "mouse-essential" (drag-reordering, node-positioning, zoom-to-fit) have well-established keyboard equivalents (Space to grab, arrows to move, Space to drop; Alt+number shortcuts; Home/End/= for zoom reset/fit/100%).

SC 2.1.2 No Keyboard Trap adds the dual constraint: "if keyboard focus can be moved to a component of the page using a keyboard interface, then focus can be moved away from that component using only a keyboard interface." Traps occur most often in (a) embedded third-party iframes (PDF viewers, video players) that capture focus and don't release it, (b) poorly-implemented modal dialogs that focus-trap but lack an Escape handler, (c) custom widgets like comboboxes that open a popup and the Tab key doesn't leave, (d) "spinner" overlays that steal focus while loading and never return it. The criterion explicitly says "if non-standard keys are needed to escape, the user must be informed" — a widget that requires F10 to exit is only conformant if it tells the user to press F10, which almost no such widget does.

The pair interacts with custom-widget design decisions from the APG in specific ways. The modal dialog focus-trap covered in [[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]] is NOT a 2.1.2 violation because Escape provides the escape hatch — the criterion is about unintentional traps, not intentional focus containers with documented exits. Arrow-key-only widgets like menubars and tree views satisfy 2.1.1 because Tab is not the only way to reach every menu item (arrow keys work), and satisfy 2.1.2 because Escape closes the menu returning focus to the menubar button. Combobox satisfies both because Tab leaves the combobox entirely (popup does not consume Tab) and Escape closes the popup.

The testing protocol for both criteria is the same: **unplug the mouse and navigate the entire interface using Tab, Shift+Tab, arrow keys, Enter, Space, and Escape**. For 2.1.1, every interactive element must be reachable and operable. For 2.1.2, no key combination should leave the keyboard user stuck in a region they cannot exit. Automated tools (axe-core, Pa11y) catch structural violations like `tabindex` misuse but cannot detect functional traps — these require manual keyboard-only walkthroughs, which is why [[playwright-focus-trap-testing-requires-real-tab-sequences-not-jsdom]] is load-bearing for ProtoPulse's CI.

For ProtoPulse, the highest-risk surfaces are: the BreadboardLab canvas (large 2D grid — must have arrow-key equivalent to mouse drag, satisfied by zone-based keyboard contract in [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]]), the schematic editor drag-to-connect interaction (must have keyboard equivalent: Space on source pin, arrows to target pin, Space to connect), the component-property drag-to-reorder (must support arrow+modifier keyboard reorder), and any embedded iframe for datasheets or video tutorials (must be testable for focus-release on Tab-out, which typically requires a dismiss button outside the iframe). The architectural implication: features should be designed with the keyboard path first and the mouse layered on, not the other way — retrofitting keyboard support is where 2.1.1 violations compound.

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]] — intentional focus-trap that satisfies 2.1.2 via Escape
- [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]] — 2D canvas keyboard equivalent
- [[playwright-focus-trap-testing-requires-real-tab-sequences-not-jsdom]] — CI testing strategy for 2.1.2
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] — sibling SC 2.4.7 (indicator must exist), which 2.1.1 depends on for discoverability

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]

---
description: Sliders and spinbuttons share the range-widget ARIA contract (aria-valuenow / aria-valuemin...
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
- source: W3C WAI-ARIA Authoring Practices Guide — Slider Pattern
  url: https://www.w3.org/WAI/ARIA/apg/patterns/slider/
- source: W3C WAI-ARIA Authoring Practices Guide — Spinbutton Pattern
  url: https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/
- source: W3C APG — Range-Related Properties guidance
  url: https://www.w3.org/WAI/ARIA/apg/practices/range-related-properties/
- source: MDN — aria-valuenow attribute
  url: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuenow
---
# ARIA slider and spinbutton both require aria-valuenow aria-valuemin aria-valuemax and a valuetext fallback for non-numeric values

Slider and spinbutton are siblings in the APG "range widget" family along with progressbar and scrollbar, and they share the same three required ARIA attributes: `aria-valuenow` (current value, required and must update live), `aria-valuemin` (minimum, required), `aria-valuemax` (maximum, required). Omitting any of the three fails WCAG 4.1.2 Name, Role, Value because screen readers cannot announce the widget's current state relative to its range. The APG is explicit that these properties have **no default values** — if not set, range information is not exposed, period. This is the single most common range-widget bug: a slider renders, the thumb moves, `aria-valuenow` updates, but `aria-valuemin` and `aria-valuemax` were never set, so screen readers announce "slider, 47" with no context about whether 47 is small or large in the scale.

`aria-valuetext` is the required fallback for any range widget whose numeric value doesn't convey meaning on its own. Examples where `aria-valuetext` is mandatory: a date-spinbutton whose `aria-valuenow` is 20250418 (announce "April 18, 2025" instead of twenty-million), a frequency slider whose `aria-valuenow` is 50000 Hz (announce "50 kilohertz"), a rating slider whose values map to labels (announce "Good" for 4, "Excellent" for 5), a resistor-picker spinbutton with SI prefixes (announce "4.7 kilohms" for 4700). The rule: if a sighted user would see "50 kHz" but a screen reader announces "50000", the widget needs `aria-valuetext="50 kilohertz"`. Radix's `Slider` primitive does not set `aria-valuetext` automatically — consumers must provide it via the `getAriaValueText` prop, and the silent-failure mode is that production sliders announce raw numbers to screen readers with no units or formatting.

The keyboard contracts diverge. Slider: Left/Down arrow decrements by a step, Right/Up increments by a step, Home jumps to `aria-valuemin`, End jumps to `aria-valuemax`, Page Down decreases by a larger step (typically 10% of range or a documented larger increment), Page Up increases by a larger step. Spinbutton: Up arrow increments, Down arrow decrements, Home jumps to min, End jumps to max — and there is no Page Up/Down large-step convention in the APG spinbutton pattern. This difference trips up libraries that share a single implementation for "numeric input with buttons" — if the widget supports Page Up/Down, it is behaving as a slider in spinbutton clothing, and screen reader users who try Page Up on a spinbutton get no response.

The orientation matters for sliders specifically. Horizontal sliders (the default) use Left/Right for primary steps. Vertical sliders MUST use Up/Down as primary steps — NOT Left/Right — and the container needs `aria-orientation="vertical"` so screen readers announce the correct axis. The WCAG failure mode: a vertical slider styled vertically but implemented with Left/Right handling is keyboard-operable only by users who already know the visual orientation is a lie.

For ProtoPulse, these primitives appear on at least: component-value selectors (resistor ohms, capacitor farads — spinbuttons with SI-prefix `aria-valuetext`), BreadboardLab zoom control (slider, horizontal, needs Page Up/Down for large steps), AI-chat temperature setting (slider, 0.0-2.0 range, `aria-valuetext` announcing "creative" / "balanced" / "precise" labels rather than raw floats), and PCB-view layer opacity (vertical slider, must use `aria-orientation="vertical"`). The architectural decision: every range widget in the codebase must pass through a shared `RangeField` wrapper that enforces all three `aria-value*` attributes and requires either a numeric formatter or an explicit `aria-valuetext` function — no raw uses of Radix Slider or native `<input type="number">` without the wrapper. The wrapper is how the "silent omission" failure mode is prevented codebase-wide rather than per-consumer.

A final nuance from spinbutton: when the user types an invalid value (outside min/max, or non-numeric), the APG guidance (Issue #704 open) is that `aria-valuenow` should NOT update until validation completes successfully. Setting `aria-valuenow` to the invalid raw input value produces announcements like "spinbutton, abc" that are useless to screen readers and can cause assistive-technology state confusion. The correct behavior: hold the last-valid `aria-valuenow`, display the invalid value visually, and expose validation errors via `aria-invalid="true"` and `aria-describedby` pointing at the error message.

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[aria-combobox-requires-input-plus-popup-because-the-role-alone-does-not-describe-the-widget]] — spinbutton is sibling to combobox in "input + optional dropdown" family but has no popup
- [[wcag-2-1-sc-1-4-1-color-cannot-be-sole-channel-for-meaning]] — slider fill color alone cannot convey value; aria-valuenow is the second channel
- [[multi-channel-severity-encoding-is-the-standard-pattern-for-a11y-compliant-status-ui]] — aria-invalid + aria-describedby pattern for spinbutton error states

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]

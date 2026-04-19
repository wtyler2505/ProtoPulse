---
description: "SC 3.2.1 On Focus (Level A) forbids any 'significant change' triggered solely by focus (no auto-submit, no navigation, no popup) because focus is not a user decision it is a navigational consequence — and SC 3.3.2 Labels or Instructions (Level A) requires every form input to have a persistent label (placeholder-only fails because it disappears on input) so users who tab back can confirm what they are filling in."
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
  - source: "W3C WCAG 2.1 Understanding SC 3.2.1 On Focus"
    url: "https://www.w3.org/WAI/WCAG21/Understanding/on-focus.html"
  - source: "W3C WCAG 2.1 Understanding SC 3.3.2 Labels or Instructions"
    url: "https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html"
---

# WCAG 3.2.1 and 3.3.2 prevent surprise no context change on focus alone and every input must be labeled

SC 3.2.1 On Focus (Level A) prohibits any significant change of context that is triggered "automatically when any user interface component receives focus." The spec enumerates context changes: launching a new window, focusing a different element, moving to a different web page, rearranging the page structure. Focus is not a user decision in the intentional sense — users tab through elements as a navigational consequence, not as a commitment. A dropdown that auto-expands when it receives focus (rather than on click or Enter) is a 3.2.1 violation because keyboard users who are merely tabbing-past get an unexpected popup. A form that auto-submits when the last field is tabbed-out-of is a 3.2.1 violation because the tab-away is not a submission intent.

The subtle case is modals. A modal dialog that opens and receives focus on a link is allowed — the click/Enter activated the link, and the modal opening is the result of that action, with focus transferring as a consequence rather than the cause. The failure mode is when the modal opens merely because the user tabbed to an element, with no activation gesture. Combobox popups are permitted to open on focus only if the author documents this as the expected behavior and screen readers announce the change (aria-expanded update) — but the APG actively recommends against auto-expand-on-focus for combobox because it violates user expectation; open-on-Down-Arrow or open-on-type is the standard pattern.

SC 3.3.2 Labels or Instructions (Level A) requires that "labels or instructions are provided when content requires user input." The criterion is structural: every form input must have a programmatically associated label that screen readers can announce. The common failure is placeholder-only labeling: a search input that has only `placeholder="Search..."` and no `<label>` fails because (a) placeholder text vanishes the moment the user types, removing the only context cue, (b) placeholder contrast is typically below WCAG minimums and cannot be relied on for sighted low-vision users either, and (c) screen readers in some modes do not announce placeholders at all. The fix is a visible label (visible to sighted users, `<label>` element programmatically tied to the input via `for`/`id` or wrapping), or a visually-hidden label (`sr-only` CSS) paired with an `aria-label` attribute.

The criterion extends to non-obvious instructions: a password field that requires "at least 8 characters including a number" needs that rule announced before the user types, not only shown as a validation error after. The instruction should be in a `<span>` linked via `aria-describedby` on the input, so screen readers read the constraint when the input receives focus. Instructions revealed only after failed submission are a 3.3.2 violation because users have already failed once and must retry with corrected values — and the retry experience is worse for screen reader users who may need to dismiss an error announcement before hearing the rule they needed upfront.

The two criteria interact in form design. A form that auto-advances focus to the next field when a fixed-length input completes (a credit-card entry, a one-time-passcode field) is a 3.2.1 concern because focus change is triggered by input completion, not by user action — and the APG OneTimePasswordField guidance is to use a single input with auto-segmentation rather than multiple inputs with auto-advance, because the single-input pattern avoids the 3.2.1 issue entirely. ProtoPulse's number-pad-style quick-entry fields for resistor values, voltage specs, and PIN numbers must be reviewed against this — if they auto-advance on completion, that is a 3.2.1 concern that should be redesigned.

For ProtoPulse form surfaces specifically: every input in the project-create flow, component-property sidebar, settings panel, and AI-chat composer must have a visible or sr-only label — no placeholder-only inputs anywhere. Validation instructions (format rules, range constraints) must be in `aria-describedby`-linked text, not only revealed as errors. Focus-triggered popups, auto-submitting search-as-you-type without explicit activation, and any "focus a field and panel X opens" behavior should be audited against 3.2.1. The test: tab through every form using only keyboard with a screen reader enabled, and confirm (a) every input announces a name and any constraints before the user types, and (b) no element produces a significant context change on focus alone.

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[aria-combobox-requires-input-plus-popup-because-the-role-alone-does-not-describe-the-widget]] — combobox open-on-focus is a 3.2.1 concern
- [[aria-tooltip-role-is-describe-only-and-cannot-contain-interactive-content]] — tooltip ON focus is permitted because it is a description, not a context change
- [[multi-channel-severity-encoding-is-the-standard-pattern-for-a11y-compliant-status-ui]] — error announcement pattern for form validation

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]

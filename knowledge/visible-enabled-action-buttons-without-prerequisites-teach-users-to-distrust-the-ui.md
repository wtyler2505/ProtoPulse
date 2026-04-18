---
description: Buttons that look clickable but fail on click train users that the UI lies — disabled-plus-tooltip teaches the prerequisite instead, converting a punishment into a lesson
type: claim
created: 2026-04-18
topics:
  - "[[maker-ux]]"
---

# visible enabled action buttons without prerequisites teach users to distrust the ui

On the Arduino Workbench, Verify and Upload are rendered enabled even when Board Profile is "None selected". Click Verify, get an error. Click Upload, get an error. Each click is a small betrayal — the UI said this action was available, and it wasn't.

The immediate cost is wasted clicks. The compounding cost is that the user learns: **buttons in this app are not trustworthy signals**. From then on, every action is tentative. "Let me try it and see" replaces "this should work." That's a fundamental loss of interface affordance — the whole point of a button is that it's a promise.

The alternative costs one CSS class and one tooltip. Disable the button while prerequisites are unmet. Add hover text: "Select a board profile first". Now the same UI state communicates three things the enabled-but-failing version doesn't:
1. This action exists and has a location you can find later.
2. You can't do it right now.
3. Here's the single thing that unlocks it.

The user never clicks and fails. Instead they learn the prerequisite chain. That's the UI teaching the domain model.

Since [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]], the philosophy is that the tool prevents errors proactively. Enabled-button-that-fails is the opposite — it lets the user commit the error and then punishes them for it. The ProtoPulse posture should be: if the action can't succeed, the UI says so before the click, not after.

The anti-pattern generalizes beyond Arduino: any time a button depends on prerequisite state, the prerequisite status should be visible in the button itself (disabled + tooltip), not discoverable by failure.

---

Source: [[2026-04-18-e2e-arduino-tab-tested]]

Relevant Notes:
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] — same philosophy applied to a different surface
- [[trust-receipts-should-pair-with-a-guided-setup-path-or-they-surface-problems-without-fixing-them]] — trust receipt surfaces the prerequisite; disabled buttons enforce it at the action

Topics:
- [[maker-ux]]

---
description: Trust receipts like Arduino's "SETUP REQUIRED" panel build credibility through transparency but leave the user stranded at the problem; a Setup Wizard CTA converts diagnosis into a resolution path without losing the transparency
type: claim
created: 2026-04-18
topics:
  - "[[maker-ux]]"
---

# trust receipts should pair with a guided setup path or they surface problems without fixing them

The Arduino Workbench trust receipt is exemplary transparency. It lists every precondition — CLI version, workspace, board profile, port, device detection, port safety, sketch file — with a plain-language status and an honest top-line verdict: "SETUP REQUIRED — toolchain not trustworthy yet." No hidden state. No optimistic placeholder. The user knows exactly where they stand.

That's the best kind of diagnosis. It's also, by itself, a dead end.

A beginner reading "SETUP REQUIRED" now has seven unchecked items and no obvious first move. The receipt tells them *what* is wrong but not *what to do*. Sophisticated users can sequence the items themselves (board profile before port, port before sketch). Beginners — the target audience of a maker-first EDA tool — cannot. So the transparency that inspires trust also surfaces a problem the UI refuses to help solve.

The fix is additive, not corrective. Keep the trust receipt. Add a "Setup wizard" CTA that walks the user Profile → Port → first sketch in order, reading the receipt's own state to pick the next step. The receipt remains the source of truth; the wizard becomes the action layer. Transparency and agency, instead of transparency or agency.

Since [[architecture-first-bridges-intent-to-implementation]], the ProtoPulse thesis is that intent-to-hardware has too many intermediate steps for beginners to chain alone. The trust receipt identifies which step is missing. The wizard completes it. Without the wizard, the receipt is a symptom of the same problem it diagnoses: the tool showing what's wrong while assuming the user can fix it.

The pattern generalizes: **any diagnostic surface that shows unchecked preconditions should either auto-resolve them or offer a guided path to resolve them.** Pure diagnosis is a librarian who tells you the book is missing without saying where to find another copy.

---

Source: [[2026-04-18-e2e-arduino-tab-tested]]

Relevant Notes:
- [[architecture-first-bridges-intent-to-implementation]] — beginners describe intent, not topology; the same principle says they shouldn't sequence setup steps alone
- [[skeleton-loading-without-status-text-reads-as-broken-during-multi-second-waits]] — both are failures to preserve the user's mental model during transitional states
- [[visible-enabled-action-buttons-without-prerequisites-teach-users-to-distrust-the-ui]] — the wizard enforces at the action layer what the receipt observes at the state layer

Topics:
- [[maker-ux]]

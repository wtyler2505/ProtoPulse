---
description: Blank skeletons that persist 2s+ get interpreted as failure, but a one-line status ("Connecting to Arduino CLI…") converts the same wait into perceived progress without changing duration
type: claim
created: 2026-04-18
topics:
  - "[[maker-ux]]"
---

# skeleton loading without status text reads as broken during multi-second waits

Skeleton UI was designed to replace spinners for fast loads — the bones of the layout appear, content fills in, and perceived latency drops. That story works when the load is sub-second. It collapses at 3-5 seconds because a motionless skeleton is indistinguishable from a hung render.

On the Arduino Workbench, the skeleton held for roughly four seconds before the trust receipt resolved. The user has no information during that window. Did the page freeze? Is the Arduino CLI down? Did I click the wrong thing? The skeleton promises imminent content and then doesn't deliver — which is worse than a spinner, because spinners at least say "something is working."

The fix is not to make the load faster. The fix is to replace the silent skeleton with a status line: "Connecting to Arduino CLI…", "Checking workspace…", "Reading board profile…". Same duration, different experience — because the user now has a model of what's happening and can distinguish "working" from "broken."

Since [[makers-need-one-tool-because-context-switching-kills-momentum]], any moment of "is this thing even working?" pushes the user toward the other tab they still have open. Silent multi-second skeletons are that moment.

The deeper principle: **progress indication is about the user's mental model, not the machine's state.** A honest status text that lies slightly about granularity ("Connecting…" even if multiple things happen) serves the user better than a pristine skeleton that tells them nothing.

---

Source: [[2026-04-18-e2e-arduino-tab-tested]]

Relevant Notes:
- [[makers-need-one-tool-because-context-switching-kills-momentum]] — explains why multi-second dead-air costs retention
- [[trust-receipts-should-pair-with-a-guided-setup-path-or-they-surface-problems-without-fixing-them]] — the Arduino page already loads a trust receipt; status text is its preamble

Topics:
- [[maker-ux]]

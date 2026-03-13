---
summary: The C1-C5 complexity scale measures how many systems, decisions, and failure modes are entangled — not how many hours the work takes
category: convention
areas: ["[[index]]"]
related insights:
  - "[[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — integration items rate C4-C5 because they have high decision surface area"
  - "[[epic-decomposition-is-required-when-a-single-backlog-row-cannot-communicate-scope]] — high-complexity items are the ones most likely to need epic decomposition"
  - "[[five-architecture-decisions-block-over-30-downstream-features-each]] — blocking decisions are C5 because they have maximum decision surface area"
created: 2026-03-13
---

ProtoPulse's backlog distinguishes complexity from effort explicitly. A C1 item might take a day but affects one file. A C5 item might also take a day but requires resolving data ownership across 4 subsystems. This distinction drives wave planning quality because it predicts where surprises will occur, not where time will be spent.

The C1-C5 scale proved mechanically applicable at scale: Codex successfully applied complexity ratings to all 493 backlog items in a single scripted pass, demonstrating that the rating criteria are objective enough for automated assessment rather than requiring per-item engineering judgment. This validates the scale's design — it measures observable structural properties (number of affected systems, decision dependencies, failure mode count) rather than subjective difficulty estimates.

## Topics

- [[index]]

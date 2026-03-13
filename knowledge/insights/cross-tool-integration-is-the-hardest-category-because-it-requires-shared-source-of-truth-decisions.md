---
summary: Integration work consistently rates C4-C5 complexity because it forces deferred data ownership questions about which domain holds truth
category: architectural-decision
areas: ["[[index]]"]
related insights:
  - "[[wave-based-development-enables-rapid-shipping-but-creates-integration-debt]] — vertical slices defer the data ownership questions integration forces"
  - "[[complexity-ratings-measure-decision-surface-area-not-effort]] — integration items rate C4-C5 because they have high decision surface area, not high effort"
  - "[[circuits-zero-defaulting-in-export-and-ordering-is-a-latent-multi-project-regression-because-it-silently-picks-the-wrong-circuit]] — a concrete example of a deferred cross-tool data ownership question"
  - "[[five-architecture-decisions-block-over-30-downstream-features-each]] — unresolved architecture decisions are the root cause of deferred integration"
created: 2026-03-13
---

Every cross-tool integration in ProtoPulse forces the same question: which domain owns the data? When schematic changes propagate to BOM, who holds truth? When simulation results annotate the schematic, where does the annotation live? These data ownership questions have been systematically deferred during vertical-slice development, making integration the hardest work category regardless of implementation effort.

## Topics

- [[index]]

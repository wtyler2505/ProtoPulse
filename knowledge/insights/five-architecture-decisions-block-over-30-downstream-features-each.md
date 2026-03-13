---
summary: Firmware execution model, hardware debugger, multi-platform scope, collaboration model, and supplier trust each block 5+ dependent backlog items
category: architectural-decision
areas: ["[[index]]"]
related insights:
  - "[[browser-based-eda-hits-a-platform-boundary-at-firmware-execution]] — the platform constraint behind the firmware execution decision"
  - "[[the-hybrid-runtime-architecture-for-firmware-is-the-only-viable-path-because-browser-only-wasm-and-pure-local-approaches-each-sacrifice-a-core-value-proposition]] — the resolution of one of these five decisions"
  - "[[phased-collaboration-delivery-must-sequence-session-hardening-before-membership-before-branching-because-each-layer-depends-on-the-one-below]] — the delivery sequence for the collaboration architecture decision"
  - "[[complexity-ratings-measure-decision-surface-area-not-effort]] — these items are C5 because they have maximum decision surface area, not maximum effort"
  - "[[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — blocking decisions are the root cause of deferred integration work"
created: 2026-03-13
---

Five unresolved architecture decisions act as bottlenecks across the backlog: browser-only vs local helper for firmware, hardware debug interface choice, collaboration data model, supplier API trust level, and multi-platform scope (desktop app vs browser-only). Each blocks a chain of 5+ dependent features. The backlog explicitly marks these as requiring spike-first ADRs before implementation can begin.

## Topics

- [[index]]

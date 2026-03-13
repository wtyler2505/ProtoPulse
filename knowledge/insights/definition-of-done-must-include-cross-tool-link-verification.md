---
summary: Isolated feature completion is not actual completion — DoD requires checking cross-tool links, navigation, and synchronization paths
areas: ["[[index]]"]
related insights:
  - "[[the-gap-between-feature-exists-and-feature-is-wired-is-the-dominant-source-of-broken-workflows]] — the problem this DoD expansion directly addresses"
  - "[[wave-based-development-enables-rapid-shipping-but-creates-integration-debt]] — the development model that makes this DoD clause necessary"
  - "[[backlog-summary-statistics-must-be-updated-atomically-with-individual-item-status-changes-or-the-single-source-of-truth-becomes-untrustworthy]] — another example of atomic completeness requirements: partial updates erode trust"
created: 2026-03-13
---

ProtoPulse's definition of done explicitly includes: "Any affected cross-tool links, navigation, or synchronization paths were checked for regressions." This was added because the wiring debt pattern showed that features marked as "done" frequently broke workflows in other views. A component editor change that doesn't check schematic impact isn't done.

## Topics

- [[index]]

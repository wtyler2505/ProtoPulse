---
summary: Export and ordering paths that default to circuits[0] without user selection will silently export the wrong circuit as multi-circuit designs become common
areas: ["[[index]]"]
related insights:
  - "[[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — a concrete example of a deferred cross-tool data ownership question"
  - "[[soft-deletes-create-a-persistent-querying-tax-where-forgetting-isNull-causes-data-ghosts]] — both are silent-failure patterns where wrong defaults produce incorrect results without errors"
  - "[[manufacturing-trust-requires-real-data-because-fake-confidence-is-worse-than-no-confidence]] — exporting the wrong circuit without warning is another form of false confidence"
created: 2026-03-13
---

Several ProtoPulse export and PCB ordering paths default to `circuits[0]` when no explicit circuit selection is provided. In the current single-circuit-per-project reality, this works fine. But as ProtoPulse moves toward multi-circuit projects (hierarchical designs, multi-board systems), this default becomes a data-integrity bug: the wrong circuit gets exported, ordered, or simulated without any warning. The fix is not simply adding a circuit selector — it's deciding whether the export/order context should always be explicit (user selects) or contextual (use the currently-viewed circuit). This is a cross-tool integration decision because it affects exports, ordering, simulation, and DRC simultaneously.

## Topics

- [[index]]

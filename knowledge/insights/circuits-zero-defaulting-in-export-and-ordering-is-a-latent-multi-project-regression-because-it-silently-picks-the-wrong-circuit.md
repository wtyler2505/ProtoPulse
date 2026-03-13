---
summary: Export and ordering paths that default to circuits[0] without user selection will silently export the wrong circuit as multi-circuit designs become common
areas: ["[[index]]"]
created: 2026-03-13
---

Several ProtoPulse export and PCB ordering paths default to `circuits[0]` when no explicit circuit selection is provided. In the current single-circuit-per-project reality, this works fine. But as ProtoPulse moves toward multi-circuit projects (hierarchical designs, multi-board systems), this default becomes a data-integrity bug: the wrong circuit gets exported, ordered, or simulated without any warning. The fix is not simply adding a circuit selector — it's deciding whether the export/order context should always be explicit (user selects) or contextual (use the currently-viewed circuit). This is a cross-tool integration decision because it affects exports, ordering, simulation, and DRC simultaneously.

## Topics

- [[index]]

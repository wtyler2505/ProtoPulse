---
summary: Features implemented as isolated libraries but never connected to UI or cross-tool flows cause the majority of user-visible broken workflows
areas: ["[[index]]"]
created: 2026-03-13
---

ProtoPulse's wave-based development ships vertical slices efficiently but systematically defers horizontal integration. Collaboration, breadboard, PCB undo, Arduino serial — all were "implemented" in their waves but broken in practice because they weren't wired into the UI or connected to dependent features. Wave 37 was entirely dedicated to wiring 24 unintegrated library modules. This pattern suggests integration is a first-class deliverable, not an afterthought.

## Topics

- [[index]]

---
summary: Features implemented as isolated libraries but never connected to UI or cross-tool flows cause the majority of user-visible broken workflows
areas: ["[[index]]"]
created: 2026-03-13
---

ProtoPulse's wave-based development ships vertical slices efficiently but systematically defers horizontal integration. Collaboration, breadboard, PCB undo, Arduino serial — all were "implemented" in their waves but broken in practice because they weren't wired into the UI or connected to dependent features. Wave 37 quantifies the cost: 24 unintegrated library modules required 5 new ViewModes (kanban, knowledge, viewer_3d, community, ordering), 8 panel integrations into existing views, and ~6400 lines of pure wiring code with zero new logic. This pattern suggests integration is a first-class deliverable, not an afterthought — and that "feature complete" must mean "wired and reachable," not just "module exists."

## Topics

- [[index]]

---
summary: Features backed by localStorage appear complete in the UI but silently break on multi-device, collaboration, backup/restore, and project portability scenarios
areas: ["[[index]]"]
created: 2026-03-13
---

ProtoPulse's gap audit discovered 6+ features that appear complete in the UI but store state exclusively in localStorage: Kanban boards, design variables, community library collections, custom DRC scripts, keyboard shortcut overrides, and PCB ordering history. Each passes visual inspection — the feature works, the UI renders, interactions respond. But none survive device switching, project collaboration, backup/restore, or project portability. This creates a false-positive "done" signal that degrades trust in the backlog's completion tracking. The pattern is a third form of integration debt: the feature IS wired to UI, IS discoverable, but ISN'T durable or multi-user. The fix is systematic migration to project-scoped server storage with localStorage as an offline cache layer.

## Topics

- [[index]]

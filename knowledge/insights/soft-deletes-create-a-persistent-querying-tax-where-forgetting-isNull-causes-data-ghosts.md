---
summary: Four tables use deletedAt soft-delete pattern, and every query must remember isNull(deletedAt) or deleted records appear as ghost data
areas: ["[[index]]"]
created: 2026-03-13
---

Projects, architecture_nodes, architecture_edges, and bom_items use soft deletes via a `deletedAt` timestamp column. Every Drizzle query touching these tables must include `isNull(deletedAt)` in its WHERE clause. Forgetting this filter doesn't cause errors — it causes ghost data where deleted items silently reappear in results. This is called out as a gotcha in multiple docs because the failure mode is silent corruption, not a crash.

## Topics

- [[index]]

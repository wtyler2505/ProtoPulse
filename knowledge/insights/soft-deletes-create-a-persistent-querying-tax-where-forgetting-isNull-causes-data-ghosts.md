---
summary: Four tables use deletedAt soft-delete pattern, and every query must remember isNull(deletedAt) or deleted records appear as ghost data
category: gotcha
areas: ["[[index]]"]
related insights:
  - "[[in-memory-server-state-is-an-authorization-bypass-because-it-shares-a-single-namespace-across-all-users-and-projects]] — both are patterns where a missing filter clause causes silent data leakage"
  - "[[circuits-zero-defaulting-in-export-and-ordering-is-a-latent-multi-project-regression-because-it-silently-picks-the-wrong-circuit]] — both are silent-failure patterns: wrong defaults, no errors"
created: 2026-03-13
---

Projects, architecture_nodes, architecture_edges, and bom_items use soft deletes via a `deletedAt` timestamp column. Every Drizzle query touching these tables must include `isNull(deletedAt)` in its WHERE clause. Forgetting this filter doesn't cause errors — it causes ghost data where deleted items silently reappear in results. This is called out as a gotcha in multiple docs because the failure mode is silent corruption, not a crash.

---

Related:
- [[in-memory-server-state-is-an-authorization-bypass-because-it-shares-a-single-namespace-across-all-users-and-projects]] — both are patterns where a missing filter clause causes silent data leakage
- [[circuits-zero-defaulting-in-export-and-ordering-is-a-latent-multi-project-regression-because-it-silently-picks-the-wrong-circuit]] — both are silent-failure patterns: wrong defaults, no errors
- [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary]] — soft-deleted entities have both ID types; forgetting `isNull(deletedAt)` resurrects entries in both serial PK and text ID lookups
- [[crdt-merge-uses-intent-preserving-rules-where-insert-always-beats-concurrent-delete-a-deliberate-philosophical-choice]] — "insert beats delete" CRDT rule may un-set `deletedAt`, requiring careful coordination with soft-delete semantics

## Topics

- [[index]]

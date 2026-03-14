---
summary: Every domain entity has a serial PK for DB foreign keys AND a text application ID (nodeId, edgeId) for client logic, creating a two-key system with different lookup semantics
type: pattern
---

# The schema uses dual ID systems: serial for DB references, text for client-generated UUIDs

In `shared/schema.ts` (see [[the-schema-insert-pattern-uses-omit-plus-extend-to-create-a-strict-write-contract-while-the-select-type-remains-permissive|omit+extend insert pattern]] for the write contract on these same tables), most domain entities carry two identity keys:

- **`id: serial("id").primaryKey()`** — auto-increment integer, used for all database foreign key relationships (e.g., `circuitInstances.partId` references `componentParts.id`)
- **`nodeId: text("node_id")`**, **`edgeId: text("edge_id")`** — client-generated UUIDs (via `crypto.randomUUID()`), used by the React Flow canvas, diff engines, and AI tools

The diff engines match on text IDs (`nodeId`, `edgeId`), not serial IDs. The storage layer queries by serial `id` for CRUD but by text `nodeId`/`edgeId` for upserts. The `uniqueIndex("uq_arch_nodes_project_node").on(table.projectId, table.nodeId)` ensures uniqueness within a project for the text ID.

This dual-key design exists because:
1. React Flow needs stable string IDs that survive client-side operations before server persistence
2. Database foreign keys need integer PKs for performance and referential integrity
3. AI tools reference nodes by `nodeId` (the label users see), not by internal serial `id`

The tension: code must always be clear about which ID it means. Routes like `/api/architecture-nodes/:id` use the serial PK, but the React Flow graph, [[three-diff-engines-share-identical-algorithm-shape-but-are-not-abstracted-creating-a-subtle-maintenance-trap|diff engines]], and AI action parameters use text IDs. Confusing them causes silent data corruption (fetching the wrong entity) rather than hard errors. This is compounded by [[jsonb-columns-are-a-schema-escape-hatch-that-trades-db-level-validation-for-flexibility-creating-a-zod-bridged-type-boundary|JSONB columns]] where AI tools store structured data referencing text IDs, but the DB has no referential integrity on those references.

**Tables with dual IDs:** `architectureNodes` (id + nodeId), `architectureEdges` (id + edgeId), `circuitInstances` (id + referenceDesignator), `circuitNets` (id + name), `componentParts` (id + nodeId).

**Tables with single serial ID only:** `users`, `sessions`, `apiKeys`, `validationIssues`, `chatMessages`, `historyItems`, `bomItems`, `simulationResults`, `pcbOrders`, `pcbZones`, `circuitVias`, `circuitWires`.

The pattern: entities that exist on a visual canvas or are referenced by the AI system have dual IDs. Pure data records have serial-only.

The serial IDs are also what [[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths|IDOR vulnerabilities]] exploit — global serial IDs in URL paths without project scoping allow cross-tenant access.

---

Related:
- [[the-schema-insert-pattern-uses-omit-plus-extend-to-create-a-strict-write-contract-while-the-select-type-remains-permissive]] — the write contract built on top of these same dual-ID tables
- [[three-diff-engines-share-identical-algorithm-shape-but-are-not-abstracted-creating-a-subtle-maintenance-trap]] — diff engines match on text IDs (nodeId/edgeId), not serial IDs
- [[jsonb-columns-are-a-schema-escape-hatch-that-trades-db-level-validation-for-flexibility-creating-a-zod-bridged-type-boundary]] — JSONB columns store text ID references without DB-level referential integrity
- [[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths]] — global serial IDs in routes are the IDOR attack surface
- [[soft-deletes-create-a-persistent-querying-tax-where-forgetting-isNull-causes-data-ghosts]] — another schema-level pattern that creates silent failure modes on the same tables
- [[every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation]] — componentParts uses dual IDs (id + nodeId) to bridge DB storage and canvas rendering across three views

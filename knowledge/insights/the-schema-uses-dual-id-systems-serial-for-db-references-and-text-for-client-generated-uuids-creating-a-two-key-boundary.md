---
summary: Every domain entity has a serial PK for DB foreign keys AND a text application ID (nodeId, edgeId) for client logic, creating a two-key system with different lookup semantics
type: pattern
---

# The schema uses dual ID systems: serial for DB references, text for client-generated UUIDs

In `shared/schema.ts`, most domain entities carry two identity keys:

- **`id: serial("id").primaryKey()`** — auto-increment integer, used for all database foreign key relationships (e.g., `circuitInstances.partId` references `componentParts.id`)
- **`nodeId: text("node_id")`**, **`edgeId: text("edge_id")`** — client-generated UUIDs (via `crypto.randomUUID()`), used by the React Flow canvas, diff engines, and AI tools

The diff engines match on text IDs (`nodeId`, `edgeId`), not serial IDs. The storage layer queries by serial `id` for CRUD but by text `nodeId`/`edgeId` for upserts. The `uniqueIndex("uq_arch_nodes_project_node").on(table.projectId, table.nodeId)` ensures uniqueness within a project for the text ID.

This dual-key design exists because:
1. React Flow needs stable string IDs that survive client-side operations before server persistence
2. Database foreign keys need integer PKs for performance and referential integrity
3. AI tools reference nodes by `nodeId` (the label users see), not by internal serial `id`

The tension: code must always be clear about which ID it means. Routes like `/api/architecture-nodes/:id` use the serial PK, but the React Flow graph, diff engines, and AI action parameters use text IDs. Confusing them causes silent data corruption (fetching the wrong entity) rather than hard errors.

**Tables with dual IDs:** `architectureNodes` (id + nodeId), `architectureEdges` (id + edgeId), `circuitInstances` (id + referenceDesignator), `circuitNets` (id + name), `componentParts` (id + nodeId).

**Tables with single serial ID only:** `users`, `sessions`, `apiKeys`, `validationIssues`, `chatMessages`, `historyItems`, `bomItems`, `simulationResults`, `pcbOrders`, `pcbZones`, `circuitVias`, `circuitWires`.

The pattern: entities that exist on a visual canvas or are referenced by the AI system have dual IDs. Pure data records have serial-only.

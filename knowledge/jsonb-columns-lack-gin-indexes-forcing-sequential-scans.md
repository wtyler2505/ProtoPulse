---
description: "components and architecture_nodes JSONB columns have no GIN indexes — any property-based query forces a full sequential scan across TOASTed blobs"
type: debt-note
source: "conductor/comprehensive-audit.md §4"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["shared/schema.ts", "server/storage.ts"]
---

# JSONB columns lack GIN indexes so property-based queries force sequential scans across TOAST tables

The `components` and `architecture_nodes` tables store arbitrary component data in `jsonb` columns (connectors, properties). Large JSON objects get moved out-of-line into TOAST tables, causing hidden I/O spikes. Without GIN (`jsonb_path_ops`) indexes, any query filtering by property (e.g., "all 10kΩ resistors") forces PostgreSQL into a catastrophic sequential scan.

Drizzle ORM best practices dictate that frequently queried JSON keys (like component `status` or `value`) should be promoted to Generated Columns with standard B-Tree indexes (`.generatedAlwaysAs(...)`). All metadata is currently buried inside the JSON blob, making fast filtering impossible.

---

Relevant Notes:
- [[drizzle-orm-was-chosen-for-type-safe-zod-integration]] -- Drizzle chosen for type safety but JSONB indexing not leveraged

Topics:
- [[architecture-decisions]]

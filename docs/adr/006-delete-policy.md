# ADR-006: Soft-Delete vs Hard-Delete Policy

**Status:** Accepted
**Date:** 2026-03-02
**Deciders:** Tyler
**Tracking:** CAPX-DATA-01

## Context

ProtoPulse manages 19 database tables with two distinct deletion patterns: soft-delete (`deletedAt` timestamp) and hard-delete (`db.delete()`). The choice was made implicitly during development, resulting in some inconsistencies. This ADR formalizes the policy and documents the audit findings.

The core tension: user-created design data should be recoverable (undo, audit trail, compliance), while system/transient data has no preservation value and should be cleaned up promptly to avoid unbounded growth.

## Decision

### The Rule

**User-created content = soft-delete. System/transient data = hard-delete.**

More precisely:

| Category | Delete Method | Rationale |
| -------- | ------------- | --------- |
| **Design artifacts** — data the user intentionally created as part of their project design | Soft-delete (`SET deletedAt = now()`) | Supports undo, audit trail, future "trash" UI, data recovery |
| **System/session data** — authentication tokens, computed results, logs, settings | Hard-delete (`DELETE FROM`) | No user expectation of recoverability; unbounded growth risk |
| **Transient operational data** — validation issues, chat messages, history items | Hard-delete (`DELETE FROM`) | Regenerated on demand; no unique user-authored content |

### Table Classification

#### Soft-Delete Tables (4 tables)

These tables have a `deletedAt` column. All queries MUST filter with `isNull(deletedAt)`.

| Table | Justification |
| ----- | ------------- |
| `projects` | User's top-level design container. Deletion should be reversible. |
| `architecture_nodes` | User-placed blocks in the architecture diagram. Part of the design. |
| `architecture_edges` | User-drawn connections between blocks. Part of the design. |
| `bom_items` | User-curated bill of materials entries with pricing and sourcing data. |

When a project is soft-deleted, its child nodes, edges, and BOM items are also soft-deleted in a transaction (see `deleteProject` in `storage.ts`).

#### Hard-Delete Tables (15 tables)

These tables have NO `deletedAt` column. Deletion uses `db.delete()`.

| Table | Justification |
| ----- | ------------- |
| `users` | Account deletion is permanent (GDPR-style). Cascade handles children. |
| `sessions` | Ephemeral auth tokens. Expire and get cleaned up. No user value. |
| `api_keys` | Encrypted credentials. User explicitly revokes; no recovery needed. |
| `user_chat_settings` | Upserted per user. Overwritten, never deleted in normal flow. |
| `validation_issues` | Computed by DRC engine. Regenerated on each validation run. |
| `chat_messages` | AI conversation log. "Clear chat" is intentional and permanent. |
| `history_items` | Append-only action log. "Clear history" is intentional and permanent. |
| `component_parts` | Project-scoped component definitions. Cascade-deleted with project. Currently hard-delete; acceptable because circuit instances reference parts via `SET NULL` on delete, and parts are tightly coupled to their project lifecycle. |
| `component_library` | Shared library entries. Admin/author removal is permanent. |
| `circuit_designs` | Cascade-deleted with project. Child instances/nets/wires cascade. |
| `circuit_instances` | Cascade-deleted with circuit design. |
| `circuit_nets` | Cascade-deleted with circuit design. |
| `circuit_wires` | Cascade-deleted with circuit net and circuit design. |
| `simulation_results` | Computed output. Cleaned up by `cleanupSimulationResults` retention policy. |
| `ai_actions` | Append-only audit log. No delete method exists (read-only). |

**Note on circuit tables:** Circuit entities (`circuit_designs`, `circuit_instances`, `circuit_nets`, `circuit_wires`) use hard-delete with PostgreSQL `ON DELETE CASCADE`. When a circuit design is deleted, all its children are automatically removed. This is acceptable because: (a) the parent project uses soft-delete, providing the recovery boundary; and (b) circuit sub-entities are structurally dependent — an instance without its circuit design is meaningless.

### Replacement Operations

`replaceNodes` and `replaceEdges` perform a full replacement of a project's architecture data (used by AI-generated architecture actions). These methods currently use hard-delete inside a transaction, then re-insert the new data. This is intentional for replacement semantics — the old rows are superseded by the new set, not individually "deleted" by the user.

However, these hard-deletes also destroy any previously soft-deleted rows that might be candidates for future "undelete" functionality. As of this writing, no undelete feature exists, and the replace operations are the only code path that permanently removes soft-deleted architecture data. This is documented as a known limitation, not a bug. If/when an undelete feature is built, the replace methods should be updated to only hard-delete rows where `deletedAt IS NOT NULL` and soft-delete the active rows before re-inserting.

## Coding Rules

1. **Queries on soft-delete tables MUST include `isNull(table.deletedAt)` in the WHERE clause** — for SELECT, UPDATE, and soft-DELETE operations. Forgetting this filter means deleted data leaks into active views.

2. **Soft-delete = `db.update(table).set({ deletedAt: new Date() })`** — never `db.delete()` on a soft-delete table (except in `replace*` operations, which are documented above).

3. **New user-facing design tables** (e.g., PCB layouts, annotations, design rules) SHOULD include a `deletedAt` column and follow the soft-delete pattern.

4. **New system/transient tables** (e.g., job queues, caches, metrics) SHOULD use hard-delete.

5. **Indexes:** Soft-delete tables should have a composite index on `(projectId, deletedAt)` to optimize filtered queries. All four current soft-delete tables already have this.

## Audit Findings

The following issues were identified during the audit:

### No Code Fixes Required

After thorough review, all storage methods correctly implement the intended delete pattern:

- **Soft-delete tables:** `deleteProject`, `deleteNodesByProject`, `deleteEdgesByProject`, `deleteBomItem` all use `SET deletedAt`. All read/update queries filter with `isNull(deletedAt)`.
- **Hard-delete tables:** All delete methods use `db.delete()` as expected.
- **Replace operations:** `replaceNodes` and `replaceEdges` use hard-delete intentionally (replacement semantics, documented above).

### Previously Considered Issues

- `replaceNodes` / `replaceEdges` hard-delete on soft-delete tables: Reviewed and deemed intentional (see "Replacement Operations" section above). These are bulk replacement operations, not user-initiated individual deletes.

## Consequences

- **Future "trash/recycle" feature**: Only needs to query `WHERE deletedAt IS NOT NULL` on the four soft-delete tables. The schema already supports this.
- **Data growth**: Soft-deleted rows accumulate. A periodic cleanup job (purge rows with `deletedAt` older than N days) should be considered for production.
- **Migration path**: No schema changes needed. The current table structure correctly reflects the policy.
- **Circuit table deletion**: If individual circuit design undo is needed in the future, `circuit_designs` should gain a `deletedAt` column. Currently, project-level soft-delete provides the recovery boundary.

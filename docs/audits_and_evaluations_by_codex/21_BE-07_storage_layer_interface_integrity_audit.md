# BE-07 Audit: Storage Layer + Interface Integrity

Date: 2026-03-06  
Auditor: Codex  
Section: BE-07 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Storage public surface and composition:
  - `server/storage.ts`
  - `server/storage/interfaces.ts`
  - `server/storage/index.ts`
  - `server/storage/types.ts`
  - `server/storage/utils.ts`
  - `server/storage/errors.ts`
- Storage modules:
  - `server/storage/projects.ts`
  - `server/storage/architecture.ts`
  - `server/storage/bom.ts`
  - `server/storage/validation.ts`
  - `server/storage/chat.ts`
  - `server/storage/components.ts`
  - `server/storage/circuit.ts`
  - `server/storage/misc.ts`
  - `server/storage/ordering.ts`
- Contract/caller checks tied to storage safety:
  - `server/routes/comments.ts`
  - `server/routes/design-history.ts`
  - `server/routes/bom-snapshots.ts`
  - `server/routes/design-preferences.ts`
  - `server/routes/component-lifecycle.ts`
  - `server/circuit-routes/designs.ts`
  - `server/circuit-routes/instances.ts`
  - `server/circuit-routes/nets.ts`
  - `server/circuit-routes/wires.ts`
  - `server/index.ts`
  - `shared/schema.ts`
- Test surface reviewed:
  - `server/__tests__/storage.test.ts`
  - `server/__tests__/storage-integration.test.ts`
  - `server/__tests__/storage-transactions.test.ts`
  - `server/__tests__/optimistic-concurrency.test.ts`
  - `server/__tests__/ordering.test.ts`
  - `server/__tests__/lru-cache.test.ts`

## Storage Surface Snapshot (Current)
- `IStorage` method count: `117` (large monolithic contract).
- Methods with `expectedVersion` support: `5`.
- Methods accepting `id` without `projectId` in signature: `40`.
- `DatabaseStorage` manually binds and re-exports all module methods (`server/storage.ts:20-171`).

## Severity Key
- `P0`: immediate data exposure/corruption/security risk
- `P1`: high-impact integrity/reliability risk
- `P2`: medium risk, debt with real failure potential
- `P3`: low-risk cleanup/maintainability

## Findings

### 1) `P0` Project-scoped data is exposed through ID-only storage APIs (unsafe by default)
Evidence:
- `IStorage` exposes many project-owned records by raw `id` only:
  - `getCircuitDesign`, `updateCircuitDesign`, `deleteCircuitDesign`
  - `getCircuitInstance`, `updateCircuitInstance`, `deleteCircuitInstance`
  - `getCircuitNet`, `updateCircuitNet`, `deleteCircuitNet`
  - `getCircuitWire`, `updateCircuitWire`, `deleteCircuitWire`
  - `getBomSnapshot`, `deleteBomSnapshot`
  - `getDesignSnapshot`, `deleteDesignSnapshot`
  - `getComment`, `updateComment`, `resolveComment`, `unresolveComment`, `deleteComment`
  - (`server/storage/interfaces.ts:103-169`)
- Storage implementation applies ID-only predicates for these records:
  - `server/storage/circuit.ts:30-37`, `49-81`, `96-136`, `150-190`, `204-244`, `346-388`
  - `server/storage/bom.ts:179-197`
  - `server/storage/misc.ts:261-291`, `318-395`
- Multiple routes include `:projectId` in URL but do not enforce row-project match before ID-only calls:
  - `server/routes/comments.ts:80-133`
  - `server/routes/design-history.ts:29-36`, `71-77`, `88-105`
  - `server/routes/bom-snapshots.ts:47-50`, `68-80`
  - `server/circuit-routes/designs.ts:29-35`, `49-77`
  - `server/circuit-routes/instances.ts:52-85`
  - `server/circuit-routes/nets.ts:41-80`
  - `server/circuit-routes/wires.ts:40-55`

What is happening:
- Storage contract is not project-safe by default. Callers must remember to do ownership checks every time.

Why this matters:
- If a caller misses that check, cross-project reads/updates/deletes are possible by guessed/known IDs.

Fix recommendation:
- Add project-scoped methods for all project-owned entities (example: `getDesignSnapshotForProject(projectId, snapshotId)`).
- Deprecate raw ID-only methods for project-owned rows.
- Add route-level helper/middleware that always verifies `(projectId, entityId)` pairing.

---

### 2) `P1` Circuit update methods allow foreign-key reparenting because update payload is not restricted
Evidence:
- Circuit update methods write arbitrary partial insert payload directly:
  - `updateCircuitInstance` -> `.set(data)` (`server/storage/circuit.ts:115-123`)
  - `updateCircuitNet` -> `.set(data)` (`server/storage/circuit.ts:169-177`)
  - `updateCircuitWire` -> `.set(data)` (`server/storage/circuit.ts:223-231`)
  - `updateHierarchicalPort` -> `.set(data)` (`server/storage/circuit.ts:367-375`)
- Interface type allows `Partial<Insert*>` payloads, which include relationship keys (`circuitId`, `netId`, `designId`):
  - `server/storage/interfaces.ts:112-158`

What is happening:
- These methods can reattach a row to another circuit/net/design if called with those fields.

Why this matters:
- That can silently break circuit integrity and project boundaries.

Fix recommendation:
- Strip ownership keys in storage update methods (same pattern used in `updateNode` and `updateBomItem`).
- Add explicit "move" methods if reparenting is ever needed, with strict validation and audit logging.

---

### 3) `P1` `upsertComponentLifecycle` is not a real upsert and can create duplicates
Evidence:
- No unique key for `(projectId, partNumber)` in schema:
  - indexes only on `projectId` and `lifecycleStatus` (`shared/schema.ts:513-515`)
- Upsert implementation uses `onConflictDoNothing()` with no target:
  - `server/storage/misc.ts:216-219`
- Then it updates by `(projectId, partNumber)`:
  - `server/storage/misc.ts:223-231`
- Route uses this for both create and patch:
  - `server/routes/component-lifecycle.ts:27`
  - `server/routes/component-lifecycle.ts:46-51`

What is happening:
- POST can insert multiple rows for same part/project because no unique conflict target exists.
- PATCH path depends on a lookup-by-partNumber that can become ambiguous.

Why this matters:
- Duplicate lifecycle entries cause incorrect UI/state and unreliable updates.

Fix recommendation:
- Add unique index on `(projectId, partNumber)`.
- Change upsert to `onConflictDoUpdate({ target: [projectId, partNumber], ... })`.
- Clean up existing duplicates with a migration before enabling strict unique index.

---

### 4) `P1` Project soft-delete cascade is incomplete (many project rows stay "live")
Evidence:
- `deleteProject` only marks these as deleted:
  - `projects`, `architecture_nodes`, `architecture_edges`, `bom_items`
  - (`server/storage/projects.ts:104-110`)
- Many other project-owned tables do not have `deletedAt` and are not touched by `deleteProject`:
  - `chat_messages`, `history_items`, `component_parts`, `circuit_designs`, `circuit_instances`, `circuit_nets`, `circuit_wires`, `design_snapshots`, `design_comments`, `component_lifecycle`, `pcb_orders`, etc. (`shared/schema.ts`)
- Global auth only enforces session for most API routes, not project ownership:
  - `server/index.ts:191-215`

What is happening:
- A "deleted project" keeps large amounts of active relational data.

Why this matters:
- Data lifecycle is inconsistent and harder to secure/audit.
- Any endpoint that misses ownership checks can still expose those retained rows.

Fix recommendation:
- Decide one consistent policy:
  - hard-delete project row in one transaction and rely on FK cascades, or
  - add soft-delete fields + filters for all project-owned tables.
- Document the policy and enforce it with tests.

---

### 5) `P1` Storage error normalization is inconsistent across modules
Evidence:
- Wrapped with `StorageError` in many modules (good):
  - examples in `projects.ts`, `architecture.ts`, `bom.ts`, `components.ts`, `circuit.ts`, `ordering.ts`
- Not wrapped in several read/write methods:
  - `validation.ts:15-38` (`getValidationIssues`, `createValidationIssue`, deletes)
  - `chat.ts:14-45` (`getChatMessages`, `createChatMessage`, deletes)
  - `misc.ts:22-45` (`history` methods)
- `StorageError` is where DB code-to-HTTP mapping happens:
  - `server/storage/errors.ts:1-43`

What is happening:
- Some storage methods return raw DB errors while others return mapped `StorageError`.

Why this matters:
- Caller behavior becomes inconsistent and harder to reason about.

Fix recommendation:
- Enforce one rule: all storage module methods wrap DB errors into `StorageError`.
- Add lint/test helper to assert wrapping behavior module-by-module.

---

### 6) `P2` Optimistic concurrency coverage is narrow and often optional
Evidence:
- Only five methods support `expectedVersion`:
  - `updateProject`, `updateNode`, `updateEdge`, `updateBomItem`, `updateCircuitDesign`
  - (`server/storage/interfaces.ts`)
- Many high-write methods have no version precondition:
  - `updateComponentPart` (`server/storage/components.ts:61-79`)
  - circuit instance/net/wire updates (`server/storage/circuit.ts:115-233`)
  - comments/order/etc updates in `misc.ts` / `ordering.ts`
- Routes parse `If-Match`, but only for selected entities:
  - `server/routes/architecture.ts`, `server/routes/bom.ts`, `server/routes/projects.ts`, `server/circuit-routes/designs.ts`

What is happening:
- Concurrency protection is patchy; lost updates are still possible in many places.

Why this matters:
- Concurrent edits can overwrite each other without warning.

Fix recommendation:
- Define a concurrency standard per entity class (critical vs non-critical).
- Add version columns + `If-Match` handling for high-risk mutable entities.

---

### 7) `P2` `chunkedInsert` is non-atomic and can leave partial writes
Evidence:
- Utility inserts chunk-by-chunk in a loop without transaction wrapping:
  - `server/storage/utils.ts:6-19`
- Used by:
  - `bulkCreateNodes` (`server/storage/architecture.ts:77-85`)
  - `bulkCreateEdges` (`server/storage/architecture.ts:148-156`)
  - `bulkCreateValidationIssues` (`server/storage/validation.ts:40-46`)

What is happening:
- If chunk `N` fails, chunks `1..N-1` stay committed.

Why this matters:
- Bulk operations can leave half-written state.

Fix recommendation:
- Add transaction wrapping for bulk operations that must be all-or-nothing.
- Keep chunking for payload size control, but execute chunk loop inside a single transaction.

---

### 8) `P2` Ownership checks are inconsistent across routes because storage contract is inconsistent
Evidence:
- Some routes manually verify project ownership before ID-only operations:
  - `server/routes/ordering.ts:99-103`, `147-151`
- Others only validate `projectId` format but do not verify entity belongs to that project:
  - `server/routes/design-preferences.ts:54-57`
  - `server/routes/design-history.ts:29-31`, `71-73`
  - `server/routes/comments.ts:80-88`, `99-103`, `115-118`, `130-133`

What is happening:
- Safety depends on route-by-route discipline, not on storage contract design.

Why this matters:
- Easy to introduce new cross-project bugs on future route work.

Fix recommendation:
- Move ownership checks into storage method signatures and helper primitives.
- Add shared `assertProjectEntityMatch` utilities where storage remains ID-only during migration.

---

### 9) `P2` Test surface misses key storage integrity invariants
Evidence:
- Existing storage tests are mostly mocked DB-chain tests:
  - `server/__tests__/storage.test.ts`
  - `server/__tests__/storage-integration.test.ts`
  - `server/__tests__/storage-transactions.test.ts`
  - `server/__tests__/optimistic-concurrency.test.ts`
- No direct test files found for critical route/storage integrity paths:
  - component lifecycle
  - design snapshot ownership checks
  - BOM snapshot ownership checks
  - comments project-ownership enforcement
  - chat branch persistence behavior

What is happening:
- There is good unit-level coverage for helper behavior, but weak coverage for real ownership/contract boundaries.

Why this matters:
- Security and integrity regressions can slip through while mocked tests still pass.

Fix recommendation:
- Add targeted integration tests for project/entity mismatch rejection.
- Add tests for lifecycle unique-upsert behavior and project delete lifecycle policy.

## What Is Already Good
- Storage code is modular and split by domain (`server/storage/*`), easier to reason about.
- Core `StorageError` provides useful PG error-code mapping (`server/storage/errors.ts`).
- Cache usage pattern is consistent in major read-heavy paths and supports prefix invalidation (`server/cache.ts`).
- Several high-value flows are transactional:
  - project delete (`server/storage/projects.ts:104-111`)
  - architecture replace (`server/storage/architecture.ts:161-224`, `234-305`)
  - BOM quantity/price update (`server/storage/bom.ts:71-85`)

## Test Coverage Assessment (BE-07)
- Good:
  - Cache behavior, soft-delete behavior, and selected transaction behavior have dedicated tests.
  - Version conflict mechanics are tested for project/node/edge/bom/circuit-design paths.
- Gaps:
  - Ownership invariants for ID-only methods are not strongly tested end-to-end.
  - Component lifecycle upsert semantics are not covered.
  - Route-level project/entity mismatch tests are missing for comments/snapshots/preferences/circuit entity IDs.
  - Heavily mocked DB chains reduce confidence for real relational integrity behavior.

## Improvements and Enhancements (Open-Minded)
1. Introduce `ProjectScopedStorage` facade:
   - Force `(projectId, entityId)` for project-owned entities.
2. Add storage contract tests generated from schema metadata:
   - Verify every project-owned table has matching scoped getters/mutators.
3. Add "integrity guard" middleware for `/api/projects/:id/*`:
   - Standardized ownership and entity-project matching.
4. Add schema-level uniqueness for lifecycle records:
   - `(project_id, part_number)` unique.
5. Define and enforce data lifecycle strategy:
   - "soft everywhere" or "hard with archive snapshots", no mixed gray zone.
6. Add transaction helpers for bulk operations:
   - `chunkedInsertInTransaction`.

## Decision Questions Before BE-08
1. Do we want to remove ID-only storage methods for project-owned tables, or keep them with strict internal-only usage?
2. Should project deletion become full hard-delete (FK cascade) or full soft-delete across all project tables?
3. Do we want mandatory optimistic concurrency on all mutable design entities, or only a selected critical subset?
4. Should ownership validation be enforced in storage itself, route middleware, or both?
5. Can we add a migration for `component_lifecycle (project_id, part_number)` uniqueness in the next wave?

## Suggested Fix Order
1. Close `P0` first: add project-scoped storage methods and migrate high-risk callsites (comments/snapshots/circuit routes).
2. Fix lifecycle upsert contract (`component_lifecycle` uniqueness + deterministic upsert).
3. Align project delete lifecycle policy and implement full cascade behavior for chosen policy.
4. Standardize storage error wrapping in all modules.
5. Expand concurrency controls for high-write entities.
6. Add integration tests for ownership/integrity boundaries.

## Bottom Line
BE-07 shows a strong modular storage foundation, but interface safety is upside-down in key places: too many project-owned records are accessible by raw ID, and caller discipline is doing work that the contract should do. Tightening storage signatures and adding scoped integrity checks will reduce cross-project risk and make the rest of the backend easier to trust.

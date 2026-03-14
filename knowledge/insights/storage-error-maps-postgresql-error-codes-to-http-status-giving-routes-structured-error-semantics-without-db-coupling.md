---
name: StorageError maps PostgreSQL error codes to HTTP status giving routes structured error semantics without DB coupling
description: server/storage/errors.ts defines StorageError which translates PostgreSQL error codes (23505 unique violation, 23503 foreign key, 57014 timeout, 08xxx connection failures) to HTTP status codes (409, 400, 408, 503) — routes can catch StorageError and forward httpStatus without knowing about PostgreSQL internals
type: insight
---

# StorageError Maps PostgreSQL Error Codes to HTTP Status, Giving Routes Structured Error Semantics Without DB Coupling

`server/storage/errors.ts` implements a two-level error translation layer:

1. **`mapPgCodeToHttp(code)`** converts raw PostgreSQL SQLSTATE codes to HTTP status:
   - `23505` (unique_violation) -> 409 Conflict
   - `23503` (foreign_key_violation) -> 400 Bad Request
   - `23502` (not_null_violation) -> 400 Bad Request
   - `23514` (check_violation) -> 400 Bad Request
   - `57014` (query_canceled/timeout) -> 408 Request Timeout
   - `08006/08001/08004/57P01` (connection failures, admin shutdown) -> 503 Service Unavailable
   - Everything else -> 500

2. **`StorageError`** wraps the raw database error with:
   - `operation` and `entity` for structured logging (`Storage.update(project/42) failed: ...`)
   - `httpStatus` computed from the PostgreSQL code
   - `pgCode` preserved for diagnostic use
   - Original stack trace forwarded from the cause

3. **`VersionConflictError`** extends `StorageError` with a hardcoded 409 status and carries `currentVersion` so the client can display "this resource was modified — reload and try again" with the actual version number. This is the optimistic concurrency mechanism that prevents lost updates when [[crdt-merge-uses-intent-preserving-rules-where-insert-always-beats-concurrent-delete-a-deliberate-philosophical-choice|CRDT collaboration]] is not in use (HTTP-only editing).

**Why this pattern is valuable:** Route handlers can catch `StorageError` and use `err.httpStatus` directly without importing any Postgres-specific types. The storage layer translates database semantics to HTTP semantics in one place, making it impossible for routes to accidentally return 500 for a unique constraint violation (which should be 409) or a connection failure (which should be 503 with retry).

**Anti-pattern it prevents:** Without this translation, every route would need its own `try/catch` with PostgreSQL code inspection, leading to inconsistent error handling across 30+ route files. The 23505 unique_violation → 409 mapping is particularly important for the [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary|dual-ID system]] where unique indexes on `(projectId, nodeId)` prevent duplicate text IDs within a project.

During [[graceful-shutdown-drains-resources-in-dependency-order-with-a-30-second-forced-exit-backstop|graceful shutdown]], the 08xxx → 503 mapping ensures that requests hitting a closing database pool get proper "service unavailable" responses rather than unstructured 500 errors.

---

Related:
- [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary]] — unique_violation (23505 → 409) catches duplicate text IDs in the dual-ID system
- [[the-schema-insert-pattern-uses-omit-plus-extend-to-create-a-strict-write-contract-while-the-select-type-remains-permissive]] — when Zod validation passes but DB constraints reject, StorageError translates the DB failure
- [[graceful-shutdown-drains-resources-in-dependency-order-with-a-30-second-forced-exit-backstop]] — 08xxx connection failure → 503 mapping handles late requests during shutdown drain
- [[crdt-merge-uses-intent-preserving-rules-where-insert-always-beats-concurrent-delete-a-deliberate-philosophical-choice]] — VersionConflictError is the HTTP-only alternative to CRDT conflict resolution
- [[express-5-req-params-returns-string-or-string-array-so-every-route-param-access-needs-string-wrapping]] — routes consuming StorageError must also handle Express 5's param typing; both are per-route concerns centralized to avoid inconsistency

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

3. **`VersionConflictError`** extends `StorageError` with a hardcoded 409 status and carries `currentVersion` so the client can display "this resource was modified — reload and try again" with the actual version number.

**Why this pattern is valuable:** Route handlers can catch `StorageError` and use `err.httpStatus` directly without importing any Postgres-specific types. The storage layer translates database semantics to HTTP semantics in one place, making it impossible for routes to accidentally return 500 for a unique constraint violation (which should be 409) or a connection failure (which should be 503 with retry).

**Anti-pattern it prevents:** Without this translation, every route would need its own `try/catch` with PostgreSQL code inspection, leading to inconsistent error handling across 30+ route files.

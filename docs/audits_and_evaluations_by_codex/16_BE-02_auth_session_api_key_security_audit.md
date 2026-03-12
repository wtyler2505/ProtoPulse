# BE-02 Audit: Auth + Session + API Key Security

Date: 2026-03-06  
Auditor: Codex  
Section: BE-02 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Core auth/session/key implementation:
  - `server/auth.ts`
  - `server/index.ts`
  - `server/routes/auth.ts`
  - `server/routes/settings.ts`
  - `server/routes/auth-middleware.ts`
  - `shared/schema.ts`
  - `migrations/0000_green_prodigy.sql`
- Related auth entry points and key consumers:
  - `server/routes/admin.ts`
  - `server/routes/backup.ts`
  - `server/routes/chat.ts`
  - `server/routes/agent.ts`
  - `server/routes/components.ts`
- Session transport + realtime auth surface (cross-section auth risks discovered in BE-02):
  - `server/collaboration.ts`
  - `client/src/lib/collaboration-client.ts`
- Test surface reviewed:
  - `server/__tests__/auth.test.ts`
  - `server/__tests__/auth-session.test.ts`
  - `server/__tests__/auth-regression.test.ts`
  - `server/__tests__/admin-purge.test.ts`
  - `server/__tests__/collaboration.test.ts`
  - `server/__tests__/api.test.ts`

## Auth/Session Flow Snapshot (Current)
1. Register/Login (`/api/auth/register`, `/api/auth/login`) creates session token via `createSession`.
2. Raw token is returned to client; DB stores only SHA-256 hash.
3. Client sends `X-Session-Id` on API requests.
4. Global `/api` middleware validates session and sets `req.userId` for non-public paths.
5. API keys are encrypted with AES-256-GCM at rest (`api_keys` table).
6. AI routes prefer stored key and fall back to client-provided key.

## Severity Key
- `P0`: immediate security/data-loss risk
- `P1`: high-impact security/auth correctness risk
- `P2`: medium reliability/security/operational risk
- `P3`: lower-risk debt/cleanup

## Findings

### 1) `P1` `/api/settings/chat` public-path bypass breaks authenticated behavior
Evidence:
- `server/index.ts:189`
- `server/index.ts:191`
- `server/index.ts:192`
- `server/index.ts:193`
- `server/routes/settings.ts:126`
- `server/routes/settings.ts:149`
- Local logic repro run during audit:
  - `mountedReqPath='/settings/chat'` produced `bypass: true` for current middleware condition.

What is happening:
- Global `/api` auth middleware short-circuits all `/api/settings/chat` requests as “public”.
- Because of that short-circuit, session validation never runs there and `req.userId` is never set.

Why this matters:
- `GET /api/settings/chat` always returns defaults, even for authenticated users.
- `PATCH /api/settings/chat` depends on `req.userId` and returns `401`, so user-specific settings persistence path is effectively broken.

Fix recommendation:
- Replace blanket public bypass for `/settings/chat` with optional session resolution:
  - If header exists, validate and set `req.userId`.
  - If no header, allow anonymous default read only.
- Keep PATCH behind strict auth.

---

### 2) `P1` API key storage update path is non-atomic and schema allows duplicates
Evidence:
- `server/auth.ts:170`
- `server/auth.ts:171`
- `server/auth.ts:175`
- `server/auth.ts:176`
- `shared/schema.ts:185`
- `migrations/0000_green_prodigy.sql:12`

What is happening:
- `storeApiKey` does `DELETE` then `INSERT` in two separate operations.
- `api_keys` has no unique constraint on `(user_id, provider)`.
- `getApiKey` selects first matching row without deterministic ordering.

Why this matters:
- Concurrent writes can race into duplicate rows or temporary key loss.
- Crash between delete/insert can silently remove a user’s stored key.
- Reads can become non-deterministic when duplicates exist.

Fix recommendation:
- Add unique index on `(user_id, provider)`.
- Replace delete+insert with one upsert (`onConflictDoUpdate`) in a single statement/transaction.
- Add migration guard to deduplicate existing rows before unique index creation.

---

### 3) `P2` API key validation endpoint reflects raw upstream error messages
Evidence:
- `server/routes/settings.ts:106`
- `server/routes/settings.ts:107`
- `server/routes/settings.ts:108`

What is happening:
- `/api/settings/api-keys/validate` catches provider errors and returns `err.message` directly.

Why this matters:
- Upstream/provider messages can leak internal details and are inconsistent for UX/security.
- This path does not use existing redaction/sanitization strategy used elsewhere in AI routes.

Fix recommendation:
- Normalize provider errors into safe user messages.
- Reuse central sanitization (`redactSecrets`/categorize pattern) and avoid echoing raw provider text.

---

### 4) `P2` API key decryption failures are silently swallowed
Evidence:
- `server/auth.ts:178`
- `server/auth.ts:187`
- `server/auth.ts:188`

What is happening:
- `getApiKey` catches decryption/parsing errors and returns `null` without logging.

Why this matters:
- Key corruption, format drift, or crypto misconfiguration is hidden from operators.
- Failures look like “no key found”, making incident triage harder.

Fix recommendation:
- Log structured warning on decrypt failure (provider, userId, requestId-safe metadata).
- Add a security/ops counter for decrypt failures.

---

### 5) `P2` Session lifecycle controls are incomplete in runtime API surface
Evidence:
- `server/auth.ts:107`
- `server/routes/auth.ts:24`
- `rg -n "refreshSession\\(" server client` shows only `server/auth.ts` + tests, no route usage.
- `server/auth.ts:82`
- `server/auth.ts:83`

What is happening:
- `refreshSession` exists and is tested, but is not exposed through API routes.
- Expired-session cleanup occurs opportunistically during validation only.

Why this matters:
- Session rotation work is not reachable by clients.
- Stale session rows rely on user traffic patterns for cleanup.

Fix recommendation:
- Add `/api/auth/refresh` endpoint with explicit rotation semantics.
- Add periodic cleanup for expired sessions and supporting index strategy on `expires_at`.

---

### 6) `P2` Admin-key checks use direct string comparison in multiple files
Evidence:
- `server/routes/admin.ts:25`
- `server/routes/admin.ts:42`
- `server/routes/backup.ts:38`

What is happening:
- Admin key validation is repeated and uses direct equality checks.

Why this matters:
- Duplicated auth logic drifts over time.
- Direct string comparison is weaker than constant-time compare for secret checks.

Fix recommendation:
- Centralize admin-key validation helper.
- Use `crypto.timingSafeEqual` with length guard.
- Reuse one shared middleware for all admin-key protected routes.

---

### 7) `P1` (Pre-activation blocker) Collaboration auth sends session token in URL query
Evidence:
- `server/collaboration.ts:82`
- `client/src/lib/collaboration-client.ts:87`
- `client/src/lib/__tests__/collaboration-client.test.ts:134`

What is happening:
- WebSocket auth token is passed as `?sessionId=...` query parameter.

Why this matters:
- Query params are commonly logged by proxies, tooling, and browser/network traces.
- This expands session-token exposure risk compared to header/subprotocol approaches.

Fix recommendation:
- Move WS auth to a safer channel:
  - short-lived signed WS ticket from authenticated HTTP endpoint, or
  - `Sec-WebSocket-Protocol`/header-based token approach.
- Never pass long-lived session tokens in URL query strings.

---

### 8) `P1` (Pre-activation blocker) Collaboration role assignment allows non-owners to edit
Evidence:
- `server/collaboration.ts:107`
- `server/collaboration.ts:108`
- `server/storage/projects.ts:53`
- `server/storage/projects.ts:61`

What is happening:
- Non-owner users are assigned `editor` role by default (`owner ? 'owner' : 'editor'`).
- There is no deny path for unauthorized project access in WS handshake.

Why this matters:
- If collaboration server is activated, any authenticated user with a projectId can join and mutate collaboration state.
- This conflicts with strict ownership posture in REST hardening work.

Fix recommendation:
- Enforce ownership/ACL at WS connect:
  - reject unauthorized users (default), or
  - require explicit collaborator/invite model.
- Only grant `editor` when explicit permission exists.

Runtime exposure note:
- `attachCollaborationServer(...)` is currently defined but not called from server boot path (not active by default right now).

---

### 9) `P2` `X-Session-Id` extraction relies on unsafe type assertions
Evidence:
- `server/index.ts:196`
- `server/routes/auth.ts:82`
- `server/routes/auth.ts:93`
- `server/routes/chat.ts:52`
- `server/routes/chat.ts:481`
- Runtime crypto behavior probe during audit:
  - `hashSessionToken(['a','b'])` throws data type error.

What is happening:
- Multiple routes cast header values as `string` without runtime narrowing.

Why this matters:
- Malformed/non-string values can produce avoidable 500s instead of clean 401/400 behavior.
- Increases auth-surface fragility.

Fix recommendation:
- Use one `extractSingleHeader(req, name)` utility returning `string | null`.
- Reject malformed header types with 400 and keep auth failures as 401.

---

### 10) `P2` BE-02 test surface over-relies on reconstructed logic and misses key route paths
Evidence:
- `server/__tests__/auth-regression.test.ts:89` (reconstructed auth checks)
- `server/__tests__/auth-regression.test.ts:640` (reconstructed origin validator)
- `server/__tests__/auth-session.test.ts:350` (tautological assertion)
- `server/__tests__/api.test.ts:84` (`describe.skipIf(!serverAvailable)`)
- `rg -n "/api/settings/api-keys|/api/settings/chat" server/__tests__` shows no direct settings route tests.

What is happening:
- Many “security” assertions are policy reconstructions, not runtime middleware/route execution.
- Critical settings/key route behaviors currently lack direct route-level tests.

Why this matters:
- Regressions like `/api/settings/chat` auth behavior can slip through while tests stay green.

Fix recommendation:
- Add focused supertest-style integration tests for:
  - `/api/settings/chat` GET/PATCH with and without valid session
  - `/api/settings/api-keys` create/list/delete/validate auth behavior
  - admin key middleware consistency across admin routes

## What Is Already Good
- Session tokens are hashed before DB storage (`hashSessionToken`).
- Password verification uses `timingSafeEqual` with length guard.
- API keys are encrypted at rest with AES-256-GCM.
- Provider allowlists are enforced at settings API key storage/validation boundaries.
- Auth routes enforce payload limits and auth-specific rate limiting.
- Owner-aware project middleware exists for key REST ownership paths.

## Test Coverage Assessment (This Section)
What exists:
- Solid unit-style crypto/session tests for core primitives.
- Good baseline tests around admin purge authorization.
- Dedicated session-rotation test file exists.

Important gaps:
- No direct runtime test for `/api/settings/chat` optional-auth behavior.
- No direct route tests for API key settings flow.
- Some auth “regression” tests are descriptive reconstructions instead of real route/middleware execution.
- `api.test.ts` remains environment-dependent and can be skipped wholesale.

Execution note:
- Per user direction, this pass is inspection-only (no test runtime execution).

## Improvements / Enhancements
- Introduce explicit `optionalSession` middleware for mixed public/personalized endpoints.
- Add `sessions` housekeeping job + index on expiry.
- Add key-management service with deterministic upsert semantics and telemetry.
- Adopt short-lived session rotation protocol with `/api/auth/refresh`.
- Add auth contract tests that fail on middleware mount-path mistakes and public-path drift.

## Decision Questions Before BE-03
1. Should `/api/settings/chat` stay partially public (anonymous defaults) or become fully authenticated?
2. Do we want to enforce single-session, bounded-multi-session, or unlimited sessions per user?
3. For collaboration, should non-owners be blocked by default until explicit project ACL/invite model is implemented?

## Suggested Fix Order
1. Fix `/api/settings/chat` auth flow (`optionalSession` + strict PATCH auth).
2. Harden API key persistence (unique `(userId, provider)` + upsert migration).
3. Sanitize settings key-validation errors and add decrypt-failure observability.
4. Add session refresh endpoint + cleanup strategy.
5. Centralize and harden admin-key validation.
6. Resolve collaboration auth transport/authorization blockers before enabling WS server.
7. Add missing route-level BE-02 auth/key integration tests.

## Bottom Line
BE-02 reveals that core primitives (password hashing, session hashing, encrypted key storage) are strong, but integration edges still contain high-impact auth correctness and security gaps. The biggest immediate issue is `/api/settings/chat` auth-flow breakage, followed by API-key persistence race risks. Fixing these first will significantly improve auth reliability before broader route-surface auditing in BE-03.

# BE-15 Audit: Security Hardening

Date: 2026-03-06  
Auditor: Codex  
Section: BE-15 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Core security/runtime surfaces:
  - `server/index.ts`
  - `server/auth.ts`
  - `server/collaboration.ts`
  - `server/audit-log.ts`
  - `server/metrics.ts`
- Authorization/ownership middleware and route usage:
  - `server/routes/auth-middleware.ts`
  - `server/routes/projects.ts`
  - `server/routes.ts`
  - `server/circuit-routes/index.ts`
- High-risk route modules:
  - `server/routes/bom.ts`
  - `server/routes/components.ts`
  - `server/routes/project-io.ts`
  - `server/routes/admin.ts`
  - `server/routes/backup.ts`
  - `server/routes/chat.ts`
  - `server/routes/embed.ts`
  - `server/circuit-routes/imports.ts`
- Import/export and archive parsing:
  - `server/component-export.ts`
  - `server/export/fzz-handler.ts`
- Storage authorization shape:
  - `server/storage/projects.ts`
  - `server/storage/architecture.ts`
  - `server/storage/bom.ts`
- Shared schema validation surface:
  - `shared/schema.ts`
- Test surface reviewed:
  - `server/__tests__/auth-regression.test.ts`
  - `server/__tests__/stream-abuse.test.ts`
  - `server/__tests__/embed-routes.test.ts`
  - `server/__tests__/project-ownership.test.ts`
  - `server/__tests__/auth.test.ts`
  - `server/__tests__/auth-session.test.ts`
  - `server/__tests__/admin-purge.test.ts`
  - `server/__tests__/routes-utils.test.ts`

## BE-15 Surface Snapshot (Current)
- Project-scoped route declarations across `server/routes` + `server/circuit-routes`: `37`
- `requireProjectOwnership` route attachments: `2` (`PATCH /api/projects/:id`, `DELETE /api/projects/:id`)
- `parseIdParam(req.params.id|projectId)` callsites: `124`
- `express-rate-limit` declarations in backend route/runtime surfaces: `4`
- Security-focused test counts:
  - `auth-regression.test.ts`: `92`
  - `stream-abuse.test.ts`: `41`
  - `auth.test.ts`: `27`
  - `embed-routes.test.ts`: `24`
  - `project-ownership.test.ts`: `20`
  - `auth-session.test.ts`: `18`
  - `admin-purge.test.ts`: `11`
  - `routes-utils.test.ts`: `11`

## Severity Key
- `P0`: critical authorization/confidentiality/integrity risk
- `P1`: high-impact security hardening gap with material exploitability
- `P2`: medium-risk hardening/control weakness
- `P3`: low-risk coverage/readiness/documentation gap

## Findings

### 1) `P0` Project-level ownership enforcement is not applied across most project-scoped routes (BOLA/IDOR risk)
Evidence:
- Ownership middleware exists and is designed for project authorization:
  - `server/routes/auth-middleware.ts:22`
  - `server/routes/auth-middleware.ts:53`
- Route attachment is limited to only two project endpoints:
  - `server/routes/projects.ts:66`
  - `server/routes/projects.ts:100`
- Many other project-scoped routes parse `projectId` and proceed without ownership middleware, for example:
  - `server/routes/bom.ts:16`
  - `server/routes/components.ts:30`
  - `server/circuit-routes/imports.ts:7`
- Storage queries generally enforce row scope by `projectId` only, not `(projectId + user)`:
  - `server/storage/architecture.ts:24`
  - `server/storage/bom.ts:27`
  - `server/storage/bom.ts:40`

What is happening:
- Global session auth ensures “logged-in user,” but authorization for “this specific project belongs to this user” is not consistently enforced at the route boundary.

Why this matters:
- Authenticated users can potentially read or mutate resources for projects they do not own by guessing IDs.

Fix recommendation:
- Enforce authorization middleware on all `/api/projects/:...` routes (and circuit routes) unless route is explicitly public by design.
- Add a centralized helper for project-scoped route registration that always applies owner/access control.
- Add integration tests asserting cross-user access is denied across all project subdomains (BOM, components, chat, circuit, exports/imports).

---

### 2) `P1` Project import route creates ownerless projects, widening unauthorized-access surface
Evidence:
- Import route inserts new project without `ownerId`:
  - `server/routes/project-io.ts:363`
  - `server/routes/project-io.ts:366`
  - `server/routes/project-io.ts:367`
- Ownership model treats ownerless projects as accessible:
  - `server/routes/auth-middleware.ts:52`
  - `server/storage/projects.ts:60`
- Project creation path in storage defaults `ownerId` to `null` when omitted:
  - `server/storage/projects.ts:69`

What is happening:
- `/api/projects/import` can create projects with `ownerId = null`, which current authorization semantics intentionally treat as accessible for backward compatibility.

Why this matters:
- New data imported today can accidentally enter legacy “ownerless” authorization behavior, weakening project isolation.

Fix recommendation:
- Resolve `req.userId` and set imported project `ownerId` explicitly.
- Add a migration/compatibility plan to phase out ownerless-access behavior (or gate it behind an explicit feature flag with audit logging).

---

### 3) `P1` Collaboration websocket allows non-owners to join as `editor` and passes session token in query string
Evidence:
- WS handshake reads `sessionId` from URL query parameters:
  - `server/collaboration.ts:81`
  - `server/collaboration.ts:82`
- Role assignment grants `editor` when not owner, instead of rejecting/readonly by default:
  - `server/collaboration.ts:107`
  - `server/collaboration.ts:108`
- Viewer restrictions exist but role assignment path shown above never assigns `viewer` in this gate:
  - `server/collaboration.ts:221`
  - `server/collaboration.ts:223`

What is happening:
- Non-owner authenticated users can still connect with edit privileges on collaboration channel (subject to current `isProjectOwner` return), and credentials are sent via URL query string.

Why this matters:
- Privilege model is weaker than strict ownership and session identifiers in URLs are easier to leak via logs/history/proxies.

Fix recommendation:
- Require explicit membership/collaborator ACL before granting `editor`.
- Default unauthorized users to rejection (`403`) or `viewer` only, based on product policy.
- Move WS auth to headers/cookies/subprotocol token exchange instead of query string.

---

### 4) `P1` FZZ import path lacks ZIP bomb protections present in FZPZ import path
Evidence:
- FZPZ import has explicit entry-count + uncompressed-size limits:
  - `server/component-export.ts:425`
  - `server/component-export.ts:426`
  - `server/component-export.ts:437`
  - `server/component-export.ts:449`
  - `server/component-export.ts:518`
- FZZ import loads zip and iterates files without equivalent guards:
  - `server/export/fzz-handler.ts:524`
  - `server/export/fzz-handler.ts:532`
  - `server/export/fzz-handler.ts:534`
  - `server/export/fzz-handler.ts:548`
  - `server/export/fzz-handler.ts:649`
- Endpoint exposure:
  - `server/circuit-routes/imports.ts:7`
  - `server/circuit-routes/imports.ts:21`

What is happening:
- Compressed archive is capped by request size, but decompressed content is not bounded in FZZ path.

Why this matters:
- Crafted archives can cause CPU/memory pressure and denial-of-service.

Fix recommendation:
- Add the same `MAX_ZIP_FILES` + `MAX_UNCOMPRESSED_SIZE` controls used by FZPZ path.
- Stop parsing early once decompressed-byte budget is exceeded.
- Add tests for oversized entry count and decompressed-size overflow.

---

### 5) `P2` Origin/host checks depend on forwarded host headers and fixed proxy trust assumptions
Evidence:
- Proxy trust hardcoded:
  - `server/index.ts:35`
- CSRF/origin guard compares `Origin/Referer` host to `x-forwarded-host` or host:
  - `server/index.ts:157`
  - `server/index.ts:172`
- Stream origin guard repeats forwarded-host comparison pattern:
  - `server/routes/chat.ts:120`
  - `server/routes/chat.ts:152`
- Embed URL generation uses forwarded host/proto:
  - `server/routes/embed.ts:119`
  - `server/routes/embed.ts:120`

What is happening:
- Security behavior depends on deployment correctness around trusted proxies and forwarded header integrity.

Why this matters:
- Misconfigured edge/proxy setups can weaken origin validation and related abuse controls.

Fix recommendation:
- Gate forwarded header usage behind strict trusted-proxy configuration policy.
- Prefer canonical origin config (allowlist) for production environments.
- Add security tests for spoofed forwarded headers under production-like config.

---

### 6) `P2` Admin key authorization uses direct string equality and lacks dedicated route-level brute-force throttling
Evidence:
- Direct equality checks for admin endpoints:
  - `server/routes/admin.ts:25`
  - `server/routes/admin.ts:42`
  - `server/routes/backup.ts:38`
- No `rateLimit(...)` usage in `admin.ts` or `backup.ts`; contrast with auth/settings/embed:
  - `server/routes/auth.ts:16`
  - `server/routes/settings.ts:11`
  - `server/routes/embed.ts:78`

What is happening:
- Admin endpoints rely on one static header secret plus global API limiter.

Why this matters:
- Harder to enforce tight brute-force controls and observability for privileged endpoints.

Fix recommendation:
- Add dedicated admin limiter with stricter thresholds and penalty windows.
- Use timing-safe comparison (`crypto.timingSafeEqual`) after normalizing header type/length.
- Consider rotating/scoped admin credentials and optional IP allowlist.

---

### 7) `P2` URL-like and metadata fields are persisted without protocol-level validation at API boundary
Evidence:
- URL-like fields are plain text in schema:
  - `shared/schema.ts:97`
  - `shared/schema.ts:98`
  - `shared/schema.ts:472`
- Insert schemas do not enforce URL protocol constraints:
  - `shared/schema.ts:112`
  - `shared/schema.ts:235`
- Routes accept parsed bodies and write directly:
  - `server/routes/bom.ts:62`
  - `server/routes/components.ts:69`

What is happening:
- Backend accepts arbitrary strings for URL-like fields and arbitrary JSON metadata, relying on downstream rendering safety.

Why this matters:
- Malicious URL schemes (`javascript:`, `data:` variants in the wrong context) can be stored and later surfaced if any UI sanitation path regresses.

Fix recommendation:
- Enforce protocol allowlist (`http`, `https`) and length/format limits for URL-like fields.
- Add server-side sanitization/normalization for rich metadata that can be rendered.
- Add regression tests for malicious URL payload rejection.

---

### 8) `P2` Security test suite is broad in count, but key scenarios are still underrepresented at integration boundaries
Evidence:
- Some tests explicitly reconstruct logic instead of exercising live route wiring:
  - `server/__tests__/auth-regression.test.ts:89`
  - `server/__tests__/auth-regression.test.ts:97`
  - `server/__tests__/stream-abuse.test.ts:128`
  - `server/__tests__/embed-routes.test.ts:169`
- FZZ security-hardening coverage is effectively absent (only path normalization mention observed):
  - `server/__tests__/metrics.test.ts:81`

What is happening:
- High test count exists, but several tests validate constants/reconstructed functions/mocks rather than real middleware integration behavior.

Why this matters:
- Real-world regressions in route wiring and inter-module security contracts can pass test suite undetected.

Fix recommendation:
- Add focused integration tests for:
  - Cross-user access denial on project-scoped routes.
  - FZZ decompressed-size and entry-count hard limits.
  - Admin endpoint brute-force throttling and timing-safe compare behavior.
  - Forwarded-header spoofing in production-mode guards.

## What Is Already Good
- Strong baseline middleware stack exists (Helmet, HSTS, referrer policy, API limiter):
  - `server/index.ts:50`
  - `server/index.ts:83`
  - `server/index.ts:129`
- Session auth and API key encryption architecture are in place:
  - `server/auth.ts` (validated in prior BE sections)
- FZPZ importer already has robust archive hardening controls:
  - `server/component-export.ts:425`
  - `server/component-export.ts:426`
  - `server/component-export.ts:449`
- Ownership middleware implementation itself is reasonable and defensive in response strategy:
  - `server/routes/auth-middleware.ts:15`
  - `server/routes/auth-middleware.ts:54`

## Test Coverage Assessment (BE-15-specific)
- Good depth:
  - Session auth primitives and ownership middleware logic.
  - Abuse-control constants and helper structures.
  - Admin purge path basic behavior.
- Gaps:
  - End-to-end authorization across all project-scoped route families.
  - FZZ archive hardening tests (ZIP bomb class).
  - Forwarded-header security behavior under production proxy conditions.
  - Admin endpoint dedicated brute-force protection tests.

## Improvements / Enhancements
- Build a reusable `withProjectAccess(...)` route wrapper that enforces ownership/collaborator policy by default.
- Introduce collaborator ACL model (`owner`/`editor`/`viewer`) and apply uniformly across REST + WS.
- Add archive safety utility shared by FZPZ/FZZ/KiCad importers (`maxEntries`, `maxUncompressedBytes`, `maxPerEntryBytes`).
- Add `Security Contracts` integration test suite with supertest for authz/header/abuse regression checks.
- Add structured security telemetry counters (denied authz, admin key failures, malformed origin, archive rejections).

## Decision Questions
- Should non-owner authenticated users ever have implicit editor access to collaboration rooms?
- Is ownerless project access still required for active product behavior, or can we migrate to owner-required now?
- For admin endpoints, do we want static key only, or key + IP allowlist + stricter limiter as baseline?
- Should origin validation rely on host matching only, or move to explicit production origin allowlist?

## Suggested Fix Order
1. Enforce project authorization consistently on all project-scoped routes (`P0`).
2. Fix import ownership assignment and ownerless access semantics (`P1`).
3. Harden collaboration authorization and session transport (`P1`).
4. Add FZZ decompression safety limits (`P1`).
5. Harden admin authorization path (timing-safe compare + dedicated limiter) (`P2`).
6. Add URL protocol validation and integration security tests (`P2`).
7. Strengthen forwarded-header/proxy guardrails and tests (`P2`).

## Bottom Line
BE-15 exposes a strong baseline security posture with several mature controls already present, but there is a critical authorization consistency gap at project scope. Fixing project-level access enforcement first will remove the biggest real-world risk; archive hardening and admin/forwarded-header tightening should follow immediately after.

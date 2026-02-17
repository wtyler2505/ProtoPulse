# ProtoPulse — Backend Audit Remediation Checklist

**Scope:** `server/` (all files) + `shared/schema.ts`
**Total findings:** 116
**Last updated:** 2026-02-17

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fixed / Resolved |
| ⬜ | Open — not yet addressed |
| 🔶 | Partially addressed |

## Priority Legend

| Tag | Meaning | Examples |
|-----|---------|----------|
| P0 | 🔥 Critical (security/data-loss) | auth gaps, destructive writes w/o transactions, key leakage |
| P1 | ⚠️ High (reliability/production breakage) | pool exhaustion, CSP breaking prod, no shutdown |
| P2 | 🧠 Medium (performance/scale) | unbounded queries, log bloat, SSE buffering |
| P3 | 🧹 Low (cleanup/DX) | unused deps, dead code, missing docs/comments |

---

## Progress Summary

| Priority | Total | Fixed | Open | Partial |
|----------|-------|-------|------|---------|
| P0 | 10 | 9 | 1 | 0 |
| P1 | 33 | 29 | 4 | 0 |
| P2 | 60 | 5 | 53 | 2 |
| P3 | 13 | 4 | 9 | 0 |
| **Total** | **116** | **47** | **67** | **2** |

---

## server/db.ts — Database Connection

- [x] ✅ **#1** P1 Reliability — No connection pool limits configured (pg.Pool only uses connectionString; missing max, min, idleTimeoutMillis, connectionTimeoutMillis). Under load: potential exhaustion/leaks.
  > Fixed: Pool now configured with max:20, idleTimeoutMillis:30000, connectionTimeoutMillis:5000.
- [x] ✅ **#2** P1 Reliability — No pool error handling (pool.on("error", ...) missing). Unexpected disconnects may crash or fail silently.
  > Fixed: Added pool.on("error") handler.
- [x] ✅ **#3** P1 Reliability — No connection health check / retry. Startup hard-crashes if DB is temporarily unavailable.
  > Fixed: Added checkConnection() with exponential backoff retry (up to 5 attempts) called on server startup.
- [x] ✅ **#4** P0 Security — No SSL configuration (ssl not set). Remote Postgres could run unencrypted in production.
  > Fixed: SSL enabled conditionally in production.

---

## server/index.ts — Server Bootstrap

- [x] ✅ **#5** P1 Reliability — Rate limit is overly aggressive: 100 requests / 15 min across all /api routes. Normal editing flows may hit it fast.
  > Fixed: Increased to 300 requests / 15 min.
- [x] ✅ **#6** P1 Reliability — Rate limit applies to SSE AI stream (/api/chat/ai/stream) even though it's long-lived.
  > Fixed: SSE endpoint exempted via skip function.
- [ ] ⬜ **#7** P2 Security/DX — trust proxy set to 1 without comment. Fine for Replit; risky if deployed elsewhere.
- [x] ✅ **#8** P1 Security — Helmet CSP disabled in dev (contentSecurityPolicy: false): zero XSS protection during dev.
  > Fixed: Unified CSP config for dev and prod with proper directives (self, unsafe-inline for styles, Google Fonts, data/blob for images, WebSocket in dev only).
- [x] ✅ **#9** P1 Reliability — Helmet CSP likely too strict in production (default CSP may block inline styles, external fonts, SSE), risking prod breakage.
  > Fixed: Same unified CSP config — allows styles, fonts, images, and SSE while blocking frames and objects.
- [x] ✅ **#10** P3 DX/Tech Debt — rawBody is stored via express.json(verify) but never used (dead code).
  > Fixed: Removed dead rawBody code and the declare module block.
- [x] ✅ **#11** P1 Observability/Security — Request logging captures full JSON response bodies (noise + potential sensitive leakage).
  > Fixed: Response body logging truncated to 500 chars.
- [x] ✅ **#12** P2 Observability — No log truncation; huge payloads will explode logs.
  > Fixed: Truncated to 500 chars with [truncated] suffix.
- [ ] ⬜ **#13** P2 Observability — No request ID / correlation ID.
- [x] ✅ **#14** P1 Reliability — No graceful shutdown (no SIGTERM/SIGINT handlers to drain server + close DB pool).
  > Fixed: Added gracefulShutdown function with SIGTERM/SIGINT handlers.
- [ ] ⬜ **#15** P3 DX/Tech Debt — createServer import/usage inconsistent (imported but server created inline; also appears unused elsewhere).
- [x] ✅ **#16** P1 API/DX — Global error handler doesn't differentiate error types (validation vs DB vs unexpected).
  > Fixed: 4xx returns original message, 5xx returns generic "Internal server error".
- [x] ✅ **#17** P1 Security — Error handler leaks raw err.message to client (SQL/file paths/internal details).
  > Fixed: 5xx errors now return sanitized generic message; full error logged server-side only.
- [ ] ⬜ **#18** P2 API Design — No CORS configuration (fine for same-origin now; breaks external clients later).
- [x] ✅ **#19** P1 Reliability — No request timeout (slow requests/SSE could hang indefinitely).
  > Fixed: Added 30s request timeout middleware for all non-SSE routes. SSE retains its own 120s timeout.
- [x] ✅ **#20** P3 Tech Debt — Unused deps installed: passport, passport-local, express-session, connect-pg-simple, memorystore, ws.
  > Fixed: All removed from package.json.

---

## server/routes.ts — API Routes

### Error handling + correctness

- [x] ✅ **#21** P1 Reliability — No try/catch in any route handler. Failures become generic 500s.
  > Fixed: All 25 route handlers wrapped with asyncHandler() that catches and forwards errors.
- [ ] ⬜ **#22** P2 Reliability — parseIdParam throws unhandled; relies on global error handler via nonstandard status property.

### Data integrity risks (transactions)

- [x] ✅ **#23** P0 Data Loss — PUT /api/projects/:id/nodes deletes ALL nodes then recreates. If create fails → permanent loss. Needs DB transaction.
  > Fixed: Now uses transactional replaceNodes() method.
- [x] ✅ **#24** P0 Data Loss — PUT /api/projects/:id/edges same delete/recreate risk.
  > Fixed: Now uses transactional replaceEdges() method.
- [x] ✅ **#25** P0 Data Loss — PUT /api/projects/:id/validation same delete/recreate risk.
  > Fixed: Now uses transactional replaceValidationIssues() method.

### Validation + REST consistency

- [x] ✅ **#26** P1 Security/API — PATCH /api/bom/:id has no input validation; passes req.body directly to storage.
  > Fixed: Now validates with insertBomItemSchema.partial().omit({ projectId: true }).safeParse().
- [ ] ⬜ **#27** P2 API Design — Inconsistent URL patterns: BOM list/create: /api/projects/:id/bom vs BOM update/delete: /api/bom/:id. Validation similarly inconsistent.

### Scaling limitations

- [ ] ⬜ **#28** P2 Performance — No pagination on list endpoints (projects, nodes, bom, chat, history) → unbounded payloads.
- [ ] ⬜ **#29** P2 UX/API — No sorting guarantees; returns arbitrary DB order.

### Missing endpoints / capability gaps

- [ ] ⬜ **#30** P2 API Design — Missing DELETE for projects.
- [ ] ⬜ **#31** P2 API Design — Missing DELETE for chat messages (no per-message delete or clear chat).
- [ ] ⬜ **#32** P2 API Design — Missing DELETE for history items (no clear history).
- [ ] ⬜ **#33** P2 API Design — Missing individual node/edge update endpoints. Only bulk replace via PUT (no PATCH single node/edge).

### Seeding issues

- [ ] ⬜ **#34** P2 Reliability — Seed endpoint not idempotent; returns first project if exists but doesn't verify/update seed data.
- [x] ✅ **#35** P0 Security — Seed endpoint accessible in production (no env guard).
  > Fixed: Returns 404 when NODE_ENV === "production".
- [x] 🔶 **#36** P2 Performance — BOM seeding inserts one-by-one, not bulk; slower and not atomic.
  > Partial: Now uses Promise.all() for parallel insertion, but still not atomic (no transaction wrapper).

### AI endpoints duplication + SSE concerns

- [ ] ⬜ **#37** P3 DX/Tech Debt — aiRequestSchema duplicated between /api/chat/ai and /api/chat/ai/stream.
- [ ] ⬜ **#38** P3 DX/Tech Debt — appState construction duplicated (~50 lines repeated).
- [x] ✅ **#39** P1 Correctness — projectId defaults to 1 silently if missing; may send wrong project state to AI.
  > Fixed: Made projectId required in both AI chat endpoint Zod schemas. Removed fallback to 1.
- [x] ✅ **#40** P1 Reliability — SSE headers missing X-Accel-Buffering: no (reverse proxies may buffer).
  > Fixed: Added X-Accel-Buffering: no header.
- [ ] ⬜ **#41** P1 Reliability — SSE doesn't handle backpressure; res.write() can buffer indefinitely.
- [x] ✅ **#42** P1 Reliability — No timeout on AI stream; hangs forever if provider stalls.
  > Fixed: Added 120-second stream timeout.

### Structural/API hygiene

- [ ] ⬜ **#43** P3 Tech Debt — registerRoutes receives httpServer but doesn't use it (unnecessary coupling).
- [x] ✅ **#44** P1 Ops/Observability — No /api/health or /api/status endpoint.
  > Fixed: Added GET /api/health that verifies DB connectivity.
- [ ] ⬜ **#45** P2 API Design — No API versioning (/api/v1/...), making future breaking changes painful.

---

## server/storage.ts — Data Access Layer

### Atomicity + correctness

- [x] ✅ **#46** P0 Data Loss — No transactions anywhere (bulk delete/recreate not atomic). Root cause of data-loss risk.
  > Fixed: Added replaceNodes, replaceEdges, replaceValidationIssues using db.transaction().
- [x] ✅ **#47** P1 Security/Data Integrity — updateBomItem accepts Partial<InsertBomItem> with no validation; allows changing dangerous fields (e.g., projectId).
  > Fixed: updateBomItem now strips projectId from update data and verifies ownership.
- [x] ✅ **#48** P1 Security/Data Integrity — updateProject accepts Partial<InsertProject>; no guard against nulling fields unexpectedly.
  > Fixed: PATCH /api/projects/:id now rejects empty/whitespace-only name with 400.
- [x] ✅ **#49** P0 Security — deleteBomItem doesn't verify ownership (delete by ID regardless of project).
  > Fixed: Now requires projectId and uses AND condition.
- [x] ✅ **#50** P0 Security — deleteValidationIssue same cross-project deletion risk.
  > Fixed: Now requires projectId and uses AND condition.

### Data lifecycle + recoverability

- [ ] ⬜ **#51** P2 Reliability — No soft deletes (no audit trail / recovery).

### Performance + scaling

- [ ] ⬜ **#52** P2 Performance — No caching layer; every request hits DB (nodes/edges/project info are frequent reads).
- [ ] ⬜ **#53** P2 Performance — Chat messages: no limit/pagination (returns ALL rows).
- [ ] ⬜ **#54** P2 Performance — History items: no limit/pagination.
- [ ] ⬜ **#55** P2 Reliability — Bulk create methods may hit PG parameter limits (65535). Needs batching/chunking.

### Error quality + interface gaps

- [x] 🔶 **#56** P2 Observability — No error wrapping/context; raw DB errors bubble up.
  > Partially: Global error handler now sanitizes 5xx for clients, but storage layer still doesn't wrap errors with context.
- [ ] ⬜ **#57** P2 API Design — No deleteProject method (CRUD missing D for projects).
- [ ] ⬜ **#58** P2 API Design — No update method for individual nodes/edges (missing updateNode(id) / updateEdge(id)).
- [ ] ⬜ **#59** P2 API Design — No getBomItem(id) (only by project).
- [ ] ⬜ **#60** P2 API Design — No methods to delete chat messages/history items (create-only).

---

## server/ai.ts — AI Integration

### Key handling + safety

- [ ] ⬜ **#61** P1 Security — API key sent in request body every time (higher exposure surface). Prefer server-side storage.
- [x] ✅ **#62** P0 Security — No API key sanitization in error messages; provider errors could echo secrets.
  > Fixed: Both processAIMessage and streamAIMessage now redact sk-* and AIza* patterns from all error messages.
- [x] ✅ **#63** P1 Security — Streaming error handler writes raw error to SSE stream (potentially exposes internals).
  > Fixed: Error messages sanitized and API keys redacted before sending to client.

### Performance + cost

- [ ] ⬜ **#64** P2 Performance — Anthropic client instantiated on every request; prevents reuse.
- [ ] ⬜ **#65** P2 Performance — Gemini client instantiated on every request; same issue.
- [ ] ⬜ **#66** P2 Cost/Performance — System prompt is enormous (~5000+ tokens) each request → higher cost.
- [ ] ⬜ **#67** P2 Performance — System prompt rebuilt every request (no caching when state unchanged).
- [ ] ⬜ **#68** P2 Product — max_tokens: 4096 hardcoded; no user configurability.

### History/context handling (duplication)

- [ ] ⬜ **#69** P3 Tech Debt — Chat history sliced to last 10 messages in multiple places; should be centralized + configurable.
- [ ] ⬜ **#70** P3 Tech Debt — Duplicate system message filtering across processAIMessage, streamAIMessage, and routes.

### Types + validation

- [ ] ⬜ **#71** P2 Type Safety — (n.data as any)?.description bypasses TS; jsonb shape should be typed.
- [x] ✅ **#72** P1 Reliability/Safety — No input sanitization/limits on user messages (length/content).
  > Fixed: 32,000 character limit enforced in both processAIMessage and streamAIMessage.
- [x] ✅ **#73** P1 Safety — AI actions not validated: JSON parsed but not checked against AIAction shape.
  > Fixed: parseActionsFromResponse now validates each action is a non-null object with string type property.
- [ ] ⬜ **#74** P2 Reliability — Error categorization via string matching (includes("401")) is fragile; should use structured error codes.
- [ ] ⬜ **#75** P2 UX/Reliability — No abort/cancel mechanism for AI streams; provider continues generating after client disconnect.
- [ ] ⬜ **#76** P2 Reliability — No request deduplication; double-send triggers duplicate AI calls.
- [ ] ⬜ **#77** P2 Correctness — parseActionsFromResponse only matches JSON at end of response; can miss actions if formatting varies.
- [ ] ⬜ **#78** P2 Consistency — Temperature not consistently validated/forwarded across endpoints (range checks should be unified).
- [ ] ⬜ **#79** P2 Reliability — Gemini mid-stream errors less graceful than Anthropic's handling.

---

## shared/schema.ts — Database Schema

### Constraints + integrity

- [x] ✅ **#80** P1 Data Integrity — No unique constraint on nodeId within a project → duplicates possible. Needs composite unique (projectId, nodeId).
  > Fixed: Added uniqueIndex("uq_arch_nodes_project_node") on (projectId, nodeId).
- [x] ✅ **#81** P1 Data Integrity — No unique constraint on edgeId within a project → duplicates possible.
  > Fixed: Added uniqueIndex("uq_arch_edges_project_edge") on (projectId, edgeId).

### Money correctness

- [x] ✅ **#82** P1 Data Integrity — unitPrice and totalPrice are real (float) → rounding errors for money. Use numeric/decimal or integer cents.
  > Fixed: Changed from real to numeric(10,4). Seed data and AI mapping updated for string type.
- [ ] ⬜ **#83** P2 Data Integrity — totalPrice stored but should be computed (quantity * unitPrice) to avoid denormalization drift.

### Enum constraints

- [ ] ⬜ **#84** P2 Data Integrity — validationIssues.severity is text; should be enum (error|warning|info).
- [ ] ⬜ **#85** P2 Data Integrity — bomItems.status is text; should be constrained to known statuses.
- [ ] ⬜ **#86** P2 Data Integrity — chatMessages.role is text; should be enum (user|assistant|system).
- [ ] ⬜ **#87** P2 Data Integrity — nodeType is free text (no constraint).

### Indexing + performance

- [x] ✅ **#88** P1 Performance — No indexes on foreign keys (projectId not indexed by default in Postgres). Project-filtered queries may full-scan.
  > Fixed: Added indexes on projectId for all 6 child tables.
- [ ] ⬜ **#89** P2 Performance — No composite indexes for common queries (e.g., (projectId, timestamp) for ordered chat).

### Auditing + change tracking

- [ ] ⬜ **#90** P2 Product/Observability — projects has no createdAt/updatedAt.
- [ ] ⬜ **#91** P2 Product — architectureNodes has no updatedAt.
- [ ] ⬜ **#92** P2 Product — bomItems has no updatedAt.

### JSON shape safety

- [ ] ⬜ **#93** P2 Data Integrity — architectureNodes.data is untyped jsonb (no schema validation).
- [ ] ⬜ **#94** P2 Data Integrity — architectureEdges.style is untyped jsonb.

### Minor defaults

- [ ] ⬜ **#95** P3 DX — projects.description nullable (fine), but no default empty string (optional taste issue).

---

## server/vite.ts — Dev Server

- [ ] ⬜ **#96** P2 Performance — nanoid() appended to main.tsx on every load (?v=) disables browser caching unnecessarily (Vite/HMR already handles this).
- [ ] ⬜ **#97** P2 DX — process.exit(1) on Vite logger error is extremely aggressive for development.
- [ ] ⬜ **#98** P3 DX — import.meta.dirname usage can be surprising; document why/where it's required.

---

## server/static.ts — Production Static Serving

- [x] ✅ **#99** P2 Performance — No caching headers on static assets (Cache-Control, ETag, Last-Modified tuning).
  > Fixed: Added maxAge, etag, lastModified, and immutable cache for hashed assets.
- [ ] ⬜ **#100** P2 Performance — No compression middleware (gzip/brotli). JS/CSS served uncompressed.
- [x] ✅ **#101** P2 Performance — SPA catch-all (index.html) sends no cache directives.
  > Fixed: Added Cache-Control: no-cache on SPA fallback.

---

## package.json — Dependencies

- [x] ✅ **#102** P3 Security/Tech Debt — Installed but unused: passport, passport-local, express-session, connect-pg-simple, memorystore (bigger attack surface, slower installs).
  > Fixed: All removed.
- [x] ✅ **#103** P3 Tech Debt — ws installed but unused.
  > Fixed: Removed.
- [ ] ⬜ **#104** P2 Reliability — nanoid used in vite.ts but not explicitly listed (may be transitive; should be explicit).
- [ ] ⬜ **#105** P3 DX — zod-validation-error installed but unused (could format Zod errors nicely).
- [ ] ⬜ **#106** P2 DX — TypeScript pinned to 5.6.3 (not latest; consider bumping for fixes/features).

---

## Cross-cutting Concerns

- [ ] ⬜ **#107** P0 Security — No authentication/authorization: any client can read/write any project's data.
- [x] ✅ **#108** P1 Security — No input length limits on text fields (names, descriptions, labels, chat messages) → storage abuse risk.
  > Fixed: Added .max() constraints to AI chat Zod schemas (message: 32k, model: 200, apiKey: 500, customSystemPrompt: 10k, changeDiff: 50k).
- [ ] ⬜ **#109** P1 Security — No CSRF protection for mutation endpoints.
- [ ] ⬜ **#110** P2 Reliability — No per-endpoint payload size validation (only global 1MB cap).
- [ ] ⬜ **#111** P2 Observability — No structured logging (console logs only). Hard to aggregate/analyze in prod.
- [ ] ⬜ **#112** P2 Ops — No metrics/monitoring (latency, error rates, DB query timing).
- [ ] ⬜ **#113** P2 DX — No API documentation (OpenAPI/Swagger) to define request/response contracts.
- [ ] ⬜ **#114** P1 Reliability — No backend tests (unit tests for storage, integration tests for routes, tests for AI parsing).
- [ ] ⬜ **#115** P2 Reliability — No environment variable validation beyond DATABASE_URL (missing validation for PORT, NODE_ENV, etc.).
- [x] ✅ **#116** P1 Reliability — Request timeout: SSE now has 120s timeout, but non-SSE routes still have no request timeout.
  > Fixed: 30s request timeout middleware added for non-SSE routes. SSE keeps 120s timeout.

---

## Remaining Open Items by Priority

### P0 — Critical (1 remaining)
| # | Finding | File | Status |
|---|---------|------|--------|
| 107 | No authentication/authorization | Cross-cutting | ⬜ Open |

### P1 — High (4 remaining)
| # | Finding | File | Status |
|---|---------|------|--------|
| 41 | SSE doesn't handle backpressure | server/routes.ts | ⬜ |
| 61 | API key sent in request body every time | server/ai.ts | ⬜ |
| 109 | No CSRF protection | Cross-cutting | ⬜ |
| 114 | No backend tests | Cross-cutting | ⬜ |

### P2 — Medium (55 remaining: 53 open + 2 partial)
See items marked ⬜ or 🔶 above with P2 tag. Key areas:
- **Performance:** Pagination (#28), sorting (#29), caching (#52), compression (#100)
- **API gaps:** Missing DELETE endpoints (#30-33, #57, #60), individual node/edge updates (#58)
- **AI improvements:** Client reuse (#64-65), prompt optimization (#66-67), action parsing (#77)
- **Schema:** Enum constraints (#84-87), composite indexes (#89), timestamps (#90-92), jsonb typing (#93-94)
- **Observability:** Request IDs (#13), structured logging (#111), metrics (#112)

### P3 — Low (9 remaining)
See items marked ⬜ above with P3 tag. Mostly DX/cleanup items.

---

## Backlog Framing (suggested attack order)

### Quick Wins (high ROI, low risk) — mostly done
- ✅ Remove unused dependencies
- ✅ Stop logging full response bodies + add truncation
- ✅ Add /api/health
- ⬜ Add pagination + sorting on list endpoints
- ✅ Add Zod validation to PATCH /api/bom/:id
- ⬜ Add request IDs / correlation IDs

### Medium Efforts (stability + scale) — partially done
- ✅ Add DB transactions for bulk replace operations
- ⬜ Centralize duplicated AI endpoint logic (shared schema + appState builder + history slicing)
- ✅ Add indexes on FK columns
- ✅ Add composite unique constraints (nodeId, edgeId per project)
- ✅ Add request timeout + SSE anti-buffer headers (SSE: 120s, non-SSE: 30s) — backpressure still open

### Big Swings (structural) — not started
- ⬜ Add auth + project-level authorization
- ⬜ Add structured logging (pino) + metrics
- ⬜ Add API versioning
- ⬜ Add tests (storage + routes + AI action validation)

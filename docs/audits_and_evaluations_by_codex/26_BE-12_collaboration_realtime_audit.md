# BE-12 Audit: Collaboration + Realtime

Date: 2026-03-06  
Auditor: Codex  
Section: BE-12 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Realtime collaboration core:
  - `server/collaboration.ts`
  - `shared/collaboration.ts`
- Collaboration-adjacent API routes:
  - `server/routes/comments.ts`
  - `server/routes/design-history.ts`
  - `server/routes/chat-branches.ts`
  - `server/routes/history.ts`
- Storage layer backing those routes:
  - `server/storage/misc.ts`
  - `server/storage/chat.ts`
  - `server/storage/projects.ts`
- Wiring/docs/auth context:
  - `server/index.ts`
  - `server/routes.ts`
  - `server/routes/auth-middleware.ts`
  - `server/api-docs.ts`
  - `shared/schema.ts`
- Test surface reviewed:
  - `server/__tests__/collaboration.test.ts`
  - reference-search across `server/__tests__/` for collaboration-route coverage

## Collaboration + Realtime Surface Snapshot (Current)
- WebSocket collaboration endpoint declarations: `1` (`/ws/collab`)
- Non-test callsites attaching collaboration server: `0` (factory exists, no runtime bootstrap call)
- Collaboration-adjacent REST endpoints reviewed: `17`
  - comments: `6`
  - snapshots: `5`
  - chat branches: `2`
  - history: `4`
- Collaboration server tests in `server/__tests__/collaboration.test.ts`: `47` (`it(...)`)
- Route-level tests found for comments/snapshots/chat-branches routes: `0`

## Severity Key
- `P0`: cross-project data/control risk or service-kill class reliability flaw
- `P1`: major correctness/reliability/security hardening gap
- `P2`: medium-risk robustness/operability gap
- `P3`: low-risk consistency/docs/test-surface gap

## Findings

### 1) `P0` WebSocket project authorization is missing (any valid session can join arbitrary project IDs)
Evidence:
- Connection accepts `projectId` + `sessionId` from query and validates session:
  - `server/collaboration.ts:81`
  - `server/collaboration.ts:82`
  - `server/collaboration.ts:97`
- Non-owner users are still admitted with `editor` role:
  - `server/collaboration.ts:107`
  - `server/collaboration.ts:108`
- Room join/state sync/broadcast still proceed after non-owner role assignment:
  - `server/collaboration.ts:115`
  - `server/collaboration.ts:128`
  - `server/collaboration.ts:148`
  - `server/collaboration.ts:151`
- `isProjectOwner` returns `false` when project does not exist, but caller does not deny on false:
  - `server/storage/projects.ts:53`
  - `server/storage/projects.ts:58`

What is happening:
- Collaboration admission currently means “is this a valid session?” not “does this user have access to this project?”

Why this matters:
- Cross-project presence visibility and live collaboration message injection are possible with guessed/known project IDs.

Fix recommendation:
- Add explicit project access gate before room join:
  - deny when user is not owner/collaborator
  - deny when project does not exist
- Introduce collaborator membership model (or equivalent policy) and map to `owner/editor/viewer`.

---

### 2) `P0` Locking is not project-scoped, causing cross-project lock collisions and lock-state leakage
Evidence:
- Global lock map uses string key only:
  - `server/collaboration.ts:54`
- Lock key omits project context:
  - `server/collaboration.ts:365`
  - `shared/collaboration.ts:76`
- State sync sends all active locks without project filtering:
  - `server/collaboration.ts:328`
  - `server/collaboration.ts:330`
  - `server/collaboration.ts:341`
- Expired lock cleanup broadcasts release to all rooms:
  - `server/collaboration.ts:429`
  - `server/collaboration.ts:430`
  - `server/collaboration.ts:431`

What is happening:
- A lock like `node:n1` in one project can block or leak into another project with the same entity id/type.

Why this matters:
- Cross-project editing interference and user-id leakage in lock-denied/state-sync payloads.

Fix recommendation:
- Scope locks by project (`projectId:entityType:entityId`) or nested map `Map<projectId, Map<entityKey, LockEntry>>`.
- Restrict lock sync/cleanup broadcasts to the owning project room only.

---

### 3) `P0` Collaboration REST routes allow cross-project tampering and identity spoofing
Evidence (comments):
- Route validates `:id` but performs write by `commentId` only:
  - `server/routes/comments.ts:80`
  - `server/routes/comments.ts:87`
  - `server/routes/comments.ts:99`
  - `server/routes/comments.ts:103`
  - `server/routes/comments.ts:115`
  - `server/routes/comments.ts:118`
  - `server/routes/comments.ts:130`
  - `server/routes/comments.ts:132`
- Storage methods update/delete by comment id only (no project predicate):
  - `server/storage/misc.ts:340`
  - `server/storage/misc.ts:344`
  - `server/storage/misc.ts:352`
  - `server/storage/misc.ts:361`
  - `server/storage/misc.ts:369`
  - `server/storage/misc.ts:378`
  - `server/storage/misc.ts:386`
  - `server/storage/misc.ts:389`
- Client-supplied identity fields accepted:
  - create comment `userId` in body:
    - `server/routes/comments.ts:12`
    - `server/routes/comments.ts:69`
  - resolve comment `resolvedBy` in body:
    - `server/routes/comments.ts:101`

Evidence (snapshots):
- Route validates project id but fetches/deletes snapshot by snapshot id only:
  - `server/routes/design-history.ts:29`
  - `server/routes/design-history.ts:31`
  - `server/routes/design-history.ts:71`
  - `server/routes/design-history.ts:73`
  - `server/routes/design-history.ts:88`
- Storage methods for snapshots are id-only:
  - `server/storage/misc.ts:261`
  - `server/storage/misc.ts:264`
  - `server/storage/misc.ts:282`
  - `server/storage/misc.ts:285`

Evidence (authz policy inconsistency):
- Project ownership middleware exists but is only applied on project patch/delete routes:
  - `server/routes/projects.ts:66`
  - `server/routes/projects.ts:100`

What is happening:
- Collaboration-adjacent routes trust route `:id` for URL shape but not for actual write/read ownership constraints on target record ids.
- Comment identity fields can be impersonated by caller-controlled body values.

Why this matters:
- Cross-project comment/snapshot modification and audit-trail integrity loss are possible.

Fix recommendation:
- Enforce project predicates in storage mutations (`WHERE id = ? AND project_id = ?`).
- Resolve actor identity from authenticated session (`req.userId`), never caller-provided `userId`/`resolvedBy`.
- Apply access middleware consistently across collaboration routes.

---

### 4) `P0` Unhandled errors in WebSocket handshake path can trigger whole-process shutdown
Evidence:
- Connection handler launches async flow without catch:
  - `server/collaboration.ts:62`
  - `server/collaboration.ts:63`
- `onConnection` performs async operations that can throw/reject:
  - `server/collaboration.ts:97`
  - `server/collaboration.ts:107`
  - `server/collaboration.ts:111`
- Global unhandled rejection hook shuts server down:
  - `server/index.ts:435`
  - `server/index.ts:439`

What is happening:
- A rejection in handshake/auth/storage lookup can escape and hit `unhandledRejection`, which triggers graceful shutdown.

Why this matters:
- A transient backend error during ws connect can become a service-level outage.

Fix recommendation:
- Wrap `onConnection` call with explicit `.catch(...)` and close that socket safely (`1011`) instead of letting rejection bubble globally.
- Add targeted tests for auth/storage throw paths during connection.

---

### 5) `P1` Collaboration server is implemented but not attached to runtime HTTP server
Evidence:
- Collaboration factory exists:
  - `server/collaboration.ts:605`
  - `server/collaboration.ts:607`
- Server boot creates/listens HTTP server but never attaches collaboration:
  - `server/index.ts:142`
  - `server/index.ts:398`

What is happening:
- Realtime collaboration logic exists as code/test surface but is not wired into app boot.

Why this matters:
- Feature appears available in codebase but is effectively non-operational in runtime.

Fix recommendation:
- Instantiate collaboration server during boot and integrate it into graceful shutdown.
- Add startup/health visibility for ws collaboration status.

---

### 6) `P1` Same-user multi-tab behavior is unsafe (connection stomping and stale disconnect side-effects)
Evidence:
- Room index is single `userId -> ClientEntry`:
  - `server/collaboration.ts:53`
  - `server/collaboration.ts:128`
- Disconnect always deletes by `userId`:
  - `server/collaboration.ts:160`
  - `server/collaboration.ts:164`

What is happening:
- A second tab for same user overwrites room entry. If old tab closes later, it can remove the newer live entry and emit false leave/lock-release behavior.

Why this matters:
- Real users commonly open multiple tabs/windows; current model can produce phantom presence and lock churn.

Fix recommendation:
- Track multiple connections per user (e.g., `Map<userId, Set<ClientEntry>>`) or intentionally close old socket before replacing with explicit policy.

---

### 7) `P1` Session token is transmitted in WebSocket query string
Evidence:
- Server expects `sessionId` query parameter:
  - `server/collaboration.ts:82`
- Client sends session id in URL:
  - `client/src/lib/collaboration-client.ts:87`

What is happening:
- Session identifier is embedded in URL.

Why this matters:
- URL-based credentials can leak via proxy/access logs, browser tooling, and operational telemetry.

Fix recommendation:
- Move to header/cookie/subprotocol token during ws upgrade, or short-lived one-time collaboration token exchange.

---

### 8) `P2` Heartbeat policy ignores configured missed-pong threshold
Evidence:
- `MAX_MISSED_PONGS` constant is defined/imported:
  - `shared/collaboration.ts:101`
  - `server/collaboration.ts:23`
- Heartbeat terminates after one full missed cycle (no counter):
  - `server/collaboration.ts:501`
  - `server/collaboration.ts:502`
  - `server/collaboration.ts:506`

What is happening:
- Heartbeat behavior is stricter than declared contract and can disconnect users on short network blips.

Why this matters:
- Unstable connections (mobile/VPN/weak Wi-Fi) may churn sessions and create noisy reconnect loops.

Fix recommendation:
- Track `missedPongs` per connection and enforce threshold using `MAX_MISSED_PONGS`.

---

### 9) `P2` WebSocket message validation and abuse controls are shallow
Evidence:
- WebSocket server created without explicit payload-size guard:
  - `server/collaboration.ts:60`
- Message validator only checks generic field types:
  - `shared/collaboration.ts:81`
  - `shared/collaboration.ts:85`
- Per-message payload schemas are not validated before type casts:
  - `server/collaboration.ts:238`
  - `server/collaboration.ts:241`

What is happening:
- Malformed or oversized message payloads are not constrained with strict per-type contracts.

Why this matters:
- Robustness and abuse resistance are weaker than the rest of backend API surfaces.

Fix recommendation:
- Add strict zod schemas per message type and cap ws payload size (`maxPayload`).
- Add rate/volume controls for high-frequency message types beyond cursor throttle.

---

### 10) `P3` API docs and test surface are out of sync with collaboration route complexity
Evidence:
- API docs list omits collaboration route families and ws collab contract:
  - `server/api-docs.ts:11`
  - `server/api-docs.ts:55`
- Collaboration server has strong unit tests:
  - `server/__tests__/collaboration.test.ts:166`
- Route-level tests for comments/snapshots/chat-branches were not found in `server/__tests__/` (reference search count: `0`).

What is happening:
- High-risk route modules in this section have low explicit test coverage and are under-documented.

Why this matters:
- Regression risk rises at authz/ownership boundaries, and integration consumers lack clear contract docs.

Fix recommendation:
- Add API docs for comments/snapshots/chat-branches/history + ws handshake/message contracts.
- Add HTTP integration tests for project-scoped ownership/tamper cases.

## What Is Already Good
- Realtime collaboration logic has a substantial dedicated unit test suite:
  - `server/__tests__/collaboration.test.ts`
- Core collaboration behavior includes:
  - room join/leave flows
  - cursor throttling
  - lock grant/deny/expiry
  - viewer role restrictions
  - heartbeat checks
  - malformed-message handling
- Shared collaboration types/constants are centralized in:
  - `shared/collaboration.ts`

## Test Coverage Assessment (BE-12)
- Strong:
  - `server/__tests__/collaboration.test.ts` covers many collaboration core mechanics.
- Gaps:
  - No route-level tests found for comments/snapshots/chat-branches/history authorization and project-scope boundaries.
  - No runtime wiring test proving collaboration server is attached during app boot.
  - No tests for cross-project lock isolation.
  - No tests for same-user multi-tab behavior.
  - No tests for handshake exception containment (reject without process-level fallout).

## Improvements and Enhancements
- Add explicit collaborator membership model and invite workflow (owner/editor/viewer) and enforce in both REST + ws paths.
- Move ws auth to short-lived collaboration token exchange.
- Add project-scoped lock model and optional lock heartbeats/renewals.
- Introduce server-side event log for collaboration ops (auditability + replay/debug).
- Add operational metrics:
  - active rooms/users
  - lock contention rate
  - reconnect churn
  - dropped/invalid message counts

## Decision Questions Before BE-13
- Should non-owners default to `viewer` instead of `editor` until explicit collaboration permission exists?
- Should “ownerless legacy project” behavior remain open-access, or be migrated to explicit ownership?
- Is collaboration expected to be live now, or intentionally parked behind a future bootstrap flag?
- Should route-level collaboration actions (comments/snapshots/history) require ownership or allow project-wide collaborator writes?

## Suggested Fix Order
1. Patch `P0` authz/isolation issues (ws admission, lock scoping, route project predicates, identity spoofing removal).
2. Contain ws handshake exceptions to prevent process-level shutdown.
3. Wire collaboration server into bootstrap + graceful shutdown (or explicitly feature-flag/disable with clear status).
4. Add route integration tests for cross-project tamper scenarios.
5. Tighten ws validation/rate controls and align heartbeat with declared missed-pong policy.
6. Update API docs/contracts for collaboration REST + ws surfaces.

## Bottom Line
BE-12 has strong local test investment in collaboration mechanics, but high-risk authorization and isolation boundaries are under-enforced. The biggest blockers are cross-project access/control gaps, lock scoping leakage, and handshake error containment; those should be fixed before treating collaboration/realtime as production-safe.

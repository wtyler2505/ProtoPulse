# FE-12 Audit: Collaboration + Offline/PWA

Date: 2026-03-06  
Auditor: Codex  
Section: FE-12 (from master map)  
Method: Code + test-surface inspection only (no vitest runtime per user direction).

## Scope Reviewed
- Core FE-12 modules:
  - `client/src/lib/collaboration-client.ts`
  - `client/src/lib/offline-sync.ts`
  - `client/src/lib/indexed-db-manager.ts`
  - `client/src/lib/pwa-manager.ts`
  - `client/src/main.tsx`
  - `client/public/sw.js`
- Contract/runtime references:
  - `client/src/lib/queryClient.ts`
  - `server/index.ts`
  - `server/collaboration.ts`
  - `server/routes/architecture.ts`
  - `server/routes/bom.ts`
  - `server/circuit-routes/*` route patterns (sampling for shape consistency)
- FE-12 test surface:
  - `client/src/lib/__tests__/collaboration-client.test.ts`
  - `client/src/lib/__tests__/offline-sync.test.ts`
  - `client/src/lib/__tests__/indexed-db-manager.test.ts`
  - `client/src/lib/__tests__/pwa-manager.test.ts`

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact behavior break
- `P2`: medium reliability/interop risk
- `P3`: lower-risk quality/debt issue

## Findings

### 1) `P1` FE-12 runtime paths are mostly not integrated into real app flows
Evidence:
- `client/src/main.tsx:27`
- `client/src/main.tsx:28`
- `client/src/main.tsx:30`
- `rg -n "useOfflineSync|OfflineSyncManager|useIndexedDb|useCollaboration|CollaborationClient" client/src --glob '!**/__tests__/**'` shows only definitions inside FE-12 lib files (no feature-level consumers).

What is happening:
- Boot currently initializes `PwaManager` and attempts SW registration.
- Collaboration hook/client, offline sync manager, and IndexedDB hook are not wired into workspace/view flows.

Why this matters:
- FE-12 capabilities exist in isolation but are not reachable from core user workflows.

Fix recommendation:
- Add an explicit FE-12 integration layer (provider + status bar + mutation interception + conflict UI + reconnect UX) and mount it in the app shell/workspace.

---

### 2) `P1` Collaboration WebSocket server is not attached in production server boot
Evidence:
- `client/src/lib/collaboration-client.ts:87`
- `server/collaboration.ts:60`
- `server/collaboration.ts:605`
- `rg -n "attachCollaborationServer\\(" server --glob '!**/__tests__/**'` only returns `server/collaboration.ts`.

What is happening:
- Client expects `/ws/collab?...`.
- Collaboration server implementation exists, but no non-test boot path calls `attachCollaborationServer(server)`.

Why this matters:
- Any future UI wiring to `useCollaboration` will fail at transport level.

Fix recommendation:
- Attach collaboration server in `server/index.ts` after HTTP server creation and define lifecycle/error logging policy.

---

### 3) `P1` Offline sync API contract is incompatible with current backend routes and auth middleware
Evidence:
- `client/src/lib/offline-sync.ts:332`
- `client/src/lib/offline-sync.ts:338`
- `client/src/lib/offline-sync.ts:339`
- `client/src/lib/offline-sync.ts:343`
- `server/routes/architecture.ts:19`
- `server/routes/architecture.ts:44`
- `server/routes/bom.ts:16`
- `server/routes/bom.ts:73`
- `server/index.ts:196`
- `server/index.ts:202`
- `client/src/lib/__tests__/offline-sync.test.ts:247`
- `client/src/lib/__tests__/offline-sync.test.ts:264`

What is happening:
- Sync code builds URLs as `/api/${entity}/${entityId}` and maps update to `PUT`.
- Most actual resource routes are project-scoped and use `PATCH` for single-item updates.
- Sync requests do not include `X-Session-Id`.

Why this matters:
- Real sync attempts are likely to fail with 401/404/405, increasing retries and leaving local changes unsynced.

Fix recommendation:
- Replace raw fetch pathing with a project-aware endpoint resolver and `apiRequest` auth/header behavior.
- Define one typed map: offline entity -> route template + method + ETag policy.

---

### 4) `P1` `PwaManager.triggerSync` is a simulated sync that can claim success without server persistence
Evidence:
- `client/src/lib/pwa-manager.ts:470`
- `client/src/lib/pwa-manager.ts:499`
- `client/src/lib/pwa-manager.ts:506`

What is happening:
- Method comment states this is not real server sync.
- Pending changes are marked synced in memory/localStorage directly.

Why this matters:
- UI can report "synced" while backend state is unchanged.
- If this path is used in production UI, users can lose changes silently.

Fix recommendation:
- Deprecate direct `PwaManager.triggerSync` for data mutations.
- Route all sync through `OfflineSyncManager` (or a unified engine) with real API responses.

---

### 5) `P1` Connectivity recovery is not wired to browser online/offline lifecycle
Evidence:
- `client/src/lib/pwa-manager.ts:188`
- `client/src/lib/pwa-manager.ts:239`
- `client/src/lib/offline-sync.ts:91`
- `client/src/lib/offline-sync.ts:93`
- `rg -n "addEventListener\\('online'|addEventListener\\('offline'|beforeinstallprompt|appinstalled|navigator\\.serviceWorker\\.addEventListener\\('message'|registration\\.sync" client/src --glob '!**/__tests__/**'` returns no runtime matches.

What is happening:
- Connection state starts from `navigator.onLine` but no browser network event listeners were found.
- Auto-sync depends on `onConnectionChange`, but no runtime code appears to drive those transitions.

Why this matters:
- Offline-to-online recovery can remain stuck unless some other path manually sets status.

Fix recommendation:
- Register `window` connectivity listeners in PWA boot path and propagate transitions to sync orchestrator.

---

### 6) `P2` Split-brain offline state: localStorage queue (`PwaManager`) vs IndexedDB queue (`OfflineSyncManager`)
Evidence:
- `client/src/lib/pwa-manager.ts:97`
- `client/src/lib/pwa-manager.ts:403`
- `client/src/lib/pwa-manager.ts:807`
- `client/src/lib/offline-sync.ts:134`
- `client/src/lib/offline-sync.ts:173`

What is happening:
- One queue/state lives in `PwaManager` localStorage.
- Another queue/state lives in IndexedDB and is used by real sync engine.
- No reconciliation layer is present.

Why this matters:
- Status, pending counts, and conflict UX can drift between two sources of truth.

Fix recommendation:
- Choose one canonical persistence source (recommended: IndexedDB).
- Make PWA/UI selectors read from that source only.

---

### 7) `P2` `useOfflineSync` pending-count freshness is incomplete
Evidence:
- `client/src/lib/offline-sync.ts:426`
- `client/src/lib/offline-sync.ts:428`
- `client/src/lib/offline-sync.ts:448`
- `client/src/lib/offline-sync.ts:451`

What is happening:
- `pendingCount` refreshes on mount and `sync-complete`.
- There is no refresh trigger when a new offline mutation is queued.

Why this matters:
- UI pending indicators can lag behind actual queued changes.

Fix recommendation:
- Emit/subscribe to "queue-updated" events or refresh count after `interceptMutation`.

---

### 8) `P2` Collaboration hook has identity/role hydration gaps
Evidence:
- `client/src/lib/collaboration-client.ts:56`
- `client/src/lib/collaboration-client.ts:330`
- `client/src/lib/collaboration-client.ts:343`
- `client/src/lib/collaboration-client.ts:361`
- `client/src/lib/collaboration-client.ts:502`
- `client/src/lib/collaboration-client.ts:507`
- `client/src/lib/collaboration-client.ts:508`
- `client/src/lib/collaboration-client.ts:232`
- `client/src/lib/collaboration-client.ts:235`
- `client/src/lib/__tests__/collaboration-client.test.ts:476`

What is happening:
- Client defaults `myUserId` to `0`.
- Hook never sets userId from auth/session context.
- Hook state `myRole` is updated on `role-change` event only, not after initial `state-sync`.
- Tests manually call `setUserId(...)` to make flows pass.

Why this matters:
- If wired as-is, local role/identity UX can be stale or incorrect.

Fix recommendation:
- Accept authenticated userId as hook input and set it during connect.
- Sync hook `myRole` after `state-sync`/`users-change` in addition to role-change.

---

### 9) `P2` PWA cache/storage telemetry is not linked to actual Cache API state
Evidence:
- `client/src/lib/pwa-manager.ts:355`
- `client/src/lib/pwa-manager.ts:390`
- `client/src/lib/pwa-manager.ts:697`
- `client/public/sw.js:77`
- `client/public/sw.js:95`
- `client/public/sw.js:183`
- `client/public/sw.js:205`

What is happening:
- Manager tracks `cachedResources` in local state/localStorage.
- Service worker caches independently via Cache API.
- Storage estimate uses a fixed 50MB quota constant.

Why this matters:
- Reported cache usage/health may not match real browser cache usage.

Fix recommendation:
- Derive cache metrics from CacheStorage + `navigator.storage.estimate()` when available.
- Keep manager metadata as optional UI hints, not the canonical source.

---

### 10) `P2` Imported persisted PWA state is weakly validated and can poison runtime state
Evidence:
- `client/src/lib/pwa-manager.ts:745`
- `client/src/lib/pwa-manager.ts:751`
- `client/src/lib/pwa-manager.ts:756`
- `client/src/lib/pwa-manager.ts:760`
- `client/src/lib/pwa-manager.ts:843`
- `client/src/lib/pwa-manager.ts:847`
- `client/src/lib/pwa-manager.ts:851`
- `client/src/lib/pwa-manager.ts:855`

What is happening:
- `importState`/`load` cast arrays and objects directly with minimal shape checks.
- No schema-level validation of nested fields.

Why this matters:
- Corrupt or maliciously edited persisted payloads can create inconsistent runtime behavior.

Fix recommendation:
- Add strict Zod schema for persisted PWA state and reject/repair invalid slices.

---

### 11) `P3` IndexedDB lifecycle debt: synced-change accumulation and open recovery edge
Evidence:
- `client/src/lib/offline-sync.ts:199`
- `client/src/lib/indexed-db-manager.ts:283`
- `client/src/lib/indexed-db-manager.ts:101`
- `client/src/lib/indexed-db-manager.ts:102`
- `client/src/lib/indexed-db-manager.ts:103`

What is happening:
- Sync path marks changes synced but does not prune them in normal flow.
- `open()` rejects immediately when IndexedDB is unavailable; `openPromise` stays rejected for the instance lifetime in that branch.

Why this matters:
- Long sessions can accumulate stale records.
- Recovery from transient IndexedDB availability issues is brittle.

Fix recommendation:
- Add cleanup policy (`clearSyncedChanges`) as part of successful sync cycle.
- Ensure `openPromise` resets on early rejection paths.

## Test Coverage Assessment (this section)

What exists:
- Strong unit-level coverage for each FE-12 module:
  - `client/src/lib/__tests__/collaboration-client.test.ts`
  - `client/src/lib/__tests__/offline-sync.test.ts`
  - `client/src/lib/__tests__/indexed-db-manager.test.ts`
  - `client/src/lib/__tests__/pwa-manager.test.ts`

Important gaps:
- No integration tests proving FE-12 is wired into actual app views/workspace flows.
- No contract tests validating offline sync against real backend route shapes/auth middleware.
- No end-to-end tests for live collaboration connection to the real server boot path.
- No runtime tests for service-worker message channels/background sync wiring with app listeners.
- Offline sync tests currently assert route/method shapes that do not match current backend contracts:
  - `client/src/lib/__tests__/offline-sync.test.ts:247`
  - `client/src/lib/__tests__/offline-sync.test.ts:264`
  - `client/src/lib/__tests__/offline-sync.test.ts:280`

Execution note:
- Per user direction, this pass is inspection-only and did not run vitest.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) Ship a unified Offline Runtime Adapter
- One adapter owns queueing, persistence, auth-aware sync, conflict resolution, and status telemetry.

### B) Add a Collaboration Session Provider
- Centralize authenticated user identity, room join, reconnect, role hydration, and lock/cursor events for consumers.

### C) Add an Offline/Collab status strip in the workspace shell
- Always-visible indicators: online/offline/slow, queued count, last sync, conflict count, collaborator presence.

### D) Introduce FE/BE contract tests for offline entity mapping
- Treat endpoint/method/header mapping as explicit tested contract, not inferred conventions.

### E) Add "recovery drills" in CI
- Simulate network drop, reconnect, stale ETag, auth expiration, and server restart; assert no data loss.

## Decision Questions Before FE-13
1. Should FE-12 standardize on IndexedDB as the only offline queue/state source and deprecate localStorage queueing entirely?
2. Do we want collaboration behind a feature flag until server attach + identity/role wiring are complete?
3. For offline sync, do we enforce strict per-entity route contracts in code (typed map) or add a backend generic sync endpoint?

## Suggested Fix Order (practical)
1. `P1`: Wire collaboration server attach in runtime and add minimal connection smoke test.
2. `P1`: Replace offline sync URL/method/header mapping with contract-correct, auth-aware requests.
3. `P1`: Remove simulated `triggerSync` success path or hard-gate it behind non-production mode.
4. `P1`: Add runtime online/offline event wiring that drives sync recovery.
5. `P2`: Collapse to one offline state source and align hooks/UI to it.
6. `P2`: Fix collaboration identity/role hydration path in hook/provider.
7. `P2`: Tighten persisted-state validation and cache telemetry correctness.
8. `P3`: Add synced-change pruning and IndexedDB open-path recovery cleanup.

## Bottom Line
FE-12 has substantial implementation depth in isolated modules and tests, but end-to-end behavior is currently blocked by integration gaps and contract mismatches. The fastest path to a trustworthy collaboration/offline experience is: attach collaboration runtime, enforce real sync contracts (route/method/auth), remove simulated success states, and unify offline state ownership.

# FE-08 Audit: Data Fetch + Cache

Date: 2026-03-06  
Auditor: Codex  
Section: FE-08 (from master map)  
Method: Code + test-surface inspection only (no vitest runtime per user direction).

## Scope Reviewed
- Core fetch/cache contract:
  - `client/src/lib/queryClient.ts`
  - `client/src/App.tsx`
  - `client/src/components/ErrorBoundary.tsx`
  - `client/src/lib/auth-context.tsx`
- Context-level query/mutation usage:
  - `client/src/lib/contexts/architecture-context.tsx`
  - `client/src/lib/contexts/bom-context.tsx`
  - `client/src/lib/contexts/chat-context.tsx`
  - `client/src/lib/contexts/history-context.tsx`
  - `client/src/lib/contexts/project-meta-context.tsx`
  - `client/src/lib/contexts/validation-context.tsx`
- Hook-level query/mutation usage:
  - `client/src/lib/component-editor/hooks.ts`
  - `client/src/lib/circuit-editor/hooks.ts`
  - `client/src/lib/simulation/useSpiceModels.ts`
  - `client/src/hooks/useChatSettings.ts`
  - `client/src/hooks/useApiKeyStatus.ts`
- View/panel query consumers:
  - `client/src/pages/ProjectPickerPage.tsx`
  - `client/src/components/views/StorageManagerPanel.tsx`
  - `client/src/components/views/BomDiffPanel.tsx`
  - `client/src/components/views/DesignHistoryView.tsx`
  - `client/src/components/views/LifecycleDashboard.tsx`
  - `client/src/components/views/ComponentEditorView.tsx`
  - `client/src/components/simulation/SpiceImportButton.tsx`
  - `client/src/components/panels/CommentsPanel.tsx`
  - `client/src/components/panels/ChatPanel.tsx`
  - `client/src/lib/project-context.tsx`
- Backend contracts checked to validate FE behavior:
  - `server/index.ts`
  - `server/routes/settings.ts`
  - `server/routes/comments.ts`
  - `server/routes/spice-models.ts`
  - `server/routes/projects.ts`
  - `server/circuit-routes/wires.ts`
  - `server/routes/seed.ts`
- Test surface reviewed:
  - `client/src/pages/__tests__/ProjectPickerPage.test.tsx`
  - `client/src/components/panels/__tests__/ChatPanel.test.tsx`
  - `client/src/components/views/__tests__/storage-manager.test.tsx`
  - `client/src/lib/contexts/__tests__/architecture-context.test.tsx`
  - `client/src/lib/contexts/__tests__/bom-context.test.tsx`
  - `client/src/lib/contexts/__tests__/chat-context.test.tsx`
  - `client/src/lib/contexts/__tests__/history-context.test.tsx`

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact break risk
- `P2`: medium reliability/UX/performance risk
- `P3`: low risk, cleanup/quality

## Findings

### 1) `P0` Auth/session cache boundary is still unsafe for account switching
Evidence:
- `client/src/App.tsx:103`
- `client/src/App.tsx:108`
- `client/src/lib/auth-context.tsx:87`
- `client/src/lib/auth-context.tsx:98`
- `client/src/lib/queryClient.ts:110`

What is happening:
- Query cache lifecycle is app-wide.
- Logout clears local session/user, but does not clear React Query cache.
- Data can stay fresh for 5 minutes and be shown again before refetch.

Why this matters:
- Same browser session, user A logs out, user B logs in: prior user data can still render.

Fix recommendation:
- Clear/reset query cache on logout and login/register identity change.
- Add session/user-aware cache scoping.

Note:
- This is a carry-over critical issue from FE-07 and directly affects FE-08 cache safety.

---

### 2) `P1` Invalidation misses when query params are embedded in key strings
Evidence:
- `client/src/components/panels/CommentsPanel.tsx:234`
- `client/src/components/panels/CommentsPanel.tsx:248`
- `client/src/lib/simulation/useSpiceModels.ts:44`
- `client/src/lib/simulation/useSpiceModels.ts:71`
- `client/src/lib/simulation/useSpiceModels.ts:88`
- `client/src/components/simulation/SpiceImportButton.tsx:58`

What is happening:
- Active keys include params in the first string element (example: `'/api/projects/1/comments?resolved=true'`).
- Invalidations use base strings (example: `'/api/projects/1/comments'`, `'/api/spice-models'`).
- TanStack partial key matching does not treat string prefixes as key prefixes.

Local reproduction proof (query-core):
- Invalidating `['/api/projects/1/comments']` did **not** invalidate `['/api/projects/1/comments?resolved=true']`.
- Invalidating `['/api/spice-models']` did **not** invalidate `['/api/spice-models?category=diode']`.

Why this matters:
- Comment lists and spice-model filtered lists can stay stale after create/update/import actions.

Fix recommendation:
- Stop embedding query params into one string key.
- Use structured keys like:
  - `['comments', projectId, { resolved, targetType, targetId }]`
  - `['spice-models', { category, search, limit, offset }]`
- Invalidate using stable prefixes (`['comments', projectId]`, `['spice-models']`).

---

### 3) `P1` Same BOM resource uses incompatible query keys across features
Evidence:
- `client/src/lib/contexts/bom-context.tsx:46`
- `client/src/lib/contexts/bom-context.tsx:59`
- `client/src/components/views/StorageManagerPanel.tsx:855`

What is happening:
- BOM context key: `['/api/projects/${projectId}/bom']`
- Storage Manager key: `['/api/projects', projectId, 'bom']`
- Same server resource, different key families.

Why this matters:
- BOM updates in procurement/context do not invalidate Storage Manager cache.
- Storage Manager can show stale inventory until manual refetch/remount.

Fix recommendation:
- Create one shared BOM key factory and use it everywhere.
- Example: `queryKeys.bom.list(projectId)` returns one canonical key.

---

### 4) `P1` `useChatSettings` fetch path skips session header and can overwrite user settings with defaults
Evidence:
- `client/src/hooks/useChatSettings.ts:82`
- `client/src/hooks/useChatSettings.ts:95`
- `client/src/hooks/useChatSettings.ts:97`
- `server/index.ts:189`
- `server/index.ts:196`
- `server/index.ts:212`
- `server/routes/settings.ts:126`
- `server/routes/settings.ts:130`
- `server/routes/settings.ts:132`

What is happening:
- `useChatSettings` uses raw `fetch('/api/settings/chat')` without `X-Session-Id`.
- That endpoint is public and returns defaults when `req.userId` is missing.
- Returned defaults are written back into local state/localStorage.

Why this matters:
- Logged-in users can receive default settings instead of their saved server settings.
- On mount, local custom settings can get overwritten by defaults.

Fix recommendation:
- Use `apiRequest`/`getQueryFn` (session header included) for settings fetch.
- Or make auth behavior explicit: if logged in, require auth and return 401 on missing header.
- Add guard so default server response does not blindly overwrite valid local saved state.

---

### 5) `P2` Chat tool-call path invalidates the entire cache with no scope
Evidence:
- `client/src/components/panels/ChatPanel.tsx:659`
- `client/src/lib/queryClient.ts:130`

What is happening:
- Any server tool call triggers `queryClient.invalidateQueries()` with no key filter.
- This can fan out into a large app-wide refetch burst.

Why this matters:
- UI jank and unnecessary network traffic.
- Combined with global query error toasts, failures can spam user-facing errors.

Fix recommendation:
- Invalidate only related keys based on returned action/tool metadata.
- Keep a central “tool/action -> query keys” mapping.

---

### 6) `P2` Query cancellation support is mostly missing even though API layer supports it
Evidence:
- `client/src/lib/queryClient.ts:23`
- `client/src/lib/queryClient.ts:35`
- `client/src/lib/queryClient.ts:59`
- `client/src/lib/queryClient.ts:63`
- `client/src/components/panels/CommentsPanel.tsx:233`
- `client/src/lib/component-editor/hooks.ts:8`

What is happening:
- `apiRequest` accepts `AbortSignal`, but most query fns do not pass it.
- Default `getQueryFn` also ignores `signal` from query context.

Why this matters:
- Route/view changes cannot reliably abort in-flight requests.
- More stale race windows and wasted network.

Fix recommendation:
- Update `getQueryFn` to use query context `signal`.
- For custom queryFns, pass `signal` into `apiRequest`.

---

### 7) `P2` Global staleness policy is too static for high-churn app state
Evidence:
- `client/src/lib/queryClient.ts:109`
- `client/src/lib/queryClient.ts:110`
- `client/src/lib/queryClient.ts:111`
- `client/src/components/panels/CommentsPanel.tsx:236`

What is happening:
- Global defaults: no window-focus refetch, 5-minute stale window, one retry.
- Only some high-churn domains override this (example: comments `staleTime: 30_000`).

Why this matters:
- Data can stay stale across tabs/sessions and after background updates.
- Especially risky in collaboration, AI-driven changes, and branch-heavy flows.

Fix recommendation:
- Use per-domain stale policies and focus/refetch behavior.
- Set shorter stale windows for actively edited resources.

---

### 8) `P2` Concurrency contract exists on server but is not used by frontend project mutations
Evidence:
- `server/routes/projects.ts:9`
- `server/routes/projects.ts:77`
- `server/routes/projects.ts:87`
- `client/src/lib/contexts/project-meta-context.tsx:50`

What is happening:
- Server supports `If-Match` optimistic concurrency and returns `409` on conflict.
- Frontend PATCH for project meta sends no `If-Match`.

Why this matters:
- Last-write-wins behavior across tabs/users can silently overwrite edits.

Fix recommendation:
- Store ETag/version from GET `/api/projects/:id`.
- Send `If-Match` on PATCH and handle `409` with conflict UX.

---

### 9) `P3` Seed bootstrap fetch is out-of-band and always attempts a dev-only endpoint
Evidence:
- `client/src/lib/project-context.tsx:153`
- `client/src/lib/project-context.tsx:156`
- `server/routes/seed.ts:268`
- `server/routes/seed.ts:271`

What is happening:
- `ProjectProvider` always calls `POST /api/seed` on mount.
- In production that route returns 404 by design.

Why this matters:
- Extra failed network call each mount.
- Hidden side effect not tracked by React Query cache/observability path.

Fix recommendation:
- Gate this call to dev mode only, or remove from runtime flow and move to explicit seed action.

## Test Coverage Assessment (this section)

What exists:
- Context behavior tests for architecture/BOM/chat/history.
- UI tests for project picker, storage manager, and chat panel.

Key FE-08 gaps:
- No direct tests for:
  - query key + invalidation compatibility when params are present
  - comments invalidation with active filtered query keys
  - spice-model filtered key invalidation after import/seed/create
  - BOM cross-view key consistency (context vs Storage Manager)
  - `useChatSettings` auth-header fetch correctness
  - global `invalidateQueries()` blast radius from chat tool calls
  - query cancellation/abort behavior
  - project `If-Match` conflict handling
  - `queryClient.ts` contract behavior itself

Execution notes:
- Per user direction, this pass is inspection-only and does not run vitest.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) Add a shared query-key factory
- One source of truth for key shapes across contexts/hooks/views.

### B) Define an invalidation policy layer
- Central map of mutation/action -> exact keys to invalidate.

### C) Add fetch-contract lint rules/pattern
- Ban ad-hoc key strings with embedded query params for mutable resources.

### D) Add auth-aware cache lifecycle manager
- Reset cache on identity change and support user-scoped cache namespaces.

### E) Add cache contract tests (query-core level)
- Small, fast tests for key matching, invalidation, and cancel behavior.

## Suggested Fix Order (practical)
1. Fix auth/session cache boundary (`P0`).
2. Fix parameterized key invalidation misses for comments + spice (`P1`).
3. Unify BOM key shape across context and Storage Manager (`P1`).
4. Fix `useChatSettings` auth fetch contract (`P1`).
5. Replace global chat invalidation with targeted invalidation (`P2`).
6. Wire `AbortSignal` through query fetches (`P2`).
7. Add project `If-Match` conflict-safe updates (`P2`).
8. Tune staleness/refetch policy per domain (`P2`).
9. Remove/gate runtime `/api/seed` call (`P3`).

## Bottom Line
FE-08 has good building blocks, but cache key consistency is not tight enough yet. Right now, some important invalidations miss active keys, one major settings flow can fetch the wrong auth context, and global cache invalidation is broader than needed. Fixing key design and auth-aware fetch behavior first will remove most of the hidden stale-data risk.

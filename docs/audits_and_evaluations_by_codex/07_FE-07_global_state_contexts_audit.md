# FE-07 Audit: Global State + Contexts

Date: 2026-03-06  
Auditor: Codex  
Section: FE-07 (from master map)  
Method: Code + test-surface inspection only (no vitest runtime per user direction).

## Scope Reviewed
- Provider composition and compatibility shim:
  - `client/src/lib/project-context.tsx`
- Domain/global contexts in FE-07 scope:
  - `client/src/lib/contexts/project-id-context.tsx`
  - `client/src/lib/contexts/project-meta-context.tsx`
  - `client/src/lib/contexts/architecture-context.tsx`
  - `client/src/lib/contexts/bom-context.tsx`
  - `client/src/lib/contexts/validation-context.tsx`
  - `client/src/lib/contexts/chat-context.tsx`
  - `client/src/lib/contexts/history-context.tsx`
  - `client/src/lib/contexts/output-context.tsx`
  - `client/src/lib/auth-context.tsx`
  - `client/src/lib/theme-context.tsx`
  - `client/src/lib/tutorial-context.tsx`
- Consumer/provider wiring paths (for FE-07 behavior validation):
  - `client/src/App.tsx`
  - `client/src/pages/ProjectWorkspace.tsx`
  - `client/src/pages/ProjectPickerPage.tsx`
  - `client/src/components/layout/Sidebar.tsx`
  - `client/src/components/layout/sidebar/ProjectSettingsPanel.tsx`
  - `client/src/components/ui/TutorialMenu.tsx`
  - `client/src/components/ui/TutorialOverlay.tsx`
- Contract/transport paths needed to validate FE-07 correctness:
  - `client/src/lib/queryClient.ts`
  - `shared/schema.ts`
  - `server/routes/projects.ts`
  - `server/routes/architecture.ts`
  - `server/storage/chat.ts`
- Test surface reviewed:
  - `client/src/lib/contexts/__tests__/architecture-context.test.tsx`
  - `client/src/lib/contexts/__tests__/bom-context.test.tsx`
  - `client/src/lib/contexts/__tests__/chat-context.test.tsx`
  - `client/src/lib/contexts/__tests__/history-context.test.tsx`
  - `client/src/lib/__tests__/tutorial-system.test.ts`

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact break risk
- `P2`: medium reliability/UX risk
- `P3`: low risk, cleanup/quality

## Findings

### 1) `P0` React Query cache is not cleared on auth identity change (cross-account data exposure risk)
Evidence:
- `client/src/App.tsx:103`
- `client/src/App.tsx:108`
- `client/src/lib/auth-context.tsx:87`
- `client/src/lib/auth-context.tsx:98`
- `client/src/lib/queryClient.ts:110`
- `client/src/pages/ProjectPickerPage.tsx:214`

What is happening:
- `QueryClientProvider` is outside `AuthProvider`, so cache lifetime is app-wide.
- `logout()` clears local auth state/session storage, but does not clear query cache.
- Query keys are endpoint-path based and not user-scoped.
- With 5-minute `staleTime`, cached data can be served without immediate refetch.

Why this matters:
- Logging out and logging in as a different user in the same browser session can leak previous user data in UI state before network correction (or without correction while cache is fresh).

Fix recommendation:
- Clear or reset query cache on logout and on successful login/register identity change.
- Scope sensitive query keys by user identity (or use session-bound query client instances).
- Add regression test: user A loads data, logs out, user B logs in, old data must never render.

---

### 2) `P1` BOM price types are inconsistent across context/API/schema contracts
Evidence:
- `client/src/lib/project-context.tsx:48`
- `client/src/lib/project-context.tsx:49`
- `shared/schema.ts:91`
- `shared/schema.ts:92`
- `client/src/lib/contexts/bom-context.tsx:48`
- `client/src/lib/contexts/bom-context.tsx:51`
- `client/src/components/views/DashboardView.tsx:113`

What is happening:
- FE context types model `unitPrice`/`totalPrice` as numbers.
- DB/API schema stores these as `numeric` (commonly surfaced as strings in JS clients).
- BOM context maps API data directly with no numeric normalization.
- Some consumers perform direct arithmetic (`sum + item.totalPrice`).

Why this matters:
- Numeric math can become string concatenation or NaN-prone depending on runtime shape.
- Cost metrics can silently drift or break.

Fix recommendation:
- Normalize BOM numeric fields in `select` mapping (`Number(item.unitPrice)`, `Number(item.totalPrice)`).
- Align TS interfaces with transport reality (either normalized numbers everywhere or explicit string→number conversion boundary).
- Add contract tests for BOM numeric coercion.

---

### 3) `P1` Architecture `busWidth` type is mismatched client vs server schema
Evidence:
- `client/src/lib/contexts/architecture-context.tsx:29`
- `client/src/lib/contexts/architecture-context.tsx:37`
- `client/src/lib/contexts/architecture-context.tsx:152`
- `shared/schema.ts:68`
- `server/routes/architecture.ts:154`

What is happening:
- Client context/edge data models `busWidth` as `number`.
- Shared schema defines `bus_width` as `text`.
- PUT `/edges` validates payload using schema-derived zod.

Why this matters:
- Numeric `busWidth` payloads can fail schema validation, causing edge-save failures and inconsistent user state.

Fix recommendation:
- Make `busWidth` one canonical type end-to-end.
- Preferred: store as integer in schema, keep number in client.
- If text must remain, convert explicitly at boundary and type it as string in API contract.

---

### 4) `P1` Project metadata save UX can report success before persistence actually succeeds
Evidence:
- `client/src/lib/contexts/project-meta-context.tsx:57`
- `client/src/lib/contexts/project-meta-context.tsx:64`
- `client/src/components/layout/sidebar/ProjectSettingsPanel.tsx:50`
- `client/src/components/layout/sidebar/ProjectSettingsPanel.tsx:57`
- `client/src/components/layout/Sidebar.tsx:196`
- `client/src/components/layout/Sidebar.tsx:204`

What is happening:
- Context setters call async mutation via `mutate()` fire-and-forget.
- UI save flow marks “Saved successfully” immediately after setter calls.
- No promise-based success path, no rollback path.

Why this matters:
- Users can see positive save feedback when request fails or conflicts server-side.
- Trust erosion and potential lost edits.

Fix recommendation:
- Expose async `saveProjectMeta` via `mutateAsync()` with result/error state.
- Only show success UI on confirmed response.
- Add optimistic update rollback on failure.

---

### 5) `P1` `runValidation()` in context is synthetic and not design-driven
Evidence:
- `client/src/lib/contexts/validation-context.tsx:8`
- `client/src/lib/contexts/validation-context.tsx:29`
- `client/src/lib/contexts/validation-context.tsx:66`
- `client/src/lib/contexts/validation-context.tsx:69`

What is happening:
- `runValidation()` cycles through a static array of canned issues and inserts one issue per call.
- It does not evaluate current design state.

Why this matters:
- API name implies real validation, but behavior is placeholder logic.
- High risk of false confidence in design integrity.

Fix recommendation:
- Route `runValidation()` to real DRC/ERC engine output.
- If placeholder remains temporarily, rename to explicitly non-production behavior and gate it behind dev/demo mode.

---

### 6) `P2` Contexts collapse fetch failures into “empty state” with no exposed error contract
Evidence:
- `client/src/lib/contexts/architecture-context.tsx:316`
- `client/src/lib/contexts/chat-context.tsx:90`
- `client/src/lib/contexts/history-context.tsx:43`
- `client/src/lib/contexts/bom-context.tsx:94`
- `client/src/lib/contexts/validation-context.tsx:80`
- `client/src/lib/contexts/project-meta-context.tsx:13`
- `client/src/lib/queryClient.ts:130`

What is happening:
- Most contexts default to `[]`/defaults when query data is missing.
- Context interfaces generally do not expose `isError`/`error`.
- Global toast fires, but state surfaces still look like valid empty data.

Why this matters:
- Consumers cannot reliably distinguish “no data” vs “failed to load data.”
- This can trigger incorrect follow-up actions.

Fix recommendation:
- Add per-context load/error contract (`isLoading`, `isError`, `error`, `isFetching`).
- Keep empty-state rendering separate from error-state rendering.

---

### 7) `P2` Project-switch state bleed risk due non-keyed provider and per-context local state
Evidence:
- `client/src/pages/ProjectWorkspace.tsx:825`
- `client/src/lib/contexts/chat-context.tsx:32`
- `client/src/lib/contexts/architecture-context.tsx:211`
- `client/src/lib/contexts/architecture-context.tsx:222`
- `client/src/lib/contexts/output-context.tsx:17`
- `client/src/lib/contexts/output-context.tsx:24`

What is happening:
- Workspace mounts `ProjectProvider` without a `key` tied to `projectId`.
- Multiple contexts keep local UI state that is not reset on `projectId` change.

Why this matters:
- If route param changes without full remount, branch/selection/undo/output state can carry between projects.
- Even when data queries refetch, local context state can be project-incorrect.

Fix recommendation:
- Key the provider tree by `projectId` or add explicit reset effects in each context on `projectId` change.
- Add test covering `/projects/1 -> /projects/2` transition behavior.

Inference note:
- This risk is inferred from provider/reset design and absence of `projectId`-scoped reset logic.

---

### 8) `P2` Chat branch creation contract is incomplete (branch metadata is not persisted)
Evidence:
- `server/storage/chat.ts:47`
- `server/storage/chat.ts:55`
- `server/storage/chat.ts:58`
- `server/storage/chat.ts:65`
- `client/src/lib/contexts/chat-context.tsx:84`
- `client/src/lib/contexts/chat-context.tsx:86`

What is happening:
- `createChatBranch()` returns a UUID but does not persist a branch entity.
- Branch listing is derived from chat messages that already have non-null `branchId`.
- Context immediately switches to returned branch id.

Why this matters:
- New branch can appear “empty/non-existent” until at least one message is posted into it.
- Branch UX can feel flaky/inconsistent.

Fix recommendation:
- Persist branch records in a dedicated table, or create a branch marker message at branch creation.
- Ensure branch list reflects new branches immediately after creation.

---

### 9) `P2` Tutorial state is split across two systems; tests currently focus on the non-production path
Evidence:
- `client/src/lib/tutorial-context.tsx:5`
- `client/src/lib/tutorial-system.ts:91`
- `client/src/lib/tutorial-system.ts:1288`
- `client/src/pages/ProjectWorkspace.tsx:46`
- `client/src/pages/ProjectWorkspace.tsx:826`
- `client/src/components/ui/TutorialMenu.tsx:7`
- `client/src/lib/__tests__/tutorial-system.test.ts:2`

What is happening:
- Production workspace uses `TutorialProvider` + `useTutorial`.
- A separate singleton `TutorialSystem/useTutorialSystem` still exists with heavy test coverage.

Why this matters:
- Test confidence is concentrated on a path not wired into the live workspace tutorial UX.
- Higher chance of production tutorial regressions despite many tests passing.

Fix recommendation:
- Consolidate on one tutorial state architecture.
- Port/add tests for `tutorial-context` + `TutorialOverlay` + `TutorialMenu` integration.

---

### 10) `P3` Architecture focus highlight timer can race across rapid focus changes
Evidence:
- `client/src/lib/contexts/architecture-context.tsx:214`
- `client/src/lib/contexts/architecture-context.tsx:218`

What is happening:
- `focusNode()` sets timeout to clear highlight after 500ms.
- Existing timer is not canceled before setting a new one.

Why this matters:
- Rapid focus changes can clear newer highlight unexpectedly.

Fix recommendation:
- Track timeout id in a ref, clear before setting a new timeout, and cleanup on unmount.

## Test Coverage Assessment (this section)

What exists:
- `client/src/lib/contexts/__tests__/architecture-context.test.tsx`
- `client/src/lib/contexts/__tests__/bom-context.test.tsx`
- `client/src/lib/contexts/__tests__/chat-context.test.tsx`
- `client/src/lib/contexts/__tests__/history-context.test.tsx`
- `client/src/lib/__tests__/tutorial-system.test.ts`

Key gaps:
- No direct FE-07 tests found for:
  - `auth-context`
  - `theme-context`
  - `tutorial-context`
  - `project-meta-context`
  - `output-context`
  - `validation-context`
  - `project-context` provider composition/bridge behavior
- No tests found for:
  - cache purge on logout/login identity change
  - cross-project state reset (`/projects/:id` transition)
  - BOM numeric normalization contract
  - `busWidth` type boundary behavior
  - project metadata save failure UX (false-success prevention)
  - chat branch creation/listing contract integrity
- Existing context tests are mostly request-shape/mutation-call oriented and rely on mocked/default query functions:
  - `client/src/lib/contexts/__tests__/architecture-context.test.tsx:42`
  - `client/src/lib/contexts/__tests__/bom-context.test.tsx:41`
  - `client/src/lib/contexts/__tests__/chat-context.test.tsx:39`
  - `client/src/lib/contexts/__tests__/history-context.test.tsx:39`

Execution notes:
- Per user direction, this pass is inspection-only and does not run vitest.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) Add a session-aware state boundary
- On identity change, reset/clear app-wide cached and context state deterministically.

### B) Introduce explicit context contracts for load/error/mutation status
- Every domain context should expose `isLoading`, `isError`, and mutation success/failure signals.

### C) Define FE-07 transport normalization boundaries
- Normalize DB/API numeric and enum-like fields at select/mutation boundaries, not in downstream views.

### D) Unify tutorial state architecture
- Remove or retire non-production tutorial system path once parity is reached.

### E) Add project-transition contract tests
- Validate no stale UI state leaks across project changes and user/session changes.

## Suggested Fix Order (practical)
1. Clear query/cache state on auth identity change (`P0`).
2. Fix BOM numeric contract normalization (`P1`).
3. Align architecture `busWidth` type end-to-end (`P1`).
4. Make project metadata save success depend on real mutation success (`P1`).
5. Replace synthetic `runValidation()` behavior with real validation flow (`P1`).
6. Expose context-level error/loading contracts (`P2`).
7. Add projectId-scoped reset strategy for context local state (`P2`).
8. Repair chat branch persistence/listing contract (`P2`).
9. Consolidate tutorial state systems and align tests with production path (`P2`).
10. Stabilize architecture focus timer behavior (`P3`).

## Bottom Line
FE-07 has a solid modular direction, but it still has contract drift between state layers (auth/cache, API/schema types, and mutation/result signaling). The highest-risk issue is session-boundary safety: without cache reset on identity change, state correctness and data isolation are not reliable. Fixing that first, then hardening type boundaries and mutation truthfulness, will make the rest of the frontend much safer to build on.

# FE-01 Audit: App Shell + Routing

Date: 2026-03-05  
Auditor: Codex  
Section: FE-01 (from master map)  
Status: Completed first full line-by-line pass for this section.

## Scope Reviewed (line-by-line)
- `client/src/main.tsx`
- `client/src/App.tsx`
- `client/src/pages/AuthPage.tsx`
- `client/src/pages/ProjectPickerPage.tsx`
- `client/src/pages/EmbedViewerPage.tsx`
- `client/src/pages/not-found.tsx`
- `client/src/pages/ProjectWorkspace.tsx` (routing boundary and `projectId` handling)
- `client/src/lib/auth-context.tsx` (AuthGate dependency)
- `client/src/lib/queryClient.ts` (route-layer API dependency)
- `client/src/pages/__tests__/EmbedViewerPage.test.tsx`
- `client/src/pages/__tests__/ProjectPickerPage.test.tsx`

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact break risk
- `P2`: medium reliability/UX risk
- `P3`: low risk, cleanup/quality

## Findings

### 1) `P1` Session gets cleared on temporary network failure
Evidence:
- `client/src/lib/auth-context.tsx:54`
- `client/src/lib/auth-context.tsx:55`
- `client/src/lib/auth-context.tsx:56`
- `client/src/lib/auth-context.tsx:57`
- `client/src/lib/auth-context.tsx:58`

What is happening:
- On app load, session validation calls `/api/auth/me`.
- If request fails for any reason (offline, DNS, timeout), code clears local session immediately.

Why this matters:
- User can be logged out just because network blipped.
- Feels like “random logout” and is hard to trust.

Fix recommendation:
- Only clear session on explicit unauthorized response (`401/403`).
- On network failure, keep session ID, mark auth state as “unknown/offline”, and retry later.

---

### 2) `P2` Invalid project route hard-redirects to `/projects/1`
Evidence:
- `client/src/pages/ProjectWorkspace.tsx:820`
- `client/src/pages/ProjectWorkspace.tsx:821`

What is happening:
- Any invalid project ID redirects to `/projects/1`.

Why this matters:
- Assumes project `1` exists and is accessible.
- In multi-user or cleaned DB states, this can send users to a broken or unauthorized path.

Fix recommendation:
- Redirect to `/` (project picker) instead of `/projects/1`.
- Optional: show a clear “invalid project id” message.

---

### 3) `P2` Embed “Open in ProtoPulse” link is hardcoded to `/projects/1`
Evidence:
- `client/src/pages/EmbedViewerPage.tsx:163`
- `client/src/pages/EmbedViewerPage.tsx:164`
- `client/src/pages/EmbedViewerPage.tsx:165`
- `client/src/pages/EmbedViewerPage.tsx:166`

What is happening:
- Embed page always links to `/projects/1` regardless of source schematic.

Why this matters:
- Button often opens unrelated project.
- Can fail for users without access to project `1`.

Fix recommendation:
- Link to project picker (`/`) for safe behavior.
- Better: include optional source project ID in embed payload and route there if available.

---

### 4) `P2` `localStorage` read in auth init is not guarded
Evidence:
- `client/src/lib/auth-context.tsx:25`

What is happening:
- Initial state reads `localStorage` without `try/catch`.

Why this matters:
- In locked-down browser modes, this can throw at boot and break auth provider mount.

Fix recommendation:
- Wrap initial read in safe helper with `try/catch`, same pattern already used elsewhere.

---

### 5) `P2` Route-layer tests are missing for `App` auth + embed branching
Evidence:
- `client/src/App.tsx` routing/auth logic has no direct tests.
- Search found no `App` route/auth gate tests.

What is happening:
- Existing tests are strong for `ProjectPickerPage` and `EmbedViewerPage`, but not for top-level branch logic.

Why this matters:
- Regressions in `AuthGate` or `/embed/*` routing can slip in undetected.

Fix recommendation:
- Add focused tests for:
  - unauthenticated user sees `AuthPage` for normal routes
  - authenticated user sees router content
  - `/embed/*` bypasses `AuthProvider/AuthGate` path
  - unknown route hits `NotFound`

---

### 6) `P3` Not-found CTA text does not match destination
Evidence:
- `client/src/pages/not-found.tsx:24`
- `client/src/pages/not-found.tsx:21`

What is happening:
- Button says “Return to Dashboard” but links to `/` (project picker).

Why this matters:
- Minor UX confusion.

Fix recommendation:
- Change label to “Return to Projects” (or route to real dashboard if intended).

---

### 7) `P3` `ProjectPickerPage` may hide projects beyond first 100
Evidence:
- `client/src/pages/ProjectPickerPage.tsx:214`

What is happening:
- Query is fixed to `limit=100`.

Why this matters:
- Large users/orgs can miss older projects in picker.

Fix recommendation:
- Add pagination or infinite scroll.
- At minimum show “Showing first 100 projects” notice.

## Test Coverage Assessment (this section)

Strong coverage:
- `ProjectPickerPage` has broad behavioral tests.
- `EmbedViewerPage` has broad behavior/state tests.

Gaps:
- No direct tests for top-level `App.tsx` route/auth branch behavior.
- No tests for `auth-context` network-failure session handling.
- No tests for invalid `projectId` redirect behavior in `ProjectWorkspace`.

Execution notes:
- Attempted to run targeted tests in this environment.
- Commands hung/timed out due Vitest worker startup/runtime issues here.
- Evidence used for this report is code-level + existing test file inspection.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) Add route contract tests (high value, low-medium effort)
- Add `client/src/App` route matrix tests:
  - `/` authenticated + unauthenticated
  - `/projects/:id` invalid id cases
  - `/embed/:data` and `/embed/s/:code`
  - fallback route behavior

### B) Add auth state machine (`unknown`, `authenticated`, `unauthenticated`, `offline`)
- Replaces boolean-only auth loading logic.
- Prevents forced logout on transient network errors.

### C) Add safe route constants module
- Centralize route strings (`/`, `/projects/:projectId`, `/embed/...`).
- Reduces drift and hardcoded paths.

### D) Add user-facing fallback page for bad project IDs
- Instead of hard redirect, show clear action buttons:
  - “Go to project list”
  - “Create project”

### E) Improve embed-to-editor UX
- Option 1: always go to `/` and show “Import this embed into a project?”
- Option 2: carry source metadata when available for smarter open behavior.

## Suggested Fix Order (practical)
1. Fix network-failure session clearing in `auth-context` (`P1`).
2. Replace hardcoded `/projects/1` redirects/links (`P2`).
3. Add route/auth branch tests for `App` + `ProjectWorkspace` (`P2`).
4. Cleanup UX consistency items (`P3`).

## Bottom Line
This section is mostly solid, but it has two important hardcoded-path risks and one high-impact auth reliability issue that should be fixed early.

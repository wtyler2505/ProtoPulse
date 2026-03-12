# FE-14 Audit: Frontend Security + Test Quality

Date: 2026-03-06  
Auditor: Codex  
Section: FE-14 (from master map)  
Method: Code + test-surface inspection only (no vitest runtime per user direction).

## Scope Reviewed
- Frontend security-sensitive surfaces:
  - `client/src/components/panels/ChatPanel.tsx`
  - `client/src/lib/auth-context.tsx`
  - `client/src/lib/queryClient.ts`
  - `client/src/components/panels/chat/MessageBubble.tsx`
  - `client/src/components/ui/DatasheetLink.tsx`
  - `client/src/components/circuit-editor/PinoutHoverCard.tsx`
  - `client/src/components/panels/asset-manager/AssetGrid.tsx`
  - `client/src/components/views/component-editor/DatasheetExtractModal.tsx`
  - `client/src/components/views/ComponentEditorView.tsx`
  - `client/src/lib/drc-scripting.ts`
  - `client/src/components/views/ValidationView.tsx`
- Frontend/e2e test surface:
  - `client/src/components/panels/__tests__/ChatPanel.test.tsx`
  - `client/src/components/ui/__tests__/datasheet-link.test.tsx`
  - `client/src/components/circuit-editor/__tests__/PinoutHoverCard.test.tsx`
  - `client/src/lib/__tests__/drc-scripting.test.ts`
  - `e2e/auth.setup.ts`
  - `e2e/navigation.spec.ts`
  - `e2e/project-workspace.spec.ts`
  - `playwright.config.ts`
  - `vitest.config.ts`
- Security-related audit docs alignment:
  - `docs/frontend-audit-checklist.md`
  - `docs/product-analysis-checklist.md`

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact behavior break
- `P2`: medium reliability/interop risk
- `P3`: lower-risk quality/debt issue

## Findings

### 1) `P1` AI API key is stored in plaintext `localStorage`
Evidence:
- `client/src/components/panels/ChatPanel.tsx:38`
- `client/src/components/panels/ChatPanel.tsx:242`
- `client/src/components/panels/ChatPanel.tsx:245`
- `client/src/components/panels/ChatPanel.tsx:325`
- `client/src/components/panels/ChatPanel.tsx:329`

What is happening:
- ChatPanel reads and writes `protopulse-ai-api-key` directly in browser local storage.

Why this matters:
- Any XSS on same origin can read/exfiltrate the key.
- This is a high-value secret and should not sit in plaintext browser storage.

Fix recommendation:
- Move to server-side encrypted key storage only (already supported in backend routes).
- Keep only short-lived in-memory value in UI, with explicit “forget key” behavior.

---

### 2) `P1` Session token is stored in `localStorage` and reused for auth header
Evidence:
- `client/src/lib/auth-context.tsx:21`
- `client/src/lib/auth-context.tsx:25`
- `client/src/lib/auth-context.tsx:74`
- `client/src/lib/auth-context.tsx:82`
- `client/src/lib/queryClient.ts:5`
- `client/src/lib/queryClient.ts:8`
- `client/src/lib/queryClient.ts:9`

What is happening:
- Session id is persisted in `localStorage` and sent as `X-Session-Id` for API calls.

Why this matters:
- Same-origin script injection can steal session and impersonate users.

Fix recommendation:
- Prefer secure, httpOnly, sameSite cookies for session transport.
- If header mode remains, rotate tokens aggressively and add CSP + strict URL/protocol validation defense-in-depth.

---

### 3) `P1` Several external-link surfaces accept unvalidated URLs
Evidence:
- `client/src/components/ui/DatasheetLink.tsx:18`
- `client/src/components/ui/DatasheetLink.tsx:22`
- `client/src/components/circuit-editor/PinoutHoverCard.tsx:627`
- `client/src/components/circuit-editor/PinoutHoverCard.tsx:630`
- `client/src/components/panels/asset-manager/AssetGrid.tsx:201`
- `client/src/components/panels/asset-manager/AssetGrid.tsx:232`
- `client/src/components/views/component-editor/DatasheetExtractModal.tsx:138`
- `client/src/components/views/component-editor/DatasheetExtractModal.tsx:191`
- `client/src/components/views/ComponentEditorView.tsx:391`

What is happening:
- Multiple UI paths render or open `datasheetUrl` values without protocol allowlist checks.
- AI-extracted metadata can flow into these fields without client-side URL validation.

Why this matters:
- Malicious `javascript:` or unsafe URLs can become clickable execution vectors.

Fix recommendation:
- Create one shared `sanitizeExternalUrl()` helper that allows only `http:` and `https:`.
- Apply it in `DatasheetLink`, `PinoutHoverCard`, and `AssetGrid`.
- Validate datasheet URL at apply-time in `DatasheetExtractModal`/`ComponentEditorView`.

---

### 4) `P1` DRC scripting can lock the UI; timeout guard is not enforced preemptively
Evidence:
- `client/src/lib/drc-scripting.ts:88`
- `client/src/lib/drc-scripting.ts:256`
- `client/src/lib/drc-scripting.ts:259`
- `client/src/lib/drc-scripting.ts:260`
- `client/src/components/views/ValidationView.tsx:199`
- `client/src/components/views/ValidationView.tsx:201`
- `rg -n "timeout|while \\(true\\)|infinite" client/src/lib/__tests__/drc-scripting.test.ts` (no matches)

What is happening:
- User-provided scripts run via `new Function(...)` on the main thread.
- “Timeout” check is only after an exception path; it does not prevent infinite loops.

Why this matters:
- A bad script can freeze the tab and deny service for the user session.

Fix recommendation:
- Run custom scripts in a Web Worker with hard execution cutoff.
- Add explicit test for infinite loop cutoff behavior.

---

### 5) `P1` Security checklist is out of sync with current code
Evidence:
- `docs/frontend-audit-checklist.md:143`
- `client/src/components/panels/ChatPanel.tsx:245`
- `client/src/components/panels/ChatPanel.tsx:329`
- `docs/product-analysis-checklist.md:77`

What is happening:
- Frontend checklist says API keys are not stored in `localStorage`.
- Current code stores the API key in `localStorage`.

Why this matters:
- Team may think a risk is closed when it is still present.
- This can delay real mitigation.

Fix recommendation:
- Update checklist status to reflect current implementation.
- Track migration plan to encrypted server-side key storage as active item.

---

### 6) `P1` Security-critical frontend modules have little or no direct test coverage
Evidence:
- `rg -n "protopulse-session-id|X-Session-Id|AuthProvider|login\\(|register\\(|logout\\(" client/src --glob '**/*.test.ts*' --glob '**/*.spec.ts*'` (no matches)
- `rg -n "useApiKeyStatus|api-keys/validate" client/src --glob '**/*.test.ts*'` (no matches)
- `rg -n "queryClient|apiRequest|getAuthHeaders|sanitizeUrl" client/src/lib/__tests__ client/src/components --glob '**/*.test.ts*'` (only one unrelated mock usage)
- `client/src/components/panels/__tests__/ChatPanel.test.tsx:223` (MessageBubble mocked, not exercised)

What is happening:
- Core auth/session and API-layer security behavior is mostly untested at unit/integration level.

Why this matters:
- Regressions in auth header/session/key handling can slip through test runs.

Fix recommendation:
- Add focused tests for `auth-context`, `queryClient`, `useApiKeyStatus`, and real `MessageBubble` link sanitization behavior.

---

### 7) `P2` ChatPanel tests mock away the risky logic paths
Evidence:
- `client/src/components/panels/__tests__/ChatPanel.test.tsx:126`
- `client/src/components/panels/__tests__/ChatPanel.test.tsx:223`
- `client/src/components/panels/__tests__/ChatPanel.test.tsx:123`

What is happening:
- Test file mocks query client, action executor, intent parsing, and MessageBubble rendering.

Why this matters:
- Security logic tied to message rendering and URL handling is not really exercised in ChatPanel tests.

Fix recommendation:
- Keep lightweight mocks, but add at least one “real-path” integration test that renders the true MessageBubble and validates unsafe-link stripping.

---

### 8) `P1` Playwright auth setup stores session under the wrong localStorage key
Evidence:
- `e2e/auth.setup.ts:33`
- `client/src/lib/auth-context.tsx:21`
- `client/src/lib/queryClient.ts:5`

What is happening:
- E2E setup writes `session_id`, but app auth code reads `protopulse-session-id`.

Why this matters:
- E2E tests can run in a false auth state and still appear green.

Fix recommendation:
- Update E2E setup to use `protopulse-session-id`.
- Add assertion after setup that `/api/auth/me` is authenticated in browser context.

---

### 9) `P2` E2E assertions are too weak in key places
Evidence:
- `e2e/navigation.spec.ts:45`
- `e2e/project-workspace.spec.ts:67`

What is happening:
- Tests end with `expect(true).toBeTruthy()` in places where meaningful behavior should be asserted.

Why this matters:
- These tests can pass even when real behavior is broken.

Fix recommendation:
- Replace placeholder assertions with concrete checks (URL, view markers, auth-only UI visibility, error banner absence).

---

### 10) `P2` Link tests verify UX attributes but not protocol safety
Evidence:
- `client/src/components/ui/__tests__/datasheet-link.test.tsx:23`
- `client/src/components/ui/__tests__/datasheet-link.test.tsx:31`
- `client/src/components/circuit-editor/__tests__/PinoutHoverCard.test.tsx:251`
- `client/src/components/circuit-editor/__tests__/PinoutHoverCard.test.tsx:261`

What is happening:
- Tests check `href`, `target`, and `rel`, but do not test malicious `javascript:`/`data:` protocol rejection.

Why this matters:
- Security guarantees are not encoded in tests, so unsafe URL regressions can slip in.

Fix recommendation:
- Add explicit protocol-rejection test cases for all datasheet-link components.

## What Is Already Good
- Chat markdown rendering has defense-in-depth:
  - `client/src/components/panels/chat/MessageBubble.tsx:49`
  - `client/src/components/panels/chat/MessageBubble.tsx:73`
- Existing `window.open` calls include `noopener,noreferrer` consistently in inspected files.
- SVG label generator escapes XML content:
  - `client/src/lib/qr-labels.ts:185`
  - `client/src/lib/__tests__/qr-labels.test.ts:189`

## Test Coverage Assessment (this section)

What exists:
- Very large unit-test surface in `client/src/lib/__tests__` (57 files from folder-count pass).
- Playwright suite exists (`e2e/*`) with auth setup, navigation, workspace, and accessibility smoke checks.

Important gaps:
- Security-critical frontend modules are mostly untested directly (`auth-context`, `queryClient`, `useApiKeyStatus`, real MessageBubble sanitization path).
- E2E auth setup key mismatch undermines confidence in authenticated-path coverage.
- E2E has placeholder assertions that allow false positives.
- No explicit frontend tests for malicious protocol blocking on datasheet links.

Execution note:
- Per user direction, this pass is inspection-only and did not run vitest/playwright.

## Improvements / Enhancements
- Add a shared `safeExternalUrl` utility and apply everywhere external links are rendered/opened.
- Move API key/session secret handling to safer transport/storage patterns.
- Add a “security test pack” for FE:
  - malicious URL protocol tests
  - markdown sanitization regression tests
  - session/header integrity tests
  - E2E auth-state verification test.
- Add CI gate that runs `npm test` + `npm run test:e2e` on protected branches.

## Decision Questions Before FE-15
1. Do we treat browser-side API key persistence as acceptable product behavior for now, or migrate immediately to encrypted server-side storage only?
2. Do we keep header-based sessions with localStorage, or switch to httpOnly cookie sessions?
3. Should custom DRC scripts move to Web Worker sandbox now (safety), or remain main-thread until broader refactor?

## Suggested Fix Order
1. Fix E2E auth key mismatch (`session_id` -> `protopulse-session-id`) and remove placeholder assertions.
2. Add shared URL protocol sanitizer and apply to datasheet link/open flows.
3. Add direct tests for URL protocol rejection and MessageBubble sanitization.
4. Add tests for `auth-context`, `queryClient`, and `useApiKeyStatus`.
5. Plan and execute key/session secret hardening migration.

## Bottom Line
Frontend has some good protections, but FE-14 shows two major risk clusters: secret handling in browser storage and weak test realism around security paths. Tightening URL/session/key handling plus upgrading test depth will significantly reduce integration risk before backend security hardening passes.

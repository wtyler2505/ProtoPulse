# FE-06 Audit: AI Chat UX + Actions

Date: 2026-03-06  
Auditor: Codex  
Section: FE-06 (from master map)  
Method: Code + test-surface inspection only (no vitest runtime per user direction).

## Scope Reviewed
- Primary panel surface:
  - `client/src/components/panels/ChatPanel.tsx`
  - `client/src/components/panels/chat/*`
- FE-06 scoped hooks:
  - `client/src/hooks/useRAG.ts`
  - `client/src/hooks/usePredictions.ts`
  - `client/src/hooks/useVoiceAI.ts`
- Supporting chat settings/key hooks (used directly by chat UX):
  - `client/src/hooks/useApiKeyStatus.ts`
  - `client/src/hooks/useChatSettings.ts`
- Chat state contracts and backend route/storage contracts (for FE-06 behavior validation):
  - `client/src/lib/contexts/chat-context.tsx`
  - `client/src/lib/project-context.tsx`
  - `client/src/lib/queryClient.ts`
  - `shared/schema.ts`
  - `server/index.ts`
  - `server/routes/chat.ts`
  - `server/routes/chat-branches.ts`
  - `server/routes/settings.ts`
  - `server/storage/chat.ts`
- Test surface reviewed:
  - `client/src/components/panels/__tests__/ChatPanel.test.tsx`
  - `client/src/components/panels/chat/hooks/__tests__/useActionExecutor.test.tsx`
  - `client/src/components/panels/chat/__tests__/VoiceInput.test.tsx`

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact break risk
- `P2`: medium reliability/UX risk
- `P3`: low risk, cleanup/quality

## Findings

### 1) `P1` Core AI chat/design-agent fetches bypass session-header auth path
Evidence:
- `client/src/components/panels/ChatPanel.tsx:554`
- `client/src/components/panels/ChatPanel.tsx:556`
- `client/src/components/panels/chat/DesignAgentPanel.tsx:73`
- `client/src/components/panels/chat/DesignAgentPanel.tsx:75`
- `client/src/lib/queryClient.ts:7`
- `client/src/lib/queryClient.ts:26`
- `server/index.ts:196`
- `server/index.ts:202`
- `server/routes/chat.ts:438`
- `server/routes/chat.ts:52`

What is happening:
- FE-06’s direct `fetch` calls send only `Content-Type`, not `X-Session-Id`.
- Backend auth chain and stream guard expect session header for protected API routes.

Why this matters:
- In normal auth mode, key FE-06 flows (`/api/chat/ai/stream`, design-agent POST) can fail with auth errors.
- This is a high-impact break risk for the main AI experience.

Fix recommendation:
- Route these requests through `apiRequest()` or shared `getAuthHeaders()`.
- Add a FE-06 integration test that asserts `X-Session-Id` is present on stream/agent calls.

---

### 2) `P1` Chat rich-message UX contract is broken by persistence shape mismatch
Evidence:
- `client/src/components/panels/ChatPanel.tsx:669`
- `client/src/components/panels/ChatPanel.tsx:675`
- `client/src/components/panels/ChatPanel.tsx:676`
- `client/src/components/panels/ChatPanel.tsx:688`
- `client/src/components/panels/ChatPanel.tsx:703`
- `client/src/lib/contexts/chat-context.tsx:80`
- `client/src/lib/contexts/chat-context.tsx:41`
- `client/src/lib/contexts/chat-context.tsx:47`
- `shared/schema.ts:135`
- `shared/schema.ts:143`

What is happening:
- `ChatPanel` creates rich assistant messages (`actions`, `toolCalls`, `isError`, etc.).
- Chat persistence/context currently only saves/returns basic message fields (`role`, `content`, `mode`, timestamp).

Why this matters:
- FE-06 UI paths that depend on rich metadata (tool call display, error affordances, action rendering) are not reliably representable through current message contracts.
- The chat UX can silently degrade to plain text only even when richer behaviors are expected.

Fix recommendation:
- Define one canonical FE-06 message envelope and keep it consistent across client context, API routes, and DB schema.
- Either persist rich metadata or split ephemeral UI metadata into a clearly separate local store.

---

### 3) `P1` Offline/local command mode bypasses destructive-action confirmation
Evidence:
- `client/src/components/panels/ChatPanel.tsx:500`
- `client/src/components/panels/ChatPanel.tsx:510`
- `client/src/components/panels/ChatPanel.tsx:662`
- `client/src/components/panels/ChatPanel.tsx:669`
- `client/src/components/panels/chat/intent-handlers/architecture.ts:41`
- `client/src/components/panels/chat/intent-handlers/nodes.ts:83`
- `client/src/components/panels/chat/intent-handlers/bom.ts:48`

What is happening:
- With no API key, local intent actions run immediately.
- Confirmation gating is only applied to server-returned action sets.

Why this matters:
- Destructive local commands (`clear_canvas`, removals) can execute instantly with no safety pause.

Fix recommendation:
- Run local intent actions through the same destructive-action gate used for remote actions.
- Add explicit confirmation UI parity test for no-key mode.

---

### 4) `P1` “Fix all issues” command is misleading: it clears issues, does not fix design
Evidence:
- `client/src/components/panels/chat/intent-handlers/validation.ts:33`
- `client/src/components/panels/chat/intent-handlers/validation.ts:34`
- `client/src/components/panels/chat/hooks/action-handlers/validation.ts:22`
- `client/src/components/panels/chat/hooks/action-handlers/validation.ts:24`

What is happening:
- Local “fix all issues” maps to `clear_validation`.
- Handler deletes issue records instead of applying real circuit/design fixes.

Why this matters:
- Users can get false confidence that issues were fixed when they were only hidden/removed.

Fix recommendation:
- Rename this command behavior to “clear issue list” or implement true fix logic.
- Block “resolved” language unless real design mutations were verified.

---

### 5) `P1` Procurement intelligence actions generate randomized pseudo-data as actionable output
Evidence:
- `client/src/components/panels/chat/hooks/action-handlers/bom.ts:106`
- `client/src/components/panels/chat/hooks/action-handlers/bom.ts:107`
- `client/src/components/panels/chat/hooks/action-handlers/bom.ts:108`
- `client/src/components/panels/chat/hooks/action-handlers/bom.ts:113`
- `client/src/components/panels/chat/hooks/action-handlers/bom.ts:152`

What is happening:
- Pricing, stock, and lead-time outputs are built from `Math.random()` and shown as decision guidance.

Why this matters:
- FE-06 can present synthetic procurement outputs as if they are lookup-backed facts.
- This is a trust and decision-quality risk.

Fix recommendation:
- Label simulated data clearly as estimated/demo.
- Prefer real-source lookup integration or disable these actions in production mode.

---

### 6) `P1` API key trust messaging conflicts with real transport/storage behavior
Evidence:
- `client/src/components/panels/ChatPanel.tsx:245`
- `client/src/components/panels/ChatPanel.tsx:329`
- `client/src/components/panels/chat/SettingsPanel.tsx:199`
- `client/src/components/panels/chat/ApiKeySetupDialog.tsx:100`
- `client/src/components/panels/ChatPanel.tsx:537`
- `server/routes/chat.ts:174`

What is happening:
- FE-06 stores key in browser localStorage (explicitly unencrypted in UI copy).
- Setup copy says key is sent directly to provider / not stored on servers.
- Actual flow posts `apiKey` to backend AI route payload.

Why this matters:
- Trust copy and real behavior are not aligned, which creates user-security expectation gaps.

Fix recommendation:
- Update copy to reflect actual transport path exactly.
- Move to server-side encrypted key storage by default for authenticated users, with explicit local-only opt-in.

---

### 7) `P2` Client allows SVG upload for chat image path, but backend stream contract rejects it
Evidence:
- `client/src/components/panels/chat/MessageInput.tsx:131`
- `client/src/components/panels/ChatPanel.tsx:548`
- `server/routes/chat.ts:187`

What is happening:
- FE-06 upload input accepts `image/svg+xml`.
- Stream API schema only allows `jpeg/png/gif/webp`.

Why this matters:
- User can select an allowed file in UI and still hit avoidable request validation failure.

Fix recommendation:
- Align accepted client MIME list with backend schema.
- Add immediate client-side MIME validation message before send.

---

### 8) `P2` Action execution lacks defensive schema guards; malformed action payloads can hard-fail mid-batch
Evidence:
- `client/src/components/panels/chat/hooks/useActionExecutor.ts:65`
- `client/src/components/panels/chat/hooks/useActionExecutor.ts:71`
- `client/src/components/panels/chat/hooks/action-handlers/architecture.ts:168`
- `client/src/components/panels/chat/hooks/action-handlers/architecture.ts:264`
- `client/src/components/panels/chat/hooks/action-handlers/bom.ts:41`
- `client/src/components/panels/chat/hooks/useActionExecutor.ts:76`

What is happening:
- Action loop has no per-action guard.
- Multiple handlers use non-null assertions on untrusted fields.
- Some side-effects (e.g., BOM writes) happen immediately before final node/edge commit.

Why this matters:
- One malformed action can throw and interrupt batch execution in inconsistent ways.

Fix recommendation:
- Validate each action by type before execution.
- Add per-action try/catch with failure logging and continue policy.
- Separate pure state accumulation from side-effecting writes where possible.

---

### 9) `P2` Chat settings bootstrap fetch does not send session header, so authenticated settings can silently fall back
Evidence:
- `client/src/hooks/useChatSettings.ts:83`
- `client/src/lib/queryClient.ts:7`
- `server/routes/settings.ts:126`
- `server/routes/settings.ts:130`

What is happening:
- `useChatSettings` uses raw `fetch` (no `X-Session-Id` header helper).
- Backend returns defaults when `req.userId` is missing.

Why this matters:
- User-specific server settings may not reliably hydrate into FE-06 on load.

Fix recommendation:
- Use shared authenticated request helper for settings fetch.
- Add an auth-aware settings hydration test.

---

### 10) `P3` FE-06 includes inactive/parallel chat systems with limited production wiring clarity
Evidence:
- `client/src/components/panels/chat/VoiceInput.tsx:55`
- `client/src/components/panels/ChatPanel.tsx:430`
- `client/src/hooks/useRAG.ts:17`
- `client/src/hooks/usePredictions.ts:21`
- `client/src/hooks/useVoiceAI.ts:35`
- `client/src/components/panels/ChatPanel.tsx.bak:1`

What is happening:
- `ChatPanel` uses direct Web Speech path while a separate `VoiceInput` + `useVoiceAI` system also exists.
- FE-06-scoped hooks (`useRAG`, `usePredictions`) appear as implementation surfaces but are not clearly wired into active chat panel flows.
- Backup file (`ChatPanel.tsx.bak`) remains in source tree.

Why this matters:
- Increases maintenance confusion and test confidence drift.

Fix recommendation:
- Decide one voice/chat path as canonical.
- Remove or quarantine inactive FE-06 paths and backup artifacts.
- Add wiring map comments/tests for intentionally dormant modules.

## Test Coverage Assessment (this section)

What exists:
- `client/src/components/panels/__tests__/ChatPanel.test.tsx`
- `client/src/components/panels/chat/hooks/__tests__/useActionExecutor.test.tsx`
- `client/src/components/panels/chat/__tests__/VoiceInput.test.tsx`

Key gaps:
- `ChatPanel` tests heavily mock parser/subcomponents, so real FE-06 integrations are mostly unexercised:
  - `client/src/components/panels/__tests__/ChatPanel.test.tsx:136`
  - `client/src/components/panels/__tests__/ChatPanel.test.tsx:157`
- No direct tests found for:
  - `parseLocalIntent` real handler matrix
  - destructive-action confirmation in no-key mode
  - authenticated stream/agent fetch headers
  - `DesignAgentPanel` SSE failure/unmount behavior
  - `ApiKeySetupDialog` trust-copy vs transport behavior
  - `useRAG`, `usePredictions`, `useVoiceAI` integration into active FE-06 surfaces
- `useActionExecutor` tests cover only a subset of action families despite broad action registry:
  - action catalog: `client/src/components/panels/chat/constants.ts:43`

Execution notes:
- Per user direction, this pass is inspection-only and does not run vitest.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) Formalize a FE-06 “Message Contract v1”
- One typed envelope for persisted + rendered chat events.
- Include metadata policy (`actions`, `toolCalls`, `error`, `attachments`) explicitly.

### B) Create an authenticated fetch helper for streaming endpoints
- Shared helper for SSE and long-running calls that always injects auth/session headers.

### C) Add a “safe action execution” layer
- Per-action validation + guardrail logging + failure isolation.
- Separate read-only analysis actions from mutating actions.

### D) Add trust labels for simulated outputs
- Mark synthetic BOM/pricing/lead-time outputs as estimated until real data source integration exists.

### E) Unify voice stack
- Either migrate ChatPanel to `VoiceInput/useVoiceAI` or remove dormant parallel path.

## Suggested Fix Order (practical)
1. Fix FE-06 auth header path for stream/agent requests (`P1`).
2. Align chat message contract across panel/context/API/schema (`P1`).
3. Apply destructive-action gating to local/no-key command path (`P1`).
4. Correct “fix all issues” semantics (real fix vs clear list) (`P1`).
5. Remove simulated procurement facts or clearly mark them as estimates (`P1`).
6. Align API key trust copy with real transport/storage behavior (`P1`).
7. Align upload MIME list with backend stream contract (`P2`).
8. Add action payload validation + per-action failure isolation (`P2`).
9. Fix authenticated settings hydration path (`P2`).
10. Clean dormant FE-06 paths and backup artifact (`P3`).

## Bottom Line
FE-06 has strong ambition and broad capability coverage, but core reliability currently depends on mismatched contracts (auth transport, message envelope, and action safety). The most important next move is contract alignment: once FE-06 uses one authenticated transport path and one consistent message/action contract, most of the current UX and trust failures become straightforward to fix.

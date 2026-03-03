# ProtoPulse Security Audit

**Audit Date:** 2026-02-27
**Auditor:** Claude Opus 4.6 (automated code review)
**Scope:** Full codebase — client/src/, server/, shared/

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5     |
| HIGH     | 11    |
| MEDIUM   | 15    |
| LOW      | 12    |
| INFO     | 6     |
| **Total** | **49** |

---

## 1. XSS Vectors

- [ ] [MEDIUM] `client/src/components/panels/asset-manager/hooks/useDragGhost.ts:25` — Uses `innerHTML` to set drag ghost content: `dragEl.innerHTML = \`<span style="color:#06b6d4">◆</span> ${assetName}\``. The `assetName` parameter comes from user-editable asset names and is interpolated directly into HTML without sanitization. An asset name like `<img src=x onerror=alert(1)>` would execute arbitrary JavaScript.

- [ ] [LOW] `client/src/components/ui/chart.tsx:79-80` — Uses `dangerouslySetInnerHTML` to inject CSS theme variables. The content is derived from static THEMES config, not user input. Risk is minimal but the pattern should be noted.

- [ ] [INFO] `client/src/components/panels/chat/MessageBubble.tsx:14-49` — AI assistant messages are rendered through `ReactMarkdown` with `remarkGfm`. This is the correct approach -- ReactMarkdown sanitizes HTML by default. No XSS risk here.

---

## 2. SQL Injection

- [ ] [MEDIUM] `server/storage.ts:626-627` — The `getLibraryEntries` search query interpolates user input into an `ilike` pattern: `ilike(componentLibrary.title, \`%${search}%\`)`. While Drizzle's `ilike` function parameterizes the value, the `%` wrapping means LIKE pattern characters (`%`, `_`) in user input are not escaped. A search for `%` would match everything. More critically, the `sql` template literal on line 627 also constructs a query with the search term: `sql\`EXISTS (SELECT 1 FROM unnest(${componentLibrary.tags}) AS t WHERE t ILIKE ${'%' + search + '%'})\``. The Drizzle `sql` tagged template does parameterize interpolated values, so this is **not** a traditional SQL injection. However, the LIKE wildcards are not escaped, enabling pattern-based data extraction.

- [ ] [LOW] All other database queries in `server/storage.ts` use Drizzle ORM's query builder with `eq()`, `and()`, `isNull()`, etc. These are properly parameterized. No raw SQL injection vectors found outside the LIKE pattern issue above.

---

## 3. Authentication Bypass

- [ ] [CRITICAL] `server/index.ts:142-165` — **Auth middleware is completely bypassed in development mode.** When `isDev` is true (which is whenever `NODE_ENV !== 'production'`), the auth middleware allows ALL requests through without any session validation. Lines 149-151 and 157-159 both `return next()` when `isDev` is true. This means every endpoint is unauthenticated in development, which is the default deployment mode. If this app is ever deployed without explicitly setting `NODE_ENV=production`, all endpoints are wide open.

- [ ] [CRITICAL] `server/index.ts:140-143` — **The `/api/seed` endpoint is listed as a public path** (line 143: `req.path === '/api/seed'`). While the seed endpoint checks `process.env.NODE_ENV === "production"` internally (routes.ts:1018), any non-production deployment allows unauthenticated database seeding. This can overwrite project data.

- [ ] [HIGH] `server/index.ts:140` — **The `/api/metrics` and `/api/docs` endpoints are public.** `PUBLIC_PATHS` includes `/api/metrics` and `/api/docs`. The metrics endpoint (`server/index.ts:220-222`) exposes request counts, status codes, and endpoint timing data. The docs endpoint exposes the full API route listing. Both could assist an attacker in reconnaissance.

- [ ] [HIGH] **No ownership authorization (IDOR vulnerability).** The auth middleware only validates that a session exists -- it does NOT check whether the authenticated user owns the project/resource they are accessing. Any authenticated user can read/modify/delete ANY project, ANY BOM item, ANY chat message, etc. by simply knowing (or guessing) the numeric ID. For example:
  - `GET /api/projects/1/nodes` -- any user can read any project's nodes
  - `DELETE /api/projects/1` -- any user can delete any project
  - `PATCH /api/projects/1/bom/5` -- any user can modify any BOM item
  - No `req.userId` check is performed against the project owner anywhere in routes.ts or circuit-routes.ts

- [ ] [HIGH] `server/circuit-routes.ts` (multiple locations) — **Circuit routes (`/api/circuits/...`) skip project-level scoping.** Endpoints like `GET /api/circuits/:circuitId/instances` (line 69), `DELETE /api/circuits/:circuitId/instances/:id` (line 135), `GET /api/circuits/:circuitId/nets` (line 146) use only the circuit ID. There is no verification that the authenticated user has access to the project that owns this circuit.

- [ ] [HIGH] `server/routes.ts:1204-1211` — **Admin purge endpoint has no admin role check.** `DELETE /api/admin/purge` permanently deletes soft-deleted records older than 30 days. Any authenticated user (or any user at all in dev mode) can trigger this destructive operation. There is no admin role or permission check.

---

## 4. API Key Exposure

- [ ] [CRITICAL] `client/src/components/panels/ChatPanel.tsx:464` — **API key sent in plaintext in request body.** The client sends the AI provider API key (`apiKey: aiApiKey`) directly in the JSON body of the `/api/chat/ai/stream` POST request. This means the API key traverses the network in the request body on every AI chat message. While HTTPS would encrypt the transport, this key is also visible in browser devtools Network tab, and could be logged by any proxy, WAF, or server-side request logger.

- [ ] [CRITICAL] `server/index.ts:190-192` — **Response body logging captures API keys.** The response logger captures and logs the first 500 characters of every JSON response body. This means any endpoint that echoes back request data (or error messages containing the key) could log API keys to stdout. Additionally, if an error response includes the API key in any form, it will be written to logs.

- [ ] [HIGH] `client/src/components/views/component-editor/ModifyModal.tsx:25,74` — **API keys stored in localStorage.** The Gemini API key is stored in `localStorage` under the key `gemini_api_key`. This is accessible to any JavaScript running on the same origin, including XSS payloads. Same pattern exists in:
  - `client/src/components/views/component-editor/PinExtractModal.tsx:25,90`
  - `client/src/components/views/component-editor/DatasheetExtractModal.tsx:24,109`

- [ ] [MEDIUM] `client/src/components/panels/ChatPanel.tsx:464` and `server/routes.ts:78,1086` — **API keys accepted from client in request body.** The `aiRequestSchema` (routes.ts:78) accepts `apiKey` as an optional field from the client. While server-side stored keys take precedence when `req.userId` is present (routes.ts:1089-1095), the client can still send keys in the body. This dual-source approach means the API key is transmitted even when it does not need to be.

- [ ] [MEDIUM] `server/circuit-ai.ts:24-38` — **Circuit AI endpoints require API key directly in the request body** (`apiKey: z.string().min(1)`). These endpoints (`/api/circuits/:id/ai/generate`, `/review`, `/analyze`) always require the API key in the body -- they do not fall back to server-stored keys.

---

## 5. CORS Configuration

- [ ] [HIGH] `server/index.ts:53-64` — **Development CORS allows any origin with credentials.** In dev mode, line 55 sets `Access-Control-Allow-Origin` to `req.headers.origin || '*'`, and line 58 sets `Access-Control-Allow-Credentials: true`. This reflects the origin header back, meaning any website can make credentialed cross-origin requests to the API. Combined with the dev-mode auth bypass, this means any website can access all API endpoints with full permissions when the server is in development mode.

- [ ] [MEDIUM] `server/index.ts:34-49` — **CSP is disabled in development.** `contentSecurityPolicy: isDev ? false : {...}` means there is no Content-Security-Policy header in development mode, removing a layer of XSS protection.

---

## 6. Input Validation Gaps

- [ ] [HIGH] `server/routes.ts:861,870` — **DRC endpoint accepts unvalidated `view` and `rules` from request body.** The `req.body?.view` is cast directly with `as 'breadboard' | 'schematic' | 'pcb'` without Zod validation (line 861). More dangerously, `req.body?.rules` (line 870) passes arbitrary user-supplied rules objects directly to `runDRC()`. If `runDRC` processes these rules without validation, this could lead to unexpected behavior or prototype pollution.

- [ ] [MEDIUM] `server/circuit-routes.ts:220` — **`circuitName` taken from `req.body` without Zod validation** in the expand-architecture endpoint: `const { circuitName } = req.body as { circuitName?: string }`. The `as` cast bypasses runtime validation.

- [ ] [MEDIUM] `server/circuit-routes.ts:1505-1520` — **SPICE export endpoint reads `analysisType`, `transient`, `ac`, `dcSweep`, `temperature` directly from `req.body` without Zod validation.** These values are passed to the SPICE exporter and could contain unexpected types or malicious values.

- [ ] [MEDIUM] `server/routes.ts:919` — **`currentPart: z.any().optional()`** in the modify body schema accepts arbitrary JSON. This means any structure can be passed as a "current part" and will be forwarded to the AI modification function. No schema validation on the shape.

- [ ] [MEDIUM] `server/routes.ts:975` — **`meta: z.any()`** in the suggest body schema. Same issue -- accepts arbitrary JSON.

- [ ] [MEDIUM] `server/circuit-routes.ts:44,164-166,191-193` — **Multiple `z.any()` fields** in circuit route schemas: `settings`, `segments`, `labels`, `style`. These bypass all type checking and allow any JSON structure through.

- [ ] [LOW] `server/routes.ts:802-803` — **Component library endpoint parses pagination without full Zod validation.** `page` and `limit` are parsed with `parseInt()` and `Math.min()` directly from query params, not through a Zod schema. While `Math.min(..., 100)` caps the limit, `parseInt(req.query.page as string)` could produce `NaN` without explicit handling (though `|| 1` provides a fallback).

---

## 7. Rate Limiting

- [ ] [HIGH] `server/index.ts:80-87` — **Rate limiting explicitly skips the AI streaming endpoint.** Line 85: `skip: (req) => req.path === '/api/chat/ai/stream'`. This means the most expensive endpoint (AI streaming, which calls Anthropic/Gemini APIs) has NO rate limiting. An attacker could flood this endpoint, causing excessive API costs.

- [ ] [MEDIUM] `server/index.ts:80-87` — **Auth endpoints share the same rate limit as all other API endpoints** (300 requests per 15 minutes). There is no dedicated, stricter rate limit on `/api/auth/login` to prevent brute-force password attacks. 300 attempts per 15 minutes is far too generous for a login endpoint.

- [ ] [MEDIUM] **No per-user rate limiting.** The rate limiter uses IP-based limiting. Behind a shared proxy or NAT, all users share the same limit. There is no per-session or per-user rate limiting.

---

## 8. Error Information Leakage

- [ ] [MEDIUM] `server/index.ts:228-243` — **Error handler exposes original error message for 4xx errors.** Line 238: `clientMessage = err.message || "Bad request"`. For status codes less than 500, the raw error message is sent to the client. While 500+ errors get a generic message, 4xx errors could contain internal details (e.g., database constraint names, internal paths).

- [ ] [LOW] `server/index.ts:234` — **Stack traces logged to server logs.** `logger.error("Server error", { stack: err.stack, status })` logs full stack traces. While this is appropriate for server-side logging, ensure logs are not accessible to clients (the `/api/metrics` endpoint is public, but appears to only expose request counts, not error details).

- [ ] [LOW] `server/circuit-ai.ts:259,361` — **AI raw response text included in 422 error responses.** When AI returns invalid JSON, the raw text is included in the response: `res.status(422).json({ message: "AI returned invalid JSON", raw: redactSecrets(text) })`. While secrets are redacted, the raw AI output could contain sensitive project data or unexpected content.

---

## 9. Sensitive Data in Logs

- [ ] [HIGH] `server/index.ts:190-192` — **Response body logging can capture sensitive data.** The response logging middleware captures up to 500 characters of every JSON response body and writes it to the log. This means:
  - Session IDs returned from `/api/auth/login` and `/api/auth/register` are logged
  - Any API response containing user data, project data, or error details with secrets are logged
  - The `redactSecrets` function from `ai.ts` is NOT applied to these logs

- [ ] [MEDIUM] `server/auth.ts:16` — **Encryption key warning includes environment information.** `logger.warn('API_KEY_ENCRYPTION_KEY not set...', { env: process.env.NODE_ENV })` logs the current NODE_ENV value alongside the warning.

---

## 10. CSRF Protection

- [ ] [MEDIUM] `server/index.ts:102-128` — **CSRF protection has significant gaps.** The origin-check middleware:
  1. **Exempts the AI streaming endpoint entirely** (line 103): `if (req.path === '/api/chat/ai/stream') return next()`. This means the most impactful endpoint (can modify project state via AI actions) has zero CSRF protection.
  2. **Skips origin check in dev mode when no origin header is present** (lines 118-119): `if (!originHost) { if (isDev) return next(); }`. Tools like curl or Postman (no Origin header) work in dev.
  3. Uses `x-forwarded-host` for comparison (line 108), which can be spoofed if the proxy chain is not properly configured.

- [ ] [LOW] The application uses custom `X-Session-Id` header for auth (not cookies), which provides partial CSRF protection since custom headers cannot be set in cross-origin simple requests. However, the `Access-Control-Allow-Headers` (line 57) includes `X-Session-Id`, and dev CORS allows any origin with credentials, negating this protection in dev mode.

---

## 11. File Upload Security

- [ ] [MEDIUM] `server/routes.ts:747-778` — **FZPZ import has file size limit (5MB) but no content-type validation.** The endpoint accepts any binary data and passes it to `importFromFzpz()`. There is no validation that the file is actually a valid ZIP/FZPZ file before processing begins. If `importFromFzpz` uses `jszip` to parse, a malformed ZIP could potentially cause denial of service (zip bomb).

- [ ] [MEDIUM] `server/circuit-routes.ts:1170-1181` — **FZZ import accepts raw binary or base64 with 10MB limit** but no file type validation beyond checking if it is a Buffer or base64 string. Same zip bomb risk.

- [ ] [LOW] `server/routes.ts:781-795` — **SVG import parses user-supplied SVG content.** SVG files can contain embedded scripts, external entity references (XXE), and other attack vectors. The `parseSvgToShapes` function should be audited for safe parsing. The 2MB limit is reasonable.

---

## 12. Dependency Vulnerabilities

- [ ] [HIGH] **rollup >=4.0.0 <4.59.0** — Arbitrary File Write via Path Traversal (GHSA-mw96-cpmx-2vgc). This is a build tool dependency but could be exploited during build/dev.

- [ ] [MEDIUM] **esbuild <=0.24.2** — Cross-origin request vulnerability in dev server (GHSA-67mh-4wv8-2f99, CVSS 5.3). Any website can send requests to the esbuild dev server. Transitive dependency via drizzle-kit.

- [ ] [MEDIUM] **lodash >=4.0.0 <=4.17.22** — Prototype Pollution in `_.unset` and `_.omit` (GHSA-xxjr-mmjv-4gpg, CVSS 6.5). Could be exploitable if user input reaches lodash functions.

- [ ] [LOW] **qs >=6.7.0 <=6.14.1** — arrayLimit bypass in comma parsing allows DoS (GHSA-w7fw-mjwx-w883, CVSS 3.7).

**Total vulnerabilities: 7 (0 critical, 1 high, 5 moderate, 1 low)**

---

## 13. Additional Findings

### Timing Attack on Password Verification

- [ ] [MEDIUM] `server/auth.ts:37` — **Password hash comparison uses `===` instead of `crypto.timingSafeEqual`.** Line 37: `resolve(derivedKey.toString('hex') === key)`. String comparison with `===` is not constant-time, making it theoretically vulnerable to timing attacks that could leak information about the correct hash value byte-by-byte. The `scrypt` key derivation adds significant time variance that makes exploitation difficult in practice, but this is still a deviation from security best practices.

### Session Management

- [ ] [LOW] `server/auth.ts:7` — **Sessions have a 7-day lifetime with no refresh/rotation mechanism.** Once a session is created, it is valid for 7 full days. There is no session refresh on activity, no session rotation after auth-related operations, and no mechanism to invalidate all sessions for a user (e.g., "log out everywhere").

- [ ] [LOW] **No session count limit per user.** A user can create unlimited sessions by logging in repeatedly. There is no cleanup of old sessions or limit on concurrent sessions.

### Prompt Injection

- [ ] [MEDIUM] `server/ai.ts:438` — **User-supplied `customSystemPrompt` is injected directly into the AI system prompt** without sanitization: `${appState.customSystemPrompt}`. A user could craft a custom system prompt that overrides the AI's behavior, bypasses safety instructions, or manipulates the AI into performing unintended actions. While this is by design (user customization), it is worth noting that no guardrails or content filtering are applied to the custom prompt.

### Caching

- [ ] [LOW] `server/ai.ts:76-78` — **Global mutable prompt cache** (`cachedPromptHash`, `cachedPrompt`) is shared across all users/requests. In a multi-user scenario, user A's custom system prompt could be cached and served to user B if the state hash collides. The hash includes `custom: appState.customSystemPrompt`, so collisions require identical state, but the global nature is a design concern.

### Server Binding

- [ ] [INFO] `server/index.ts:265` — Server binds to `0.0.0.0` (all interfaces). This is expected for container/cloud deployments but means the server is accessible on all network interfaces, not just localhost.

### Hardcoded Values

- [ ] [INFO] `server/index.ts:31` — `app.set("trust proxy", 1)` is hardcoded. The comment says "Replit runs behind one reverse proxy" but this may not match other deployment environments. Incorrect trust proxy settings can lead to IP spoofing in rate limiting.

- [ ] [INFO] `client/src/lib/project-context.tsx` — PROJECT_ID = 1 is hardcoded (per CLAUDE.md). This is known tech debt, not a security issue per se, but means all users share the same project in the current implementation.

### Missing Security Headers

- [ ] [INFO] No `Strict-Transport-Security` (HSTS) header is explicitly set. Helmet may add this by default in production, but it should be verified.

- [ ] [INFO] `crossOriginEmbedderPolicy: false` is explicitly disabled in the helmet config (index.ts:48). This may be intentional for compatibility with external resources but weakens isolation.

---

## Priority Remediation Order

### Immediate (CRITICAL)

1. **Fix auth bypass in dev mode** — At minimum, require session validation for state-changing operations even in dev mode. Consider a "dev user" auto-login rather than skipping auth entirely.
2. **Stop sending API keys in request body** — Use only server-stored keys (already partially implemented). Remove `apiKey` from request schemas and client-side state.
3. **Add IDOR protection** — Implement ownership checks. Store `userId` on projects table and verify `req.userId` matches `project.ownerId` in every route handler.
4. **Sanitize response logging** — Apply `redactSecrets()` to the response body logger, or exclude sensitive endpoints (`/api/auth/*`, `/api/settings/api-keys`) from response body logging.
5. **Remove API keys from localStorage** — Migrate all client-side API key storage to server-side encrypted storage (already exists in auth.ts).

### Short-term (HIGH)

6. **Add rate limiting to AI streaming endpoint** — Remove the `skip` for `/api/chat/ai/stream` or add a separate, stricter rate limiter.
7. **Add stricter rate limiting to auth endpoints** — Implement a dedicated limiter (e.g., 10 attempts per 15 minutes per IP) for `/api/auth/login`.
8. **Add admin role check** to `/api/admin/purge`.
9. **Make `/api/metrics` and `/api/docs` require authentication.**
10. **Add CSRF protection to AI streaming endpoint** — Remove the CSRF exemption for `/api/chat/ai/stream`.
11. **Update rollup** to >=4.59.0 to fix the path traversal vulnerability.
12. **Add input validation** to DRC endpoint (`view` and `rules` fields) and SPICE export endpoint.

### Medium-term (MEDIUM)

13. **Use `crypto.timingSafeEqual`** for password hash comparison.
14. **Escape LIKE wildcards** in the component library search.
15. **Replace `z.any()` with proper schemas** in circuit route validation.
16. **Add content-type validation** for file upload endpoints (FZPZ, FZZ).
17. **Sanitize `assetName` in drag ghost** innerHTML or use textContent instead.
18. **Add prompt injection guardrails** for custom system prompts.
19. **Fix production CORS** — Ensure a strict allowlist of origins in production (currently only active in dev).
20. **Update lodash and esbuild** to fix prototype pollution and cross-origin vulnerabilities.

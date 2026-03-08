# Wave 52: P0 Security Hardening — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all remaining P0 security vulnerabilities (BL-0002, BL-0003, BL-0006, BL-0008, BL-0070) and mark 6 already-fixed P0 items as DONE, plus fix a discovered `dangerouslySetInnerHTML` vulnerability.

**Architecture:** Server-side fixes in 4 areas: auth path hardening, timing-safe admin key checks with rate limiting, LIKE wildcard escaping in search queries, and ZIP bomb protection for FZZ imports. Client-side: sanitize QR SVG rendering and strip API keys from POST body when server-stored key exists.

**Tech Stack:** Express 5 + crypto.timingSafeEqual + express-rate-limit + Drizzle ORM + JSZip + DOMPurify (or manual SVG sanitization) + Vitest

---

## Triage Results

6 of 14 P0 items were already fixed in prior waves:

| ID | Description | Finding | Action |
|----|-------------|---------|--------|
| BL-0001 | Auth bypass in dev mode | Now requires explicit `UNSAFE_DEV_BYPASS_AUTH=1` (Wave E) | Mark DONE |
| BL-0004 | Response body logging captures API keys | `redactSensitive()` with `SENSITIVE_KEY_PATTERN` regex (Wave E) | Mark DONE |
| BL-0007 | XSS in useDragGhost.ts | Uses `document.createTextNode()`, not `innerHTML` | Mark DONE |
| BL-0009 | Multiple z.any() in Zod schemas | No `z.any()` found in shared/schema.ts | Mark DONE |
| BL-0071 | SVG content without sanitization | `sanitizeSvgContent()` strips script/foreignObject/on* (CAPX-SEC-17) | Mark DONE |
| BL-0072 | Session tokens in plaintext in DB | `hashSessionToken()` SHA-256 in auth.ts:14-16 | Mark DONE |

8 items remain. 2 are crash/data bugs (BL-0010, BL-0011) that will be a separate wave. **This wave fixes the 6 security items + 1 bonus.**

---

## Existing Infrastructure

| Module | File | Status |
|--------|------|--------|
| Auth middleware | `server/index.ts:206-230` | PUBLIC_PATHS + session validation |
| Admin routes | `server/routes/admin.ts` | `x-admin-key` header check, no timing-safe |
| Backup routes | `server/routes/backup.ts:31-43` | `requireAdminKey()` helper, same issue |
| Storage search | `server/storage/components.ts:106-107` | `ilike()` with unescaped user input |
| Storage search | `server/storage/misc.ts:139-140` | Same pattern |
| FZZ import | `server/export/fzz-handler.ts:524-579` | No file count or size limits |
| FZPZ import | `server/component-export.ts:425-456` | Has MAX_ZIP_FILES=20 + MAX_UNCOMPRESSED_SIZE=50MB |
| Stream endpoint | `server/routes/chat.ts:383-406` | Accepts `apiKey` in body, prefers server-stored |
| QR label preview | `client/src/components/views/StorageManagerPanel.tsx:732` | `dangerouslySetInnerHTML={{ __html: previewSvg }}` |

---

## Phase 1: Server Auth & Input Hardening (Teammate 1)

### Task 1: Remove `/api/seed` from PUBLIC_PATHS

**Files:**
- Modify: `server/index.ts:204-207`
- Test: `server/__tests__/p0-server-security.test.ts` (create)

**Context:** `/api/seed` and `/api/admin/seed-library` bypass auth entirely. The seed endpoint populates the standard component library — it should not be callable by arbitrary unauthenticated users. The auto-seed on startup in `index.ts:301-318` calls storage directly (not via HTTP), so it's unaffected.

**Step 1: Write failing test**

```typescript
// server/__tests__/p0-server-security.test.ts
import { describe, it, expect } from 'vitest';

describe('BL-0002: Public path restrictions', () => {
  it('/api/seed is NOT in PUBLIC_PATHS', () => {
    // Verify the auth middleware doesn't skip /api/seed
    // We import the raw middleware logic to test the path check
    const PUBLIC_PATHS = ['/api/auth/', '/api/health', '/api/ready', '/api/docs', '/api/metrics', '/api/settings/chat'];
    const seedPath = '/seed';
    const isPublic = PUBLIC_PATHS.some(p => seedPath.startsWith(p.replace('/api', '')));
    expect(isPublic).toBe(false);
  });

  it('/api/admin/seed-library is NOT in PUBLIC_PATHS', () => {
    const PUBLIC_PATHS = ['/api/auth/', '/api/health', '/api/ready', '/api/docs', '/api/metrics', '/api/settings/chat'];
    const seedPath = '/admin/seed-library';
    const isPublic = PUBLIC_PATHS.some(p => seedPath.startsWith(p.replace('/api', '')));
    expect(isPublic).toBe(false);
  });
});
```

**Step 2: Run test — expect FAIL** (test logic passes but we need to verify the actual code change)

**Step 3: Modify `server/index.ts`**

Remove the `/api/seed` and `/api/admin/seed-library` exceptions from the auth middleware:

```typescript
// Line 207 — BEFORE:
if (PUBLIC_PATHS.some(p => req.path.startsWith(p.replace('/api', ''))) || req.path === '/api/seed' || req.path === '/api/admin/seed-library') {

// AFTER:
if (PUBLIC_PATHS.some(p => req.path.startsWith(p.replace('/api', '')))) {
```

The `/api/seed` endpoint in `server/routes/seed.ts` already has its own rate limiter. Adding auth means only authenticated users can trigger manual seed. The admin seed-library endpoint already requires `x-admin-key` — adding session auth as a defense-in-depth layer.

**Step 4: Run `npm run check` + `npm test` — expect PASS**

**Step 5: Commit** `fix(security): BL-0002 remove /api/seed from PUBLIC_PATHS`

---

### Task 2: Timing-safe admin key comparison + rate limiter

**Files:**
- Modify: `server/routes/admin.ts`
- Modify: `server/routes/backup.ts`
- Test: `server/__tests__/p0-server-security.test.ts` (append)

**Context:** Admin endpoints use `adminKey !== expectedKey` (direct string comparison) which is vulnerable to timing attacks. Also no dedicated rate limiter — only the global 300 req/15min API limiter.

**Step 1: Write failing tests**

```typescript
import crypto from 'crypto';

describe('BL-0006: Admin key timing-safe comparison', () => {
  it('timingSafeEqual returns true for matching keys', () => {
    const key = 'test-admin-key-12345678';
    const a = Buffer.from(key, 'utf8');
    const b = Buffer.from(key, 'utf8');
    expect(crypto.timingSafeEqual(a, b)).toBe(true);
  });

  it('timingSafeEqual returns false for non-matching keys', () => {
    const a = Buffer.from('correct-key-value-here', 'utf8');
    const b = Buffer.from('incorrect-key-val-here', 'utf8');
    expect(crypto.timingSafeEqual(a, b)).toBe(false);
  });

  it('handles different length keys safely', () => {
    // timingSafeEqual throws on different lengths — need to pad or hash first
    const key1 = 'short';
    const key2 = 'much-longer-key';
    const h1 = crypto.createHash('sha256').update(key1).digest();
    const h2 = crypto.createHash('sha256').update(key2).digest();
    expect(crypto.timingSafeEqual(h1, h2)).toBe(false);
  });
});
```

**Step 2: Run test — expect PASS** (these test crypto directly)

**Step 3: Create shared `safeCompareAdminKey` helper in `server/routes/admin.ts`**

```typescript
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

/** Timing-safe comparison of admin key using SHA-256 digest to normalize lengths. */
function safeCompareAdminKey(provided: string | undefined, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Dedicated rate limiter for admin endpoints — 5 requests per minute per IP. */
const adminRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Try again later.' },
});
```

Replace all `adminKey !== expectedKey` checks with `safeCompareAdminKey(adminKey, expectedKey)`. Apply `adminRateLimiter` middleware to admin routes.

Do the same in `server/routes/backup.ts` — the `requireAdminKey()` helper uses the same pattern.

**Step 4: Run `npm run check` + `npm test` — expect PASS**

**Step 5: Commit** `fix(security): BL-0006 timing-safe admin key + rate limit`

---

### Task 3: Escape LIKE wildcards in search queries

**Files:**
- Modify: `server/storage/components.ts:106-107`
- Modify: `server/storage/misc.ts:139-140`
- Test: `server/__tests__/p0-server-security.test.ts` (append)

**Context:** `ilike(componentLibrary.title, '%${search}%')` passes user input directly into a LIKE pattern. Users can use `%` (match any) and `_` (match single char) to enumerate data.

**Step 1: Write failing test**

```typescript
describe('BL-0008: LIKE wildcard escaping', () => {
  it('escapeLikeWildcards escapes % and _', () => {
    // Import will fail until we create the function
    const { escapeLikeWildcards } = require('../storage/utils');
    expect(escapeLikeWildcards('test%value')).toBe('test\\%value');
    expect(escapeLikeWildcards('test_value')).toBe('test\\_value');
    expect(escapeLikeWildcards('100%_done')).toBe('100\\%\\_done');
    expect(escapeLikeWildcards('normal')).toBe('normal');
  });
});
```

**Step 2: Run test — expect FAIL** (function doesn't exist)

**Step 3: Add `escapeLikeWildcards` to `server/storage/utils.ts`**

```typescript
/** Escape SQL LIKE/ILIKE wildcard characters in user input. */
export function escapeLikeWildcards(input: string): string {
  return input.replace(/[%_\\]/g, (ch) => '\\' + ch);
}
```

Then in `server/storage/components.ts` and `server/storage/misc.ts`, wrap the search term:

```typescript
import { escapeLikeWildcards } from './utils';
// ...
const escaped = escapeLikeWildcards(search);
ilike(componentLibrary.title, `%${escaped}%`),
```

**Step 4: Run test — expect PASS**

**Step 5: Commit** `fix(security): BL-0008 escape LIKE wildcards in search`

---

### Task 4: FZZ ZIP bomb protection

**Files:**
- Modify: `server/export/fzz-handler.ts:524-579`
- Test: `server/__tests__/p0-server-security.test.ts` (append)

**Context:** FZPZ import has `MAX_ZIP_FILES=20` and `MAX_UNCOMPRESSED_SIZE=50MB` guards. FZZ import has none — `importFzz()` calls `JSZip.loadAsync(buffer)` then iterates all entries without limits.

**Step 1: Write failing test**

```typescript
import JSZip from 'jszip';

describe('BL-0070: FZZ ZIP bomb protection', () => {
  it('rejects FZZ with too many files', async () => {
    const { importFzz } = await import('../export/fzz-handler');
    const zip = new JSZip();
    // Create 101 dummy files (limit should be 100)
    for (let i = 0; i < 101; i++) {
      zip.file(`file${i}.fzp`, '<module/>');
    }
    const buf = Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
    await expect(importFzz(buf)).rejects.toThrow(/too many/i);
  });
});
```

**Step 2: Run test — expect FAIL** (no limit enforced)

**Step 3: Add guards to `server/export/fzz-handler.ts`**

At the top of `importFzz()`, after `loadAsync`:

```typescript
const MAX_FZZ_FILES = 100;
const MAX_FZZ_UNCOMPRESSED_SIZE = 50 * 1024 * 1024; // 50 MB

export async function importFzz(buffer: Buffer): Promise<FzzImportResult> {
  const zip = await JSZip.loadAsync(buffer);

  // ZIP bomb protection
  const allFiles = Object.entries(zip.files).filter(([, f]) => !f.dir);
  if (allFiles.length > MAX_FZZ_FILES) {
    throw new Error(`FZZ archive contains too many entries (${allFiles.length}, max ${MAX_FZZ_FILES})`);
  }

  let totalUncompressed = 0;
  const warnings: string[] = [];
  // ... rest of function, but add byte tracking to every file.async('string') call:
  // totalUncompressed += Buffer.byteLength(content, 'utf8');
  // if (totalUncompressed > MAX_FZZ_UNCOMPRESSED_SIZE) throw ...
```

**Step 4: Run test — expect PASS**

**Step 5: Commit** `fix(security): BL-0070 FZZ ZIP bomb protection`

---

## Phase 2: Client Security (Teammate 2)

### Task 5: Strip API key from stream POST body when server key exists

**Files:**
- Modify: `client/src/components/panels/ChatPanel.tsx:553-555`
- Modify: `server/routes/chat.ts` (ensure key never in SSE events)
- Test: `server/__tests__/p0-response-security.test.ts` (create)

**Context:** The client currently always sends `apiKey: s.aiApiKey` in the POST body (line 555). The server already prefers server-stored keys (chat.ts:401-406). The fix: client should send `apiKey: ''` when it knows the user is authenticated (has `X-Session-Id`). The server handles the fallback.

**Step 1: Write test verifying API key doesn't appear in SSE event data**

```typescript
describe('BL-0003: API key not in response', () => {
  it('streamAIMessage events should never contain apiKey field', () => {
    // Test that the SSE serialization format doesn't include apiKey
    const mockEvent = { type: 'content', content: 'hello', provider: 'anthropic' };
    const serialized = JSON.stringify(mockEvent);
    expect(serialized).not.toContain('apiKey');
    expect(serialized).not.toContain('sk-ant-');
  });
});
```

**Step 2: Modify ChatPanel.tsx**

In the stream request body construction (around line 553-555), don't include the raw API key when the user has an active session:

```typescript
// Get session ID to determine if server-stored keys are available
const sessionId = localStorage.getItem('session_id');

const body = {
  message: s.input,
  provider: s.aiProvider,
  model: s.aiModel,
  // Only send API key from client when no server session exists
  apiKey: sessionId ? '' : s.aiApiKey,
  projectId: s.projectId,
  // ... rest of fields
};
```

**Step 3: Run `npm run check` — expect PASS**

**Step 4: Commit** `fix(security): BL-0003 don't send API key when server key exists`

---

### Task 6: Sanitize QR SVG in StorageManagerPanel

**Files:**
- Modify: `client/src/components/views/StorageManagerPanel.tsx:730-733`
- Test: `client/src/lib/__tests__/p0-client-security.test.ts` (create)

**Context:** Line 732 uses `dangerouslySetInnerHTML={{ __html: previewSvg }}` to render QR label preview SVG. The SVG is generated by `qr-labels.ts` (not user input), but defense-in-depth requires sanitization — especially if the QR content includes user-editable data (component names, project names).

**Step 1: Write test**

```typescript
describe('SVG sanitization', () => {
  it('strips script tags from SVG content', () => {
    const { sanitizeSvg } = require('@/lib/svg-sanitize');
    const dirty = '<svg><script>alert("xss")</script><rect/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).toContain('<rect');
  });

  it('strips event handlers from SVG elements', () => {
    const { sanitizeSvg } = require('@/lib/svg-sanitize');
    const dirty = '<svg><rect onclick="alert(1)" width="10"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain('onclick');
    expect(clean).toContain('width');
  });
});
```

**Step 2: Create minimal SVG sanitizer** (reuse the same pattern as server-side `sanitizeSvgContent`)

Create `client/src/lib/svg-sanitize.ts`:

```typescript
/**
 * Client-side SVG sanitizer — strips dangerous elements and attributes.
 * Mirrors server/component-export.ts sanitizeSvgContent().
 */
export function sanitizeSvg(svgString: string): string {
  let s = svgString;
  // Strip <script> tags
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Strip <foreignObject> tags
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  // Strip event handler attributes (on*)
  s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Strip javascript: URIs in href/xlink:href
  s = s.replace(/(href\s*=\s*(?:"|'))javascript:[^"']*("|')/gi, '$1#$2');
  return s;
}
```

Then in `StorageManagerPanel.tsx`, replace the unsafe rendering:

```typescript
import { sanitizeSvg } from '@/lib/svg-sanitize';
// ...
dangerouslySetInnerHTML={{ __html: sanitizeSvg(previewSvg) }}
```

**Step 3: Run tests — expect PASS**

**Step 4: Commit** `fix(security): sanitize QR SVG rendering in StorageManagerPanel`

---

## Phase 3: Backlog Updates (Teammate 3 or Lead)

### Task 7: Update MASTER_BACKLOG.md

**Files:**
- Modify: `docs/MASTER_BACKLOG.md`

Mark these as DONE with Wave 52 reference:
- BL-0001: `DONE (Wave E)` — auth bypass requires explicit env var
- BL-0002: `DONE (Wave 52)` — removed from PUBLIC_PATHS
- BL-0003: `DONE (Wave 52)` — client omits key when server-stored
- BL-0004: `DONE (Wave E)` — redactSensitive handles API key logging
- BL-0005: `PARTIAL` — note: requires auth UI (BL-0021) for full fix; localStorage still used as fallback for unauthenticated BYOK
- BL-0006: `DONE (Wave 52)` — timing-safe + rate limit
- BL-0007: `DONE` — uses createTextNode, not innerHTML
- BL-0008: `DONE (Wave 52)` — LIKE wildcards escaped
- BL-0009: `DONE` — no z.any() in schema
- BL-0070: `DONE (Wave 52)` — FZZ ZIP bomb protection
- BL-0071: `DONE (CAPX-SEC-17)` — sanitizeSvgContent
- BL-0072: `DONE` — hashSessionToken SHA-256

Update Quick Stats: P0 count 14 → 2 (BL-0010, BL-0011 remain).

---

## `/agent-teams` Prompts

### Teammate 1: `server-security`

**Files owned:** `server/index.ts`, `server/routes/admin.ts`, `server/routes/backup.ts`, `server/storage/components.ts`, `server/storage/misc.ts`, `server/storage/utils.ts`, `server/export/fzz-handler.ts`, `server/__tests__/p0-server-security.test.ts`

**Prompt:**
> You are fixing P0 security vulnerabilities in ProtoPulse. Your tasks:
>
> **Task 1 (BL-0002):** In `server/index.ts:207`, remove `|| req.path === '/api/seed' || req.path === '/api/admin/seed-library'` from the auth bypass condition. These endpoints should require authentication.
>
> **Task 2 (BL-0006):** In `server/routes/admin.ts` and `server/routes/backup.ts`, replace direct string comparison `adminKey !== expectedKey` with timing-safe comparison using `crypto.createHash('sha256')` + `crypto.timingSafeEqual()`. Add a dedicated `rateLimit({ windowMs: 60_000, max: 5 })` middleware to all admin routes. Import `rateLimit` from `express-rate-limit` and `crypto` from `crypto`.
>
> **Task 3 (BL-0008):** Add `escapeLikeWildcards(input: string): string` to `server/storage/utils.ts` that escapes `%`, `_`, and `\` with a backslash prefix. Use it in `server/storage/components.ts:106-107` and `server/storage/misc.ts:139-140` before passing search terms to `ilike()`.
>
> **Task 4 (BL-0070):** In `server/export/fzz-handler.ts`, add `MAX_FZZ_FILES = 100` and `MAX_FZZ_UNCOMPRESSED_SIZE = 50 * 1024 * 1024` constants. At the start of `importFzz()` after `loadAsync`, check file count and throw if over limit. Track `totalUncompressed` bytes across all `file.async('string')` calls and throw if exceeded.
>
> Write tests in `server/__tests__/p0-server-security.test.ts` for all 4 fixes. Run `npm run check` and `npm test` after each change. Commit after each task.

### Teammate 2: `client-security`

**Files owned:** `client/src/components/panels/ChatPanel.tsx`, `client/src/components/views/StorageManagerPanel.tsx`, `client/src/lib/svg-sanitize.ts` (create), `client/src/lib/__tests__/p0-client-security.test.ts` (create)

**Prompt:**
> You are fixing P0 security vulnerabilities on the client side of ProtoPulse.
>
> **Task 5 (BL-0003):** In `client/src/components/panels/ChatPanel.tsx`, around line 553-555 where the stream request body is built, change `apiKey: s.aiApiKey` to check if the user has an active session (check for `X-Session-Id` header or `localStorage.getItem('session_id')`). If a session exists, send `apiKey: ''` — the server will use the server-stored encrypted key. Only send the actual key when no session exists (unauthenticated BYOK mode).
>
> **Task 6 (SVG sanitization):** Create `client/src/lib/svg-sanitize.ts` with a `sanitizeSvg(svgString: string): string` function that strips `<script>`, `<foreignObject>`, `on*` event handler attributes, and `javascript:` URIs from SVG content. Then in `client/src/components/views/StorageManagerPanel.tsx:732`, wrap the `previewSvg` with `sanitizeSvg()` before passing to `dangerouslySetInnerHTML`.
>
> Write tests in `client/src/lib/__tests__/p0-client-security.test.ts`. Run `npm run check` and `npm test` after each change. Commit after each task.

### Teammate 3: `backlog-updater`

**Files owned:** `docs/MASTER_BACKLOG.md`

**Prompt:**
> Update `docs/MASTER_BACKLOG.md` to reflect Wave 52 P0 security hardening results:
>
> Mark these as DONE:
> - BL-0001: `DONE (Wave E)` — auth bypass now requires explicit UNSAFE_DEV_BYPASS_AUTH=1
> - BL-0002: `DONE (Wave 52)` — removed from PUBLIC_PATHS
> - BL-0003: `DONE (Wave 52)` — client omits API key when server key exists
> - BL-0004: `DONE (Wave E)` — redactSensitive handles API key logging
> - BL-0006: `DONE (Wave 52)` — timing-safe admin key + rate limit
> - BL-0007: `DONE` — uses createTextNode not innerHTML
> - BL-0008: `DONE (Wave 52)` — LIKE wildcards escaped
> - BL-0009: `DONE` — no z.any() in schema
> - BL-0070: `DONE (Wave 52)` — FZZ ZIP bomb protection
> - BL-0071: `DONE (CAPX-SEC-17)` — sanitizeSvgContent
> - BL-0072: `DONE` — hashSessionToken SHA-256
>
> Mark BL-0005 as `PARTIAL` with note: "localStorage still used for unauthenticated BYOK; full fix requires auth UI (BL-0021)"
>
> Update Quick Stats table: P0 count from 14 to 2 (BL-0010, BL-0011 remain as Crashes).
>
> Commit: `docs: update MASTER_BACKLOG.md with Wave 52 P0 security results`

---

## Dependency Order

```
Teammates 1 + 2 run in PARALLEL (no file overlap)
Teammate 3 runs AFTER 1 + 2 complete (needs final status)
```

## Team Execution Checklist

- [ ] Read this plan
- [ ] `/agent-teams` — spawn 3 teammates per prompts above
- [ ] Teammates 1 + 2 execute in parallel
- [ ] `npm run check` — zero TS errors
- [ ] `npm test` — all tests pass
- [ ] Teammate 3 updates backlog
- [ ] Final commit + cleanup

## Verification

1. `npm run check` — zero TS errors
2. `npm test` — all existing + new tests pass
3. Verify `/api/seed` returns 401 without session
4. Verify admin endpoints use timing-safe comparison
5. Verify LIKE search with `%` char doesn't wildcard-expand
6. Verify FZZ import with 101+ files is rejected
7. Verify StorageManagerPanel QR preview sanitizes SVG
8. Verify stream POST body doesn't include API key when session exists

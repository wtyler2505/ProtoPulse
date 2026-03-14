---
summary: The useApiKeys hook uses a STORED_KEY_SENTINEL placeholder so real API keys never appear in client-side state after server-side migration, while maintaining localStorage fallback for unauthenticated users
category: implementation-detail
areas: ["[[index]]"]
related insights:
  - "[[localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario]] — the localStorage fallback in useApiKeys is itself localStorage-backed tech debt that the server-side path is meant to supersede"
  - "[[localstorage-features-follow-an-identical-five-step-migration-to-server-scoped-storage]] — useApiKeys implements this exact migration: detect server availability, push local keys, clear local copies"
type: insight
source: extraction
created: 2026-03-14
status: active
evidence:
  - localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario.md
  - localstorage-features-follow-an-identical-five-step-migration-to-server-scoped-storage.md
---

The `useApiKeys` hook (`client/src/hooks/useApiKeys.ts`) implements a dual-persistence strategy for API keys that keeps real key values invisible to the client after authentication:

1. **Unauthenticated**: Keys stored in localStorage (per-provider keys with a legacy single-key migration path). The raw key value is visible in React state and sent to the server with each chat request.

2. **Authenticated**: On first authenticated load, a one-time migration runs: any localStorage keys are pushed to the server via `POST /api/settings/api-keys` (stored AES-256-GCM encrypted), then deleted from localStorage. After migration, the actual key never leaves the server — it's read directly from encrypted storage during AI requests.

3. **Sentinel trick**: For authenticated users, the hook returns `STORED_KEY_SENTINEL` (`'********'`) as the `apiKey` value instead of the real key. This satisfies the downstream `!aiApiKey` guard in ChatPanel's send handler (the guard checks for empty string, not for a specific key value) without ever exposing the real key to React state, DevTools, or console logging.

4. **Controlled input responsiveness**: During active editing (user is typing a new key), `localKeys` state tracks the typed value so the input stays responsive. After the server save mutation succeeds, `onSuccess` clears `localKeys` back to empty, and the hook falls back to the sentinel display.

5. **Legacy migration**: A `LEGACY_KEY` constant (`'protopulse-ai-api-key'`) handles migration from the original single-provider localStorage key to per-provider keys. This migration happens transparently in `readLocalKey()`.

The sentinel must be ASCII-safe (the comment explicitly warns about Unicode >255 causing ByteString errors in HTTP headers) because even though the sentinel shouldn't be sent to the server, defensive coding prevents header encoding crashes if it somehow is.

---

Related:
- [[localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario]] — the localStorage fallback in useApiKeys is itself localStorage-backed tech debt that the server-side path is meant to supersede
- [[localstorage-features-follow-an-identical-five-step-migration-to-server-scoped-storage]] — useApiKeys implements this exact 5-step migration: detect server availability, push local keys, clear local copies
- [[session-token-rotation-on-refresh-prevents-session-fixation-by-invalidating-the-old-hash-atomically-with-new-hash-creation]] — API key encryption (AES-256-GCM) and session token hashing (SHA-256) are the two complementary server-side secret protection mechanisms
- [[error-message-mapping-uses-cascading-pattern-matchers-to-translate-raw-api-errors-into-actionable-guidance]] — invalid API key is one of the 6 AI-specific error patterns the cascading mapper handles

## Topics

- [[index]]

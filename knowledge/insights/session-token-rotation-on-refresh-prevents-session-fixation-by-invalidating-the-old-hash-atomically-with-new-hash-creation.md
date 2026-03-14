---
name: Session token rotation on refresh prevents session fixation by invalidating the old hash atomically with new hash creation
description: server/auth.ts refreshSession() rotates the session token — issuing a new UUID, storing its SHA-256 hash, and deleting the old hash — but only when the session is within 1 day of expiry (the refresh window), preventing unnecessary rotation on every request while still limiting token lifetime
type: insight
---

# Session Token Rotation on Refresh Prevents Session Fixation by Invalidating the Old Hash Atomically with New Hash Creation

`server/auth.ts` implements a session management pattern with several security-conscious design choices:

**Token hashing:** Raw session tokens (UUIDs) are never stored in the database. The DB stores only SHA-256 hashes. `hashSessionToken()` runs on every validate/refresh call. This means a database leak does not expose usable session tokens.

**Refresh window:** `refreshSession()` only rotates when the session has less than `REFRESH_WINDOW_MS` (24 hours) remaining of its 7-day lifetime. This prevents unnecessary rotation on every API call while ensuring tokens don't live indefinitely.

**Rotation sequence:**
1. Validate the old token hash exists and isn't expired
2. Check if within the refresh window (remaining < 24h)
3. Generate a new raw UUID
4. INSERT the new hash with fresh expiry
5. DELETE the old hash
6. Return the new raw token to the client

**Non-atomic concern:** Steps 4 and 5 are not wrapped in a database transaction. If the server crashes between INSERT and DELETE, both tokens would be valid temporarily. This is a deliberate trade-off — the old token would simply expire naturally within 24 hours, and the duplicate-valid-token window is bounded.

**Password hashing:** Uses `scrypt` with `N=16384, r=8, p=1` and `maxmem=64MB`. The salt is stored inline with the hash as `salt:derivedKey`. Password verification uses `crypto.timingSafeEqual()` to prevent timing attacks.

**API key encryption:** AES-256-GCM with per-key random 12-byte IVs. The auth tag is stored alongside the ciphertext as `encrypted:authTag`. The encryption key itself is validated as a 64-char hex string at startup, with a dev-only ephemeral fallback that explicitly warns about non-persistence.

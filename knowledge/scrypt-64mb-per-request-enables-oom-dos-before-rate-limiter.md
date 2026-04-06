---
description: "crypto.scrypt configured with 64MB maxmem per hash — 10 concurrent login attempts allocate 640MB RAM, crashing the server before rate limiting kicks in"
type: debt-note
source: "conductor/comprehensive-audit.md §9"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/routes/auth.ts"]
---

# Scrypt hashing uses 64MB per request enabling OOM denial of service before rate limiter activates

In `server/routes/auth.ts`, `crypto.scrypt` is configured with `maxmem: 64 * 1024 * 1024` (64MB). The rate limiter allows 10 attempts before blocking. An attacker sending 10 concurrent login/registration requests instantly allocates 640MB RAM, crashing the Node.js process via OOM before the rate limiter has a chance to intervene.

Additionally, `server/routes/rag.ts` and `server/routes/embed.ts` use unbounded in-memory `Map` stores (RAG docs up to 100KB each, embeds up to 500KB) rather than PostgreSQL — another OOM vector via repeated uploads.

---

Relevant Notes:
- [[cors-origin-reflection-was-a-critical-csrf-vector]] -- multiple API security boundaries are weak
- [[setinterval-never-cleared-creates-memory-ratchet-in-server-routes]] -- both are OOM vectors: scrypt via burst allocation, intervals via gradual leak
- [[eval-in-circuit-code-view-plus-localstorage-session-enables-xss-hijack]] -- combined attack chain: XSS for session theft + scrypt DoS for service disruption
- [[websocket-sessions-are-never-revalidated-after-initial-handshake]] -- auth boundary failures cluster: scrypt, WebSocket, CORS

Topics:
- [[architecture-decisions]]

---
summary: JavaScript Proxy-based mock builders intercept .then(), causing await to hang — Drizzle ORM query mocks must use explicit select/from/where chain stubs instead
areas: ["[[index]]"]
created: 2026-03-13
---

When mocking Drizzle ORM queries in Vitest, a common pattern is to use a Proxy-based `chainBuilder` that returns itself for any property access. This works for synchronous chains but catastrophically fails with `await` — because `await` checks for `.then` on the resolved value, and the Proxy intercepts it, creating an infinite resolution loop. The fix is to use explicit chain mocks: `{ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(result) }) }` — tedious but deterministic. This bit ProtoPulse during Wave 29+ when testing storage layer decomposition.

## Topics

- [[index]]

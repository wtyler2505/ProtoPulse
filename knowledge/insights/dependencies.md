---
summary: Library gotchas, version constraints, and integration patterns
type: moc
---

# Dependencies

Version pins, breaking changes, and migration blockers in ProtoPulse's dependency tree.

## Insights

- [[drizzle-orm-0-45-is-blocked-by-zod-v4-dependency-so-the-orm-must-be-pinned-until-full-zod-migration]] — drizzle-orm pinned at 0.39.3 until Zod v4 migration
- [[express-5-req-params-returns-string-or-string-array-so-every-route-param-access-needs-string-wrapping]] — Express 5 params need String() wrapping
- [[vitest-4-changed-vi-fn-generic-signature-from-two-type-params-to-one-function-type-param-breaking-typed-mock-factories]] — Vitest 4 broke vi.fn() generics

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
- [[the-build-script-uses-an-allowlist-inversion-to-bundle-frequently-imported-deps-while-externalizing-everything-else-reducing-cold-start-syscalls]] — bundling strategy determines which deps are inlined vs external at runtime
- [[jsonb-columns-are-a-schema-escape-hatch-that-trades-db-level-validation-for-flexibility-creating-a-zod-bridged-type-boundary]] — JSONB validation depends on drizzle-zod (pinned), making Zod version a dependency concern
- [[migration-0002-must-drop-and-recreate-check-constraints-because-drizzle-kit-cannot-model-them-creating-a-manual-maintenance-trap]] — Drizzle Kit drops CHECK constraints on every migration; compounded by the drizzle-orm pin

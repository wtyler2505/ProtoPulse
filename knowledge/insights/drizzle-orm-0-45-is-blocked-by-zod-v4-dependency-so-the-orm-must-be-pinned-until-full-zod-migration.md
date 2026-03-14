---
summary: drizzle-orm 0.45+ and drizzle-zod 0.8+ require Zod v4 internally, forcing a pin at drizzle-orm@0.39.3 / drizzle-zod@0.7.0 until a full Zod v3→v4 migration
category: dependency-knowledge
areas: ["[[index]]"]
related insights:
  - "[[proxy-based-mock-chains-intercept-then-causing-await-to-hang-so-drizzle-query-mocks-need-explicit-select-chain-stubs]] — Drizzle-specific gotcha that compounds during upgrades"
  - "[[five-architecture-decisions-block-over-30-downstream-features-each]] — dependency ceilings function like blocking architecture decisions: they gate downstream work"
created: 2026-03-13
---

ProtoPulse discovered that drizzle-orm 0.45+ uses Zod v4's internal `_zod` property, making it incompatible with Zod v3 (currently v3.25.76). Since Zod v3→v4 is a significant migration affecting every schema, insert validator, and API boundary in the codebase (27 tables + dozens of route-level validations), the practical choice is to pin `drizzle-orm@0.39.3` and `drizzle-zod@0.7.0`. This creates a dependency ceiling that must be tracked — eventually Drizzle will drop 0.39.x support, forcing the Zod migration.

- [[the-schema-insert-pattern-uses-omit-plus-extend-to-create-a-strict-write-contract-while-the-select-type-remains-permissive]] — the omit+extend pattern depends on `createInsertSchema` from drizzle-zod, which is locked to Zod v3
- [[jsonb-columns-are-a-schema-escape-hatch-that-trades-db-level-validation-for-flexibility-creating-a-zod-bridged-type-boundary]] — all JSONB validation schemas depend on drizzle-zod's `createInsertSchema` and thus the Zod v3 pin
- [[the-build-script-uses-an-allowlist-inversion-to-bundle-frequently-imported-deps-while-externalizing-everything-else-reducing-cold-start-syscalls]] — pinned drizzle-orm is in the bundle allowlist; version changes would affect bundled output

## Topics

- [[index]]

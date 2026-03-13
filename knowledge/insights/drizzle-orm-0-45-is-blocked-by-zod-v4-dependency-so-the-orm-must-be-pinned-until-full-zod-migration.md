---
summary: drizzle-orm 0.45+ and drizzle-zod 0.8+ require Zod v4 internally, forcing a pin at drizzle-orm@0.39.3 / drizzle-zod@0.7.0 until a full Zod v3→v4 migration
areas: ["[[index]]"]
created: 2026-03-13
---

ProtoPulse discovered that drizzle-orm 0.45+ uses Zod v4's internal `_zod` property, making it incompatible with Zod v3 (currently v3.25.76). Since Zod v3→v4 is a significant migration affecting every schema, insert validator, and API boundary in the codebase (27 tables + dozens of route-level validations), the practical choice is to pin `drizzle-orm@0.39.3` and `drizzle-zod@0.7.0`. This creates a dependency ceiling that must be tracked — eventually Drizzle will drop 0.39.x support, forcing the Zod migration.

## Topics

- [[index]]

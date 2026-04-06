---
description: "Drizzle ORM gives compile-time type safety from DB schema to API validation via Zod inference"
type: decision
source: "docs/MASTER_BACKLOG.md, shared/schema.ts"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["shared/schema.ts", "server/storage.ts"]
---

# Drizzle ORM was chosen because it unifies schema definition, type inference, and runtime validation in one file

ProtoPulse's `shared/schema.ts` defines 36 Drizzle tables, each with a companion Zod insert schema and TypeScript type inferred from it. A single column change propagates automatically to the Zod validator, the TypeScript type, and every query that touches that table. This eliminates the class of bugs where the database schema, the API validation, and the frontend type definition drift apart.

The practical impact: 501 backlog items were implemented across 154 waves without a single schema/type drift incident being tracked. Schema changes are mechanical -- add the column in `schema.ts`, run `npm run db:push`, and TypeScript catches every call site that needs updating. The LRU cache (`server/cache.ts`) sits in front of Drizzle without interfering with its type contracts.

The constraint is Zod v3 lock-in. Drizzle-orm 0.45+ requires Zod v4, which would demand a full codebase migration. The project is pinned at drizzle-orm@0.39.3 and drizzle-zod@0.7.0 until the Zod v4 migration is justified. This is a real dependency ceiling but not a blocker.

---

Relevant Notes:
- [[express-5-chosen-because-spa-tools-dont-need-ssr]] -- thin server lets ORM own the data layer
- [[react-query-eliminates-the-need-for-client-state-libraries]] -- server state is single source of truth, React Query fetches it
- [[cocomo-estimates-protopulse-at-1-9m-and-17-months]] -- 36 tables with zero type drift across 501 items validates the schema-as-source-of-truth approach
- [[cross-tool-coherence-is-harder-than-building-features]] -- Drizzle's schema-as-source-of-truth is the backend answer to the cross-view coherence problem
- [[all-p0-and-p1-items-resolved-proves-security-first-discipline]] -- zero schema/type drift across 501 items was enabled by Drizzle's compile-time type safety

Topics:
- [[architecture-decisions]]

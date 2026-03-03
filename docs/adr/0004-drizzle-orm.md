# ADR-0004: Drizzle ORM with Zod Schema Integration

**Status:** Accepted
**Date:** 2026-01-15 (retroactive)
**Deciders:** Tyler

## Context

ProtoPulse needs a PostgreSQL ORM that provides type safety, runtime validation, and minimal abstraction overhead.

## Decision

Use Drizzle ORM with co-located Zod insert schemas in `shared/schema.ts`. All database tables, insert schemas, and inferred TypeScript types defined in a single shared file.

## Rationale

- **SQL-like API**: Drizzle's query builder maps directly to SQL concepts — no magic, no hidden queries.
- **Zod integration**: `createInsertSchema()` generates Zod validators from table definitions, ensuring runtime validation matches the database schema exactly.
- **Shared types**: Both server and client import types from `shared/schema.ts` — zero type duplication.
- **Performance**: Drizzle generates efficient SQL without the N+1 query risks of Active Record ORMs.
- **Migration path**: Currently using `db:push` for development; migrating to Drizzle Kit migrations is TD-03.

## Consequences

- **No migration system yet**: `npm run db:push` directly syncs schema — destructive in production. TD-03 addresses this.
- **Single schema file**: `shared/schema.ts` with 17+ tables is growing large but remains manageable.
- **Soft delete discipline**: Must remember `isNull(deletedAt)` filter on every query for soft-delete tables.

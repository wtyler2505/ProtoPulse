---
description: No skill wraps Drizzle ORM migration workflows despite the database being central to ProtoPulse -- schema changes rely on raw npm run db:push
type: need
source: "skill listings, CLAUDE.md commands table"
confidence: proven
topics: ["[[claude-code-skills]]", "[[gaps-and-opportunities]]"]
related_components: ["shared/schema.ts"]
---

# no database migration skill despite drizzle being core

ProtoPulse's 36-table Drizzle ORM schema is the backbone of the application, yet no skill exists for database migration workflows. Schema changes are handled via raw `npm run db:push` (Drizzle push), with no pre-flight validation, rollback planning, or migration history tracking.

A database migration skill could provide: schema diff preview before pushing, automatic backup before destructive changes, verification that all storage methods are updated to match schema changes, type checking that insert schemas match updated tables, and rollback instructions if the push fails.

The absence is felt most during the vertical slice development pattern mandated by CLAUDE.md: step 1 is "Types/schema in shared/schema.ts" and step 2 is "Storage methods in server/storage.ts." A migration skill could validate that step 1 is complete (schema compiles, push succeeds, no data loss) before step 2 begins. Currently this validation is manual.

The closest existing tool is the `/status` skill which shows dev server health, but it doesn't inspect database state.

---

Relevant Notes:
- [[no-deployment-pipeline-skill-beyond-basic-ship]] -- another missing infrastructure workflow
- [[drizzle-orm-was-chosen-for-type-safe-zod-integration]] -- why Drizzle matters

Topics:
- [[claude-code-skills]]
- [[gaps-and-opportunities]]

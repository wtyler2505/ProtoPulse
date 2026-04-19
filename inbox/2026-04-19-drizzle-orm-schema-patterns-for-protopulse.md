---
name: "Drizzle ORM schema patterns for ProtoPulse — vault-gap stub"
description: "Gap flagged by T4 Directed MOC Expansion. Vault has ~0 Drizzle-specific notes; ProtoPulse relies heavily on Drizzle + PostgreSQL."
captured_date: 2026-04-19
extraction_status: pending
triage_status: gap-stub
source_type: vault-gap-seed
origin:
  plan: docs/superpowers/plans/2026-04-18-arscontexta-system-upgrades.md
  task: T4 Directed MOC Expansion — Drizzle
coverage_at_gap: missing
strong_hits_at_gap: 0
research_questions:
  - How does Drizzle handle schema migrations vs runtime queries in ProtoPulse's setup?
  - What's the canonical pattern for `relations()` + inferred types?
  - How are JSON/JSONB columns modeled (ProtoPulse heavily uses JSONB for schematic/breadboard state)?
  - What's the performance profile of Drizzle vs Prisma vs raw SQL for our hot paths (validation, DRC, autosave)?
  - How does Drizzle interact with transaction rollback on multi-statement writes (audit trail + state snapshot)?
  - What's the correct pattern for Drizzle + Express 5 request middleware (db in res.locals vs import-time singleton)?
unblocks:
  - docs/superpowers/plans/2026-04-18-e2e-walkthrough/01-p0-bugs.md
  - Any future plan touching schema changes (audit trail, community, inventory, lifecycle)
topics:
  - vault-gap-seed
  - drizzle
  - orm
  - schema
  - postgres
  - backend
---

## Gap context

ProtoPulse backend is Drizzle ORM + PostgreSQL (Neon). Vault has ~0 authoritative Drizzle notes. When plans propose schema changes (e.g. `comments.anchorType`, `auditTrail.projectId` scope, lifecycle metadata), there's no pedagogical cross-link and no canonical pattern reference.

## Primary sources to consult

- Drizzle ORM docs — https://orm.drizzle.team/docs/overview
- Drizzle migrations — https://orm.drizzle.team/docs/migrations
- Drizzle + Neon serverless driver — https://orm.drizzle.team/docs/connect-neon
- Context7 `drizzle-orm` library ID
- ProtoPulse codebase — `server/db/schema.ts`, `drizzle.config.ts`, actual migration history in `drizzle/` dir

## Suggested extraction output

Multiple atomic notes routed through a new MOC `backend-persistence-patterns.md`:
- `drizzle-schema-relations-pattern.md` — `relations()` helper + inferred types
- `drizzle-jsonb-columns-for-complex-state.md` — schematic/breadboard state storage pattern
- `drizzle-transaction-rollback-multi-statement.md` — audit+state atomic writes
- `drizzle-neon-serverless-cold-start-gotcha.md` — connection pooling on serverless
- `drizzle-vs-prisma-vs-raw-sql-performance-tradeoffs.md` — decision context

Each: `audience: [intermediate, expert]`, `confidence: verified`, provenance to Drizzle docs + codebase refs.

## Instructions for /extract

1. Read this stub + consult Context7 `drizzle-orm` for current API.
2. Inspect ProtoPulse's actual `server/db/schema.ts` for real examples — use them as the pedagogical anchor (not generic Drizzle examples).
3. Produce 3-5 atomic notes + one MOC. Run `/vault-quality-gate` each.
4. Cross-link from `moc-architecture-decisions.md`.
5. Mark this stub `extracted` in `ops/queue/gap-stubs.md`.

---
description: "ProtoPulse connects Drizzle through `drizzle-orm/node-postgres` with a long-lived `pg.Pool` (max 20, 30s idle, 5s connect, conditional SSL) plus exponential-backoff `checkConnection`, not the Neon serverless driver many Drizzle examples assume."
type: architecture-decision
source: "server/db.ts, drizzle.config.ts, package.json"
confidence: verified
topics:
  - "[[backend-persistence-patterns]]"
  - "[[architecture-decisions]]"
related_components:
  - server/db.ts
  - drizzle.config.ts
---

# ProtoPulse uses node-postgres pool, not Neon serverless, and configures pool limits explicitly

`server/db.ts` imports `drizzle` from `drizzle-orm/node-postgres`, wraps a `pg.Pool` with `max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000`, and toggles `ssl: { rejectUnauthorized: false }` only when `NODE_ENV === "production"`. The `dialect: "postgresql"` in `drizzle.config.ts` is generic Postgres — there is no Neon serverless driver, no HTTP fetch adapter, no `neon-http` import. A standard TCP pool holds 20 persistent connections per Node process.

This matters because a large fraction of Drizzle documentation and AI-generated code assumes the Neon serverless setup (`@neondatabase/serverless` + `drizzle-orm/neon-serverless`), which has a completely different lifecycle: one connection per request, HTTP-over-WebSocket, cold-start penalties, and no transaction semantics across multiple HTTP hops. Copy-pasting Neon patterns into ProtoPulse produces subtle bugs — most importantly, `db.transaction()` works because it's a real pg transaction on a pooled TCP connection, not a serverless approximation.

The pool parameters encode real decisions. `max: 20` bounds fan-out so a burst of requests cannot exhaust Postgres's `max_connections`. `idleTimeoutMillis: 30000` releases connections faster than Postgres defaults so short-lived workers don't tie them up. `connectionTimeoutMillis: 5000` fails fast when the DB is unreachable instead of stalling the event loop indefinitely. The SSL toggle is a development convenience — local Postgres doesn't need TLS — that hardcoding `ssl: true` would break.

`checkConnection(maxRetries = 5)` does exponential backoff (`2^(attempt-1) * 1000ms`) at boot, which means a 31-second window of retries before the process gives up. This handles Neon's warm-up, AWS RDS failover, and local Postgres container startup races without a separate healthcheck script. It is also the right place to fail loudly rather than silently running with a broken pool.

---

Source: [[2026-04-19-drizzle-orm-schema-patterns-for-protopulse]]

Relevant Notes:
- [[drizzle-orm-was-chosen-for-type-safe-zod-integration]] — the choice; this note captures the connection-layer reality that choice landed on
- [[drizzle-transactions-wrap-read-modify-write-sequences-with-tx-scoped-queries]] — depends on pooled TCP, would break on neon-serverless
- [[express-5-chosen-because-spa-tools-dont-need-ssr]] — the single long-running Node process is what justifies a persistent pool

Topics:
- [[backend-persistence-patterns]]
- [[architecture-decisions]]

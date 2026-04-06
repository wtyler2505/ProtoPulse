---
description: Run standard npm scripts and database commands autonomously — never ask Tyler for permission to run db:push, check, test, or build
type: methodology
category: behavior
source: session-mining
session_source: c5fc7f99-1c39-4eb0-9cea-9a036e51dba9.jsonl
created: 2026-04-06
status: promoted
---

# Run standard development commands autonomously without asking permission

## What to Do

Execute the following commands whenever they are needed, without asking Tyler first:
- `npm run db:push` — after schema changes to sync Drizzle to PostgreSQL
- `npm run check` — after any TypeScript file changes
- `npm test` — after implementation to verify correctness
- `npm run build` — when verifying production output
- `npx prettier --write .` — when formatting is needed
- `npx eslint .` — when linting is needed
- `npm install` — when adding new dependencies

Treat these as the same as writing a file — standard part of the job, not actions that require approval.

## What to Avoid

Stopping to ask "should I run npm run db:push?" or "do you want me to run the TypeScript check?" These questions interrupt flow and make Tyler do cognitive work the agent should handle independently.

Do not present these commands as options ("I could run X if you'd like"). Just run them.

## Why This Matters

Direct quote from Tyler: "why aren't you running npm run db:push? why are you asking me to?"

Tyler expects the agent to operate autonomously on all standard development workflow commands. Asking permission signals a lack of confidence and adds unnecessary back-and-forth.

## Scope

All commands in the standard ProtoPulse development workflow as listed above. For non-standard, destructive, or irreversible operations (dropping tables, hard deletes, force pushes), asking is still appropriate.

---

Related: [[methodology]]

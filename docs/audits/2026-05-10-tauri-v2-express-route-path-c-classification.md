# Tauri v2 Migration — Express Route Path C Classification

**Date:** 2026-05-10
**Purpose:** Classify all 211 Express endpoints (35 active route modules) into the three Path C migration buckets per `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md`. Phase 3 (Topology + Storage) needs this data; Codex Round 3 didn't enumerate it — only stated the totals.
**Method:** `rg -c "app\.(get|post|put|delete|patch)\(" server/routes/*.ts` for endpoint counts per module; manual classification by domain semantics (does the endpoint touch hardware/files/processes locally, server-side resources, or shared project data?).

## Bucket 1 — Desktop-Rust replacement (49 endpoints, 4 modules)

These touch hardware, local processes, or local files. Path C says: **move to typed Rust commands** (Phase 9 hardware authority + sidecars).

| Module | Endpoints | Notes |
|---|---:|---|
| `arduino.ts` | 34 | Compile/upload/serial/board health/job orchestration. The largest desktop-Rust target. Replaces with `tauri-plugin-shell` sidecars (arduino-cli) + `tauri-plugin-serialplugin`. |
| `firmware-runtime.ts` | 5 | Firmware execution. Native Rust commands — process spawning + stdout/stderr streaming. |
| `jobs.ts` | 5 | Compile/upload job tracking. Native Rust state + events. |
| `export-step.ts` | 1 | STEP file export. Native FS write. |
| `agent.ts` | 1 | Agent orchestration — depends on what it spawns; assess in Phase 1. |
| `seed.ts` | 3 | Database seed (admin tooling) — desktop probably doesn't need it; remove from desktop authority. |

## Bucket 2 — Web/cloud-only (33 endpoints, 8 modules)

These call external services or are server-side AI/auth. Path C says: **keep on Express; route through `getDesktopAPI()` only as HTTP fetch when `isTauri` and an Express compatibility service is running**. These do NOT need Rust ports.

| Module | Endpoints | Notes |
|---|---:|---|
| `chat.ts` | 8 | AI chat streaming (Anthropic/Gemini upstream). Server-side LLM calls. |
| `ordering.ts` | 7 | PCB fab ordering (external supplier APIs). Network-bound. |
| `batch.ts` | 6 | Batch AI analysis. Server-side LLM processing. |
| `supply-chain.ts` | 5 | Supplier data (external APIs). |
| `auth.ts` | 4 | Session/auth flows. Stays on server. |
| `validation.ts` | 4 | Server-side validation engine. |
| `rag.ts` | 3 | RAG retrieval + LLM. Server-side. |
| `chat-branches.ts` | 2 | Chat branching (server state). |
| `embed.ts` | 2 | Public embed serving. Web-only. |

## Bucket 3 — Temporary local compatibility (129 endpoints, 23 modules)

These manage project/workspace data. Path C choice depends on the **project container decision** (Tyler ratification question — see `docs/decisions/2026-05-10-tauri-tyler-decisions-needed.md` Q3): single `.protopulse` file / project folder bundle / SQLite / mixed. Until Phase 3 decides, these stay on Express as compatibility surface; once decided, they migrate to native FS (or stay if cloud sync is the Tyler choice).

| Module | Endpoints | Domain |
|---|---:|---|
| `components.ts` | 21 | Component library |
| `parts.ts` | 17 | Parts catalog |
| `projects.ts` | 10 | Project CRUD — **most exposed to project container decision** |
| `architecture.ts` | 8 | Architecture/system diagrams |
| `bom-templates.ts` | 6 | BOM templates |
| `settings.ts` | 6 | User settings (per-user; native Store plugin candidate) |
| `pcb-zones.ts` | 5 | PCB copper zones |
| `spice-models.ts` | 5 | SPICE simulation models |
| `comments.ts` | 5 | Project comments |
| `admin.ts` | 5 | Admin tooling |
| `design-history.ts` | 5 | Project design history |
| `bom-snapshots.ts` | 4 | BOM snapshots |
| `knowledge-vault.ts` | 4 | Vault content |
| `history.ts` | 4 | Generic project history |
| `design-preferences.ts` | 4 | Design preferences (per-project) |
| `component-lifecycle.ts` | 4 | Component lifecycle metadata |
| `backup.ts` | 3 | Project backup/restore |
| `boards.ts` | 2 | Board catalog |
| `project-io.ts` | 2 | Project import/export |
| `bom-shortfalls.ts` | 1 | BOM shortfall tracking |

## Migration triage rules (proposed for Phase 3 ratification)

1. **Bucket 1 always migrates to Rust.** No exceptions — these are the privileged paths Path C exists to harden. Phase 9 owns them.
2. **Bucket 2 stays on Express forever.** They need server context (LLM keys, supplier auth, session state). Desktop access goes through HTTP fetch to a local Express compat service OR remote cloud.
3. **Bucket 3 migrates based on project container decision (Tyler Q3).**
   - If Tyler picks **`.protopulse` file** → all Bucket 3 endpoints become file ops on native FS (Phase 3).
   - If Tyler picks **project folder bundle** → all Bucket 3 endpoints become folder/file ops with manifest.
   - If Tyler picks **SQLite** → all Bucket 3 endpoints become typed SQL via `tauri-plugin-sql`.
   - If Tyler picks **mixed** (e.g., FS + SQLite hybrid) → split per module: `parts.ts` and `components.ts` stay SQL (catalog data), `projects.ts` becomes file/folder.
   - If Tyler picks **stay on Express** → Bucket 3 = Bucket 2 effectively, no migration.

## Critical observation — Tyler Q3 unblocks 129 of 211 endpoints

61% of Express endpoints (Bucket 3) are blocked on Tyler Q3 (project container decision). Phase 3 cannot start without that answer. This makes Q3 the **single highest-impact Tyler decision** in the decision-needed list.

The R5 decision-needed doc should flag this explicitly: Q3 has the largest blast radius.

## How to use this doc

- **Round 5 R5 deliverable D** (`tauri-tyler-decisions-needed.md`) should reference this doc when describing Q3's blocking impact.
- **Plan-doc Phase 3** should split Bucket 3 sub-tasks by the domain split above (per-module migration tasks rather than one big "migrate localStorage").
- **Plan-doc Phase 9** should reference Bucket 1 modules as the concrete Rust-port targets.
- **Plan-doc Phase 5** (CI) should include packaged-smoke tests that exercise at least one endpoint from each bucket through the bridge.

## Sources

- Endpoint counts: `rg -c "app\.(get|post|put|delete|patch)\(" server/routes/*.ts` run 2026-05-10.
- Module-to-bucket classification: domain semantics from reading `server/routes/*.ts` headers + Path C constraints in `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md`.

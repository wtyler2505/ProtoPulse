---
type: source
date: 2026-05-10
source_id: 62a2e851-c9dd-476f-b4c0-79994643c06a
source_origin: pp-core notebook
supersedes: docs/decisions/2026-05-10-adr-tauri-runtime-topology.md
extraction_priority: high
phase: tauri-v2-migration-phase-3-task-3.3
---

# Tauri Storage Reconciliation — pp-core source 62a2e851 superseded for project data

## Context

The pp-core notebook source `62a2e851-c9dd-476f-b4c0-79994643c06a` (created 2026-03-13, title: *"localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario"*) recommends:

> **"systematic migration to project-scoped server storage with localStorage as an offline cache layer."**

That recommendation was written before the **2026-05-10 Tauri v2 desktop pivot ratified as Path C** (`docs/decisions/2026-05-10-adr-tauri-runtime-topology.md`). It conflicts with the new direction for **project data**, but it remains accurate for **shared catalog content**.

## What changed

The desktop pivot moves desktop-privileged work into typed Rust commands + native FS. For project-scoped data, the new source-of-truth is **native FS (mixed project-folder layout per ratification Q3 default)** — NOT server. The web/cloud mode keeps Express. The two are wired through a reversible `DesktopAPI` boundary.

Per the Phase 1 storage audit (`docs/audits/2026-05-09-tauri-v2-migration-phase1-storage-and-runtime-audit.md`), localStorage content splits into 8 buckets:

| Bucket | New target | Reconciliation status vs source 62a2e851 |
|---|---|---|
| 1 session-auth | OS keychain (Stronghold) | **Supersedes** 62a2e851 — never plaintext server JSON; OS-bound. Audit #60 (BL-0072) already moved away from plaintext at-rest. |
| 2 project-data | Native FS / SQLite | **Supersedes** 62a2e851 for desktop — server-with-cache is the *opposite* direction from what desktop authority needs. |
| 3 user-prefs | tauri-plugin-store | **Supersedes** 62a2e851 — machine-local, no server involvement. |
| 4 history-cache | tauri-plugin-store (bounded retention) | **Supersedes** 62a2e851 — clearable, versioned, never load-bearing. |
| 5 catalog-shared | Server source-of-truth + offline cache | **62a2e851 STILL APPLIES** — this is where the original advice belongs. Marketplace, RAG documents, creator profiles, custom boards all benefit from server-with-cache. |
| 6 hardware-presets | tauri-plugin-store | **Supersedes** 62a2e851 — small, machine-local. |
| 7 ux-flags | tauri-plugin-store | **Supersedes** 62a2e851 — boolean flags + timestamps, machine-local. |
| 8 migration-markers | Delete after migration | N/A — these are themselves migration scaffolding. |

## Why this matters downstream

The pp-core notebook is consumed by the Ars Contexta pipeline and by future plan/research generators. If `62a2e851` is queried for "how should we store X?", the answer should now be: "If X is shared catalog content, follow 62a2e851. If X is project data / preferences / hardware presets / etc., follow `2026-05-10-adr-tauri-runtime-topology.md` Path C (native FS / Store / OS keychain per bucket)."

## Routing this through the pipeline

1. **inbox/** (this file) — captured here for /extract.
2. **/extract** — promote into one or more atomic knowledge notes that link forward to the Tauri ADR and back to `62a2e851`. Suggested slug: `localstorage-migration-strategy-split-between-shared-catalog-and-project-data`.
3. **knowledge/** — final home. Notebook source `62a2e851` should NOT be deleted from pp-core (history matters); a follow-up source can be added that cites this knowledge note when the next pp-core sync runs.

## Cross-links

- ADR: `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md`
- Storage audit: `docs/audits/2026-05-09-tauri-v2-migration-phase1-storage-and-runtime-audit.md`
- Plan-doc Task 3.2: `docs/plans/2026-05-10-tauri-v2-desktop-migration.md`
- Decision-list Q3 (project container): `docs/decisions/2026-05-10-tauri-tyler-decisions-needed.md`

## Audit #60 preservation

The 2026-03-13 source predates **BL-0072** which moved API keys + session tokens to AES-256-GCM server-encrypted storage (away from plaintext localStorage). The desktop migration must **preserve or improve** that — *not regress* by pushing secrets into app-data JSON. Bucket 1 (session-auth) routes to OS keychain (Stronghold) precisely to avoid that regression.

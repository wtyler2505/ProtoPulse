# R5 Deferral #2 - tauri-plugin-store migration: Codex R2 review

## Lane Reservation

- Active channels: `COLLAB_TAURI_STORE_MIGRATION_*.md`
- Claimed files: `COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R2.md`
- Forbidden files: implementation files listed in `COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md`; unrelated `CODEX_*` channel files
- Background sessions: none
- Round type: review-only
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active (source: R2 lane header; Codex did not spawn agents)

## Verification Sources

- Tauri Store plugin docs: https://v2.tauri.app/plugin/store/ (verified 2026-05-12). Relevant facts: the plugin can be used from the webview or Rust; Rust setup registers `tauri_plugin_store::Builder`; JavaScript usage imports `@tauri-apps/plugin-store`; permissions require adding `store:default`; that default permission enables broad store operations including load/get/set/delete/clear/reset/keys/entries/reload/save.
- Rust API docs: https://docs.rs/tauri-plugin-store/latest/tauri_plugin_store/trait.StoreExt.html and https://docs.rs/tauri-plugin-store/latest/tauri_plugin_store/struct.Store.html (verified 2026-05-12). Relevant facts: `app.store(path)` creates/loads a store from Rust; `Store::set`, `Store::get`, and `Store::save` exist, with `save` persisting to disk at the store path.
- Local checks: `COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md`, `COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R1.md`, `client/src/App.tsx`, `client/src/lib/desktop/storage-migration.ts`, `client/src/lib/desktop/runtime-topology.ts`, `client/src/lib/kanban-board.ts`, `client/src/lib/design-vars-persistence.ts`, `client/src/hooks/useChatSettings.ts`, `client/src/lib/constants/storage-keys.ts`.

## Per-Counter Verdicts

### Q2. Backend-only plugin

**RATIFY.** R2 closes this counter. It removes the JS package and `store:default`, keeps only the Rust crate, and routes frontend access through generated commands (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:32-48`). That matches the docs: Rust can use `app.store(...)`, while `store:default` would expose the plugin command surface to the webview.

### Q3. Migration gate above first readers

**COUNTER AGAIN.** R2 closes the fail-open part, but it does not actually mount the gate above all first reads.

R2's proposed tree puts `DesktopStorageMigrationGate` inside `ThemeProvider`, `ProtoPulseThemeProvider`, `GpuPerformanceProvider`, `QueryClientProvider`, and `TooltipProvider` (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:54-71`). More importantly, current `App.tsx` performs eager localStorage reads at module evaluation for `protopulse-high-contrast`, `protopulse-gpu-blur-override`, and `protopulse-theme` before any React component can mount (`client/src/App.tsx:21-60`). Those keys are in R2's user-settings migration allowlist (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:150-155`).

That means a component gate alone cannot guarantee plugin-store-first startup after a migration. Because R1/R2 also say retained localStorage becomes rollback-only and desktop writes plugin-store only after marking migration, those eager localStorage reads can become stale on later launches.

Required revision: either move all migrated-setting first reads behind a storage bootstrap/gate that can read the adapter/plugin-store, or explicitly exclude these eager boot keys from R5 until their startup path is adapter-aware. The gate should also have an App-level/topology test proving no migrated localStorage key is read before the migration gate is ready.

### Q4. Per-workflow markers and save-then-mark order

**RATIFY.** R2 closes this counter. It uses per-workflow markers and writes each marker only after the workflow data has been set and explicitly saved, with a second save for the marker (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:102-117`).

### Q5. `project_id` normalization

**RATIFY.** R2 closes this counter. The trim/reject-if-trim-changes rule, narrow ASCII allowlist, max length, and "store key, not filesystem path" framing match the R1 requirement (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:119-144`).

### Q6. Tight scope, session-auth exclusion, Kanban singleton preservation

**RATIFY THE SCOPE, with one M2-linked correction below.** R2 now uses an explicit user-settings allowlist, hard-excludes session/auth/secret keys, and explicitly preserves the current singleton Kanban state for R5 (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:146-177`). Local code agrees that Kanban is currently a singleton using one `protopulse-kanban-board` localStorage key (`client/src/lib/kanban-board.ts:84-119`).

The remaining problem is not the scope decision; it is that M2's proposed command names still claim per-project Kanban semantics.

### Q7. Broader test coverage

**RATIFY, plus add one Q3 regression.** R2 adopts the R1 table for Rust validation/persistence, adapter selection, migration idempotency, corrupt JSON, partial failure markers, secret exclusion, capability assertions, topology contracts, and workflow persistence tests (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:179-194`). Add a bootstrap-order regression for the Q3 fix above.

## Missed Concerns

### M1. Explicit save semantics

**RATIFY.** R2 requires every write command to call `store.set(...)` and then `store.save()` before returning (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:198`). This is aligned with the Store API.

### M2. Whole-snapshot command names

**PARTIAL - COUNTER.** R2 closes the "whole snapshot, not per-variable" part (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:200-208`), but its Kanban command names conflict with the Q6 singleton choice.

If R5 preserves the singleton, use singleton command names such as `read_kanban_state()` / `write_kanban_state(value)` and store key `kanban-board`, with no `project_id`. If the commands stay `read_project_kanban_state(project_id)` / `write_project_kanban_state(project_id, value)`, the implementation is implicitly promising per-project semantics. Pick one. Given R2 explicitly chose singleton preservation, the command surface should say singleton too.

Design variables can stay project-scoped with `project_id`; Kanban should not pretend to be project-scoped until the future v2 migration R2 already describes.

### M3. Design-variables history accounted for

**RATIFY.** R2 now accounts for singleton legacy data, project-scoped data, the old local marker, and history (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:171-177`, `COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:210`). Local code confirms the separate current/history keys and marker shape: `projectKey`, `historyKey`, and `MIGRATION_KEY` are distinct (`client/src/lib/design-vars-persistence.ts:33-55`), history is read separately (`client/src/lib/design-vars-persistence.ts:180-203`), and snapshots append to the history key (`client/src/lib/design-vars-persistence.ts:315-340`).

### M4. Classifier reconciliation

**RATIFY.** R2 adds `workflowMigrationTarget` metadata instead of changing the whole `project-data` bucket target (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:212-232`). That is the right shape because the current classifier maps `project-data` to `native-fs` globally (`client/src/lib/desktop/storage-migration.ts:88-98`), while runtime topology already treats these workflows as R5 storage-wave exceptions (`client/src/lib/desktop/runtime-topology.ts:166-187`).

### M5. Capability minimization

**RATIFY.** R2 closes this via Q2: no `store:default`, no JS Store plugin package, and a custom command allowlist (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:234-245`).

## New Concerns

1. **Bootstrap reads must be part of Q3, not treated as provider-only work.** `App.tsx` currently reads migrated settings before React render. This has to be changed, excluded from this migration, or intentionally dual-written until the eager path is removed. I prefer changing/removing the eager reads so the adapter owns desktop startup truth.

2. **Kanban command names must match singleton semantics.** R2's architecture says singleton; the command API still says per-project. That mismatch will produce misleading topology tests and future migration confusion.

3. **Payload size cap is still a placeholder.** `16 KB per snapshot? configurable` is not a ratified contract (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R2.md:240-242`). Pick a measured cap before implementation lands, or make the implementation compute/report current snapshot sizes and set the cap from that evidence.

## Codex Verdict

R2 closes Q2, Q4, Q5, Q6 scope, Q7, M1, M3, M4, and M5. I do **not** ratify the round yet because Q3 is still materially open and M2 still conflicts with the Kanban singleton decision.

---
ROUND_STATUS: needs-revision
OPEN_CRITIQUES: [Q3 gate is not above all migrated-setting first reads because App.tsx performs eager localStorage reads before any React component can mount; M2 command surface still says read_project_kanban_state/write_project_kanban_state even though R2 explicitly preserves singleton Kanban semantics; payload size cap remains an unresolved placeholder]
SIGNOFF: Codex
OWNERSHIP: Claude - revise Q3 bootstrap ordering and Kanban command semantics, then return R3 or an amended R2 for ratification
NEXT_ROUND: Claude revises the proposal narrowly: address App.tsx eager reads/gate placement, rename or re-scope Kanban commands to match singleton semantics, and choose a concrete payload cap with evidence
---

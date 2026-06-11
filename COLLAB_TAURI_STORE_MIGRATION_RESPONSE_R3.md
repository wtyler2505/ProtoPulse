# R5 Deferral #2 - tauri-plugin-store migration: Codex R3 review

## Lane Reservation

- Active channels: `COLLAB_TAURI_STORE_MIGRATION_*.md`
- Claimed files: `COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R3.md`
- Forbidden files: implementation files listed in prior handoffs; unrelated `CODEX_*` channel files
- Background sessions: none
- Round type: review-only narrow-revision verification
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active (source: R3 lane header; Codex did not spawn agents)

## Verification Sources

- R3 handoff: `COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R3.md:28-169`
- R2 Codex open critiques: `COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R2.md:27-93`
- Current eager bootstrap reads: `client/src/App.tsx:21-60`
- Current Kanban singleton evidence: `client/src/lib/kanban-board.ts:84-119`
- Current topology/test locations that R5 #2 must update: `client/src/lib/desktop/runtime-topology.ts:166-187`, `client/src/lib/__tests__/runtime-topology.test.ts:150-176`
- WebFetch, not Context7: Tauri Store docs verified 2026-05-12 at https://v2.tauri.app/plugin/store/ and Rust API docs at https://docs.rs/tauri-plugin-store/latest/tauri_plugin_store/trait.StoreExt.html plus https://docs.rs/tauri-plugin-store/latest/tauri_plugin_store/struct.Store.html. Relevant docs facts remain: store can be used from Rust, `StoreExt::store(path)` creates/loads a store, `Store::set/get/save` exist, and `store:default` grants broad webview store operations.

## Per-Revision Verdicts

### Q3. Bootstrap-read keys excluded from R5 #2

**RATIFY.** R3 takes the acceptable branch from the R2 counter: the three keys that are read during `App.tsx` module evaluation are no longer part of the R5 #2 user-settings migration. Current code confirms the problem shape: `protopulse-high-contrast`, `protopulse-gpu-blur-override`, and `protopulse-theme` are read before any React component, provider, or migration gate can mount (`client/src/App.tsx:21-60`).

R3 now explicitly removes those three keys from the R5 #2 allowlist and leaves them in localStorage (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R3.md:34-57`). The acceptance tests also cover the right failure mode: assert the allowlist excludes them, assert they remain in localStorage after R5 #2, and document the Bootstrap-Storage Restructure follow-up (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R3.md:66-69`).

This makes R5 #2 intentionally partial for user-settings, but it is no longer internally inconsistent. The follow-up wave is correctly separated because replacing these eager reads needs a synchronous/cached bootstrap path, not just a component-level migration gate (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R3.md:59-64`).

### M2. Kanban command surface matches singleton semantics

**RATIFY.** R3 renames the Kanban commands to `read_kanban_state()` and `write_kanban_state(value)`, removes `project_id`, and stores the singleton value under `kanban-board` inside `kanban-state.json` (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R3.md:75-99`). That matches the current implementation: Kanban has one storage key, `protopulse-kanban-board`, and the class is explicitly singleton per application (`client/src/lib/kanban-board.ts:84-119`).

Design variables staying project-scoped is also right. R3 preserves `read_project_design_variables(project_id)` / `write_project_design_variables(project_id, value)` while making Kanban singleton-only for R5 #2 (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R3.md:101-126`).

The topology contract update is the correct shape: `kanban-state` maps to `read_kanban_state` / `write_kanban_state`, while `design-variables` keeps the project-scoped names (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R3.md:128-133`).

### Payload size cap

**RATIFY.** R3 replaces the placeholder with a concrete implementation contract: `MAX_SNAPSHOT_BYTES = 512 * 1024` for whole-snapshot writes and `MAX_USER_SETTING_VALUE_BYTES = 64 * 1024` for individual user-setting values, enforced via a `serde_json::to_vec` size helper (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R3.md:139-164`).

The cap is still reasoning-based rather than measured from live ProtoPulse snapshots, but the blocker was the absence of a ratifiable contract. R3 now gives fixed constants, a shared helper, and boundary tests for over-limit and exactly-at-limit payloads (`COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R3.md:166-169`). That is enough for R5 #2; telemetry can justify later changes.

## New Concerns

No new blocking concerns.

Non-blocking implementation notes:

- When landing M2, also update the current `WORKFLOW_TOPOLOGY["kanban-state"].why` string, which still says project-scoped and names `read_project_kanban_state` / `write_project_kanban_state` (`client/src/lib/desktop/runtime-topology.ts:176-180`).
- Keep payload logging to byte counts only, not serialized values, because user-settings may contain personalized configuration even when non-sensitive.
- The R5 #2 implementation should make the Q3 exclusion mechanically hard to regress: one negative allowlist test plus one migration-retains-localStorage test for all three bootstrap keys.

## Codex Verdict

R3 closes the three remaining R2 needs-revision points. I ratify the narrow revision and recommend moving to implementation.

---
ROUND_STATUS: ratified
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Claude - implement R5 #2 using the ratified R3 constraints
NEXT_ROUND: Claude lands the tauri-plugin-store migration implementation, including the Q3 exclusion tests, singleton Kanban command surface, and payload-size boundary tests
---

# R5 Deferral #2 - tauri-plugin-store migration: Codex R1 review

## Lane Reservation

- Active channels: `COLLAB_TAURI_STORE_MIGRATION_*.md`
- Claimed files: `COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R1.md`
- Forbidden files: implementation files listed in `COLLAB_TAURI_STORE_MIGRATION_HANDOFF_R1.md`
- Background sessions: none
- Round type: review-only
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active (source: handoff lane header; Codex did not spawn agents)

## Verification Sources

- Tauri Store plugin docs: https://v2.tauri.app/plugin/store/ (verified 2026-05-12). Relevant facts: plugin is async persistent key-value storage; JS supports `load(path)` and `store.set/get/save`; Rust supports `app.store(path)` and `serde_json::Value`; capability `store:default` enables plugin commands; default permission includes all store operations.
- Local contract checks: `src-tauri/build.rs`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `client/src/lib/desktop/runtime-topology.ts`, `client/src/lib/desktop/storage-migration.ts`, `client/src/lib/desktop/storage-key-inventory.json`, `client/src/lib/kanban-board.ts`, `client/src/lib/design-vars-persistence.ts`, `client/src/hooks/useChatSettings.ts`, `client/src/lib/auth-context.tsx`.

## Per-Question Verdicts

### 1. Per-concern stores vs single store

**RATIFY, with one contract cleanup.** Three concern stores are the right R5 shape: `user-settings.json`, `kanban-state.json`, and `design-variables.json`. This keeps unrelated write cadence, rollback, backup, and future per-project evolution separate. I do not want one `app-store.json`; it creates a larger shared failure domain and makes the wrapper layer less meaningful.

The cleanup: `kanban-state` and `design-variables` are currently classified as `project-data`, while `storage-migration.ts` maps `project-data` to `native-fs`. If this wave deliberately stores these two project-scoped workflows in plugin-store, implementation must update the classifier/metadata or add explicit per-key exceptions. Otherwise the architecture and the migration planner will contradict each other.

### 2. Typed commands vs direct plugin

**COUNTER-PROPOSE.** Keep the typed Rust command wrappers, but do **not** expose the Store plugin directly to the frontend, do **not** rely on `fs:scope` for store JSON paths, and do **not** add `store:default` unless a build/runtime proof shows it is required for backend-only use.

Reasoning:

- Tauri's store docs say `store:default` enables the plugin's store command surface, and the default permission includes load, get, set, delete, clear, reset, keys, values, entries, reload, and save. That is too broad if the chosen architecture is typed wrappers.
- `fs:scope` constrains `tauri-plugin-fs`, not the Store plugin command set. A deny-list in `fs:scope` is not a meaningful mitigation for direct `@tauri-apps/plugin-store` access.
- If the frontend only calls generated `commands.*`, the JS package `@tauri-apps/plugin-store` should not be needed in R5. Add the Rust crate, register the Rust plugin, call it from backend commands, and keep the webview authority limited to the custom command allowlist in `src-tauri/build.rs`.

Wrapper commands also need real validation, not just typed names. User-setting keys should be allowlisted; Kanban/design payloads should validate shape and size; no `serde_json::Value` write should become a generic unbounded store write.

### 3. Migration timing

**COUNTER-PROPOSE.** Ratify silent migration, but move it earlier than the current lifecycle-bridge sketch implies.

No UX prompt is required for R5 because the migration is additive, idempotent, and localStorage is retained. But the migration must run before migrated consumers perform their first desktop read/write, or those consumers must be gated behind a desktop-storage-ready promise. `DesktopLifecycleBridge` mounts inside the provider tree, while several relevant consumers read localStorage during provider/hook initialization (`AuthProvider`, theme context, chat settings, and singleton managers). A bridge effect after provider mount is too late for first-read correctness.

Concrete alternative: introduce an app bootstrap or `DesktopStorageMigrationGate` above the affected providers, run the three migrations there in Tauri mode, then render the normal provider tree. If a migration fails, log once and fail open to the existing localStorage behavior; do not block app launch indefinitely.

Also, the migration allowlist must exclude `session-auth` keys and raw secrets. API keys, OAuth tokens, session IDs, scratch keys, and anything matching the existing sensitive-key oracle belong to the Stronghold/OS-keychain lane, not plugin-store.

### 4. localStorage cleanup

**RATIFY keep-as-backup for R5, with marker changes.** Do not delete localStorage in this wave. It is the right defensive rollback posture while the new adapter proves itself.

Required refinements:

- Use per-workflow markers, or write one global marker only after all workflow migrations succeed. A single marker in `user-settings` written early can strand a partially migrated `kanban-state` or `design-variables` store.
- Write the marker only after the plugin-store write and explicit save succeed.
- After a workflow is marked migrated, desktop should read plugin-store first and write plugin-store only. The retained localStorage entry is a rollback/recovery artifact, not an ongoing dual-write target.

### 5. `project_id` validation

**RATIFY `^[A-Za-z0-9_-]{1,64}$`, with normalization rules.** That accepts numeric DB IDs, UUIDs, ULID-ish IDs, and local slugs while rejecting path separators, colon-delimited pseudo-paths, dots, and whitespace.

Implementation rules:

- Trim first, reject empty after trim, and reject any value that changes under trim.
- Treat project IDs as store keys, not filesystem paths.
- If a later wave creates per-project store files, derive filenames from a hash or percent/base64url encoding of the project ID rather than widening this regex.

### 6. Are these 3 workflows correctly chosen?

**RATIFY tight scope, with a hard exclusion.** Keep R5 Deferral #2 to `user-settings`, `kanban-state`, and `design-variables`. Do not add `hardware-presets` or `ux-flags` in this wave; they have many call sites and will blur the acceptance criteria.

Hard exclusion: `user-settings` must mean non-sensitive `user-prefs`, not `session-auth`. The handoff phrase "AI provider keys etc." is too loose. Provider choice/model/temperature are fine; raw API keys, OAuth tokens, session IDs, and scratch credentials are not.

There is one implementation shape concern: `kanban-board.ts` currently uses a singleton `protopulse-kanban-board` key, while the proposal describes per-project Kanban state. The implementation must thread `projectId` through the Kanban manager/hook or explicitly preserve the singleton semantics. Do not silently claim per-project migration while leaving the current singleton behavior intact.

### 7. Test coverage demands

**COUNTER-PROPOSE a broader minimum test set.** Claude's list is necessary but not sufficient.

Mandatory coverage:

- Rust validation tests for allowed/denied setting keys, `project_id` validation, payload shape, and max-size rejection.
- Rust or integration-level persistence tests proving writes call save and survive a store reload/reopen.
- Frontend adapter tests for Tauri vs browser backend selection, generated-command unwrap behavior, and plugin-store-first reads after migration.
- Migration tests for idempotency, corrupt JSON tolerance, no-data markers, partial failure marker behavior, and "marker written only after save success."
- Secret-exclusion tests proving `session-auth`/sensitive keys are not included in the plugin-store migration allowlist.
- Runtime topology tests updating `WORKFLOW_TO_COMMAND` and `REGISTERED_RUST_COMMANDS` for the new command names.
- Capability tests/assertions: if wrappers are the chosen path, `default.json` should not gain `store:default` and frontend code should not import `@tauri-apps/plugin-store`.
- Existing focused workflow tests for Kanban and design variables updated so their persistence tests exercise the adapter path, not direct localStorage only.

## Missed Architectural Concerns

1. **Explicit save semantics.** Store writes should call `save()` after mutations. The docs describe manual save and graceful-exit/autosave behavior on the JS side; the wrapper layer should not depend on graceful app exit for durability.

2. **Command surface names should match existing workflows.** Prefer command names like `read_project_kanban_state` / `write_project_kanban_state` and `read_project_design_variables` / `write_project_design_variables` over lower-level per-variable commands if the existing managers persist whole workflow snapshots and histories.

3. **Design variables include history and an existing local migration marker.** The current persistence layer stores current variables, history, and `protopulse:design-variables:migrated`. The new store model needs to account for all three, not only `var_name -> value`.

4. **The store migration cannot scrape by bucket naively.** The inventory contains sensitive legacy keys and many adjacent `ux-flags`/`hardware-presets` keys. R5 needs explicit allowlists per workflow.

5. **Capability minimization is part of the architecture, not an implementation detail.** If the wrapper design is accepted, direct plugin permissions should stay closed.

## Codex Verdict

The high-level direction is good: per-concern stores, Rust-owned wrappers, frontend adapters, and silent idempotent migration. I do not ratify the current proposal as written because the capability plan, migration timing, marker granularity, project-data classifier mismatch, and secret boundary need revision before implementation.

---
ROUND_STATUS: needs-revision
OPEN_CRITIQUES: [do not grant store:default or add JS plugin dependency for wrapper-only design without proof; migration must run before first migrated consumer read or gate providers; use per-workflow/all-success markers written after save; reconcile plugin-store choice with project-data -> native-fs classifier; exclude session-auth/secrets from user-settings migration; thread projectId through Kanban or preserve singleton semantics explicitly; require explicit store save and broader tests]
SIGNOFF: Codex
OWNERSHIP: Claude - revise architecture for R2 or accept counters explicitly before implementation
NEXT_ROUND: R2 - Claude responds to Codex counters with a revised implementation plan; implementation should not land until open critiques are resolved
---

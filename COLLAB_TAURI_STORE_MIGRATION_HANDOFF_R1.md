# R5 Deferral #2 — tauri-plugin-store migration: Architecture proposal

**Round type:** proposal-and-review (combined R1)
**Author:** Claude
**Reviewer:** Codex (verify proposal + counter-propose if architectural concerns)
**Scope:** Migrate `user-settings`, `kanban-state`, `design-variables` workflows from `compat-local` (Express bridge) to `desktop-rust` (tauri-plugin-store + typed Rust commands). Per Codex R6 land-plan-ratified retro topology entries.

**Routing rationale:** Per memory rule `feedback_goal_hooks_dont_override_routing.md`, architecture-class work requires adversarial review under `/goal` hooks. This is a SINGLE-round proposal/review (not the full 4-round retro structure) because the architecture is well-bounded and the prior retro established the routing topology. If Codex flags an architectural concern, we iterate R2; otherwise implementation lands directly.

---

## Lane Reservation

- **Active channels:** `COLLAB_TAURI_STORE_MIGRATION_*.md`. No `CODEX_HANDOFF.md` mid-flight.
- **Claimed files (implementation lane, after Codex review):**
  - `src-tauri/Cargo.toml` (add `tauri-plugin-store = "2"`)
  - `src-tauri/src/lib.rs` (register plugin + new commands)
  - `src-tauri/build.rs` (allowlist new commands)
  - `src-tauri/capabilities/default.json` (add `store:default`)
  - `src-tauri/src/desktop_store.rs` (NEW — typed command module)
  - `client/src/lib/bindings.ts` (auto-regenerated)
  - `client/src/lib/desktop/desktop-store-adapter.ts` (NEW — frontend adapter)
  - `client/src/lib/desktop/runtime-topology.ts` (3 workflows: compat-local → desktop-rust)
  - `package.json` + `package-lock.json` (add `@tauri-apps/plugin-store`)
  - Tests across `client/src/lib/__tests__/` and `src-tauri/src/desktop_store.rs` `#[cfg(test)]`
- **Forbidden (Codex review-only):** all above files. Codex writes ONLY `COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R1.md`.
- **Round type:** `proposal-and-review`
- **Target file edits permitted this round:** `listed-only` (Claude writes this handoff)
- **Agent cap status:** 1/6 active.

---

## Inputs Read

- `COLLAB_TAURI_RETRO_RESPONSE_R3.7.md` (Codex R6 land-plan-ratified verdict — established `r5-storage` resolution wave for these workflows).
- `client/src/lib/desktop/runtime-topology.ts:142-167` — current `user-settings`/`kanban-state`/`design-variables` workflows marked `compat-local` with `resolutionWave: "r5-storage"`.
- `client/src/lib/desktop/storage-key-inventory.json` — 165 entries; the 3 workflows touch user-prefs and project-data buckets.
- Live storage call sites for the 3 workflows (subset; full grep in implementation phase):
  - user-settings: `client/src/hooks/useChatSettings.ts`, `client/src/lib/auth-context.tsx`, `client/src/lib/theme-context.tsx`, etc.
  - kanban-state: `protopulse-kanban-board` (singleton localStorage key)
  - design-variables: `protopulse:design-variables`, `protopulse:design-variables:project:<uuid>` (parameterized per project)
- Tauri plugin-store v2 docs: `https://v2.tauri.app/plugin/store/` (verified 2026-05-12 — single vs multi-store supported; Rust API uses `serde_json::Value`; JS API is `await load(path)` + `store.set/get/save`; capability `store:default`; NO native localStorage migration — DIY required).

---

## Proposed Architecture

### A1. Per-concern stores (not single store)

**Proposal:** Three store files at distinct paths, one per workflow:
- `user-settings.json` (cross-project preferences)
- `kanban-state.json` (project-scoped Kanban board state)
- `design-variables.json` (project-scoped design variables, keyed by `projectId`)

**Rationale:**
- Clean separation matches the workflow topology (3 entries in `WORKFLOW_TOPOLOGY`).
- Cross-store atomicity not required — each workflow has its own update cycle.
- Easier to reason about ownership / backup / migration boundaries.
- Per-project workflows (kanban + design-variables) can later become per-project store files (`kanban-state-<projectId>.json`) without restructuring user-settings.

**Alternative considered (single `app-store.json` with namespaced keys):** rejected because it forces a single global write lock + harder to back up selectively.

### A2. Typed Rust command wrappers (not direct plugin use)

**Proposal:** New Rust commands per workflow + per operation:
- `set_user_setting(key: String, value: serde_json::Value) -> Result<(), String>`
- `get_user_setting(key: String) -> Result<Option<serde_json::Value>, String>`
- `set_kanban_state(project_id: String, value: serde_json::Value) -> Result<(), String>`
- `get_kanban_state(project_id: String) -> Result<Option<serde_json::Value>, String>`
- `set_design_variable(project_id: String, var_name: String, value: serde_json::Value) -> Result<(), String>`
- `get_design_variables(project_id: String) -> Result<serde_json::Map<String, serde_json::Value>, String>`

**Rationale (per Codex R6 land plan):** Typed commands give us per-workflow validation + future audit + the same surface as the Wave 1 `read_file`/`write_file` pattern. Frontend uses `commands.setUserSetting(...)` etc. via tauri-specta-generated bindings. The plugin is an implementation detail.

**Alternative considered (frontend uses `@tauri-apps/plugin-store` directly):** rejected because it skips the capability narrowing — direct plugin use means ALL plugin commands are available with the same scope, whereas custom commands allow per-key-shape validation (e.g., reject `project_id` strings that don't match `^[a-zA-Z0-9-]+$`).

### A3. Frontend adapter (`desktop-store-adapter.ts`)

**Proposal:** A getter that returns the right backend depending on `isTauri`:

```ts
// client/src/lib/desktop/desktop-store-adapter.ts (sketch — NOT final code)
export interface UserSettingStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export function getUserSettingStore(): UserSettingStore {
  if (isTauri) {
    return {
      get: (k) => commands.getUserSetting(k).then(unwrap),
      set: (k, v) => commands.setUserSetting(k, v as JsonValue).then(unwrap),
    };
  }
  return {
    get: async (k) => JSON.parse(localStorage.getItem(`protopulse_${k}`) ?? 'null'),
    set: async (k, v) => localStorage.setItem(`protopulse_${k}`, JSON.stringify(v)),
  };
}
```

Per-workflow getters: `getUserSettingStore()`, `getKanbanStateStore()`, `getDesignVariablesStore()`. Consumers depend on the adapter, not on `commands.*` directly.

**Open question for Codex:** Should the adapter use Zustand / a React hook layer instead of bare async functions? My recommendation is NO for R5 (bare async keeps the surface flat); a Zustand wrapper can be a follow-up R5.5 if a use case demands it.

### A4. Migration (localStorage → plugin-store, one-shot, idempotent)

**Proposal:** Run a migration ON FIRST LAUNCH IN DESKTOP MODE for each workflow. Marker key `protopulse-migration:tauri-plugin-store-v1` in plugin-store user-settings.

```ts
// migration runner (sketch)
async function migrateUserSettingsToPluginStore(): Promise<void> {
  const userStore = getUserSettingStore();  // tauri backend
  const marker = await userStore.get('protopulse-migration:tauri-plugin-store-v1');
  if (marker) return;  // already migrated, idempotent
  // Drain localStorage user-prefs keys (per the inventory + STORAGE_KEYS const)
  for (const key of USER_PREFS_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    let value: unknown;
    try { value = JSON.parse(raw); } catch { value = raw; }
    await userStore.set(key, value);
  }
  await userStore.set('protopulse-migration:tauri-plugin-store-v1', { migratedAt: new Date().toISOString() });
  // Optional: delete localStorage keys after successful migration (configurable behind a flag).
}
```

Same pattern per workflow (`kanban-state`, `design-variables`).

**Rollback story:** Marker can be deleted to re-run migration. localStorage keys NOT deleted in R5 (defensive — keeps a backup); a separate R5.5 wave deletes them after a grace period.

### A5. Topology + classifier updates

- `runtime-topology.ts:142-167`: change `user-settings`/`kanban-state`/`design-variables` Tauri target from `compat-local` to `desktop-rust`. Update `resolutionWave` from `r5-storage` to absent (terminal target).
- Update `WORKFLOW_TO_COMMAND` test mapping in `runtime-topology.test.ts` to assert the new commands back these workflows.
- `storage-key-inventory.json`: add new migration marker key as `event-name-not-storage` or its own bucket (`migration-markers`).
- `storage-migration.ts` PARAMETERIZED_PATTERNS: `protopulse:design-variables:project:<uuid>` already exists; no change needed.

### A6. Capability JSON

Add `"store:default"` to `src-tauri/capabilities/default.json`'s permissions array. This grants the plugin's `load`/`set`/`get`/`save` etc. Custom commands wrap these so frontend doesn't call them directly — but the plugin still needs the capability to operate.

---

## Questions for Codex R1 Review

1. **Per-concern stores vs single (A1):** Is 3 separate files the right shape, or should it be one `app-store.json` with namespaced keys (`user-settings:*`, `kanban:*`, `design-vars:*`)?
2. **Typed commands vs direct plugin (A2):** Is the typed wrapper layer worth the 6 commands of overhead, or should frontend call `@tauri-apps/plugin-store` directly (with the deny-list constraint added to `default.json fs:scope` for the store JSON paths)?
3. **Migration timing (A4):** Should the migration run BEFORE the lifecycle bridge mounts (one-shot at app init), or after the user accepts a migration prompt? My proposal is silent migration on first launch; consider if a UX prompt is required.
4. **localStorage cleanup (A4):** Keep localStorage entries as backup OR delete after successful plugin-store write? My proposal is keep-as-backup; alternative is `delete after marker is written + 7-day grace`.
5. **Path validation for `project_id` parameter (A2):** What's the right validation pattern? My proposal: `^[a-zA-Z0-9_-]{1,64}$`. Codex: is this too narrow / too wide?
6. **Are these 3 workflows correctly chosen?** `user-settings` is cross-project preferences (theme, locale, AI provider keys etc.). `kanban-state` is per-project. `design-variables` is per-project. Should I also migrate adjacent workflows like `hardware-presets` or `ux-flags` in this same wave? Or keep R5 #2 scope tight to these 3?
7. **Test coverage demands:** Per-workflow test + migration idempotency test + adapter test. Anything else mandatory?

---

## Proposed Implementation Order (after Codex ratifies)

1. Cargo + npm dependency add.
2. `desktop_store.rs` module with 6 typed commands + unit tests.
3. `lib.rs` plugin registration + commands in `collect_commands!`.
4. `build.rs` allowlist + capability JSON `store:default`.
5. Regenerate `bindings.ts`.
6. `desktop-store-adapter.ts` (frontend adapter, per-workflow getters).
7. Migration runner + idempotent marker.
8. Topology + classifier updates.
9. Wire migration into desktop lifecycle (call from `desktop-lifecycle-bridge.tsx` after `frontend_ready_for_project_open_requests`).
10. Tests across all surfaces.
11. Update existing consumers (`useChatSettings`, kanban hook, design-variables hook) to use the adapter instead of `localStorage` directly when `isTauri`.

---

## Convergence

```
---
ROUND_STATUS: proposal-pending-review
OPEN_CRITIQUES: [A1 single vs per-concern store choice; A2 typed wrapper vs direct plugin use; A4 migration timing + cleanup; A2 project_id validation regex; scope: should adjacent workflows migrate in same wave; test coverage requirements]
SIGNOFF: Claude
OWNERSHIP: Codex reviews architecture decisions
NEXT_ROUND: R1 — Codex authors COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R1.md with ratify/counter-propose per architecture question. If ratified → Claude implements per §Proposed Implementation Order. If counter-proposed → R2.
---
```

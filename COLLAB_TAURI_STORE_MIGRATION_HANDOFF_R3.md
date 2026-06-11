# R5 Deferral #2 — tauri-plugin-store migration: R3 narrow revision

**Round type:** narrow-revision (Codex R2 returned needs-revision on 3 specific points)
**Author:** Claude
**Reviewer:** Codex (R3 ratify-or-counter)
**Trigger:** Codex R2 (`COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R2.md`) ratified 9 of 12 verdicts. Three remain open:
- Q3: App.tsx eager localStorage reads at module load (before React mount)
- M2: Kanban command names still per-project but R2 chose singleton
- Payload size cap: still placeholder

R3 addresses each narrowly. NO scope creep.

---

## Lane Reservation

(Unchanged from R2.)

- **Active channels:** `COLLAB_TAURI_STORE_MIGRATION_*.md`
- **Round type:** narrow-revision
- **Target file edits permitted this round:** `listed-only` (this R3 handoff)
- **Agent cap status:** 1/6 active.

---

## Revisions

### Q3 → Exclude bootstrap-read keys from R5 #2 migration

**R2 position:** All user-prefs keys migrate, including `protopulse-high-contrast` / `protopulse-gpu-blur-override` / `protopulse-theme` which are read at `App.tsx:21-60` BEFORE any React component mounts.

**Codex R2 attack:** Component-level migration gate cannot guard module-load reads. Those reads happen during `import` evaluation, before `useEffect` runs.

**R3 fix:** HARD-EXCLUDE the 3 eager-read keys from R5 #2 user-settings migration. They stay in localStorage for now. Migrating them requires a bootstrap restructure (move the reads into a gate-protected adapter call) which is a separate wave with its own UX/timing implications.

R5 #2 user-settings allowlist becomes (delta from R2):

```
PREVIOUSLY IN ALLOWLIST (now REMOVED from R5 #2):
- protopulse-high-contrast       ← App.tsx:23 module-load read
- protopulse-gpu-blur-override   ← App.tsx:33 module-load read
- protopulse-theme               ← App.tsx:47 module-load read

REMAINING in R5 #2 allowlist:
- protopulse-beginner-mode, protopulse-compact-mode, protopulse-ai-safety-mode,
  protopulse-keyboard-shortcuts, protopulse-locale, protopulse-reduced-motion,
  protopulse-font-scale, protopulse-ai-tutor, protopulse-multimodal-input,
  protopulse-offline, protopulse-telemetry, protopulse-mobile-review-config,
  protopulse-ratsnest-filter, protopulse-hidden-projects
- protopulse_ai_provider, protopulse_ai_model, protopulse_ai_temp,
  protopulse_ai_sysprompt, protopulse_ai_preview_changes,
  protopulse_routing_strategy, protopulse_optimization_goal,
  protopulse_preferred_suppliers, protopulse_bom_sort_order
- protopulse:role-preset, protopulse:custom-keybindings,
  protopulse:quick-jump-recents, protopulse:sidebar-group-collapsed,
  protopulse:mention-notifications
```

The 3 excluded keys get a follow-up wave (R5.2 or later, call it "Bootstrap-Storage Restructure") that:
1. Replaces the eager `localStorage.getItem` reads in `App.tsx:21-60` with calls that go through the desktop adapter (synchronous + cached for the bootstrap phase).
2. Then migrates those keys to plugin-store.
3. Removes the eager localStorage path entirely.

That restructure has its own complexity (sync read from an async plugin-store API requires either a pre-load step or a synchronous adapter that's already populated). NOT in R5 #2 scope.

**Acceptance test (Codex R3 verification can probe):**
- R5 #2 migration code references `USER_SETTINGS_MIGRATION_ALLOWLIST` and that constant does NOT include `protopulse-high-contrast` / `protopulse-gpu-blur-override` / `protopulse-theme`.
- An explicit test asserts these 3 keys remain in localStorage after R5 #2 migration completes.
- A README/comment in the migration runner cites this R3 exclusion + the follow-up wave.

### M2 → Kanban commands match singleton semantics

**R2 position:** `read_project_kanban_state(project_id)` / `write_project_kanban_state(project_id, value)` — implies per-project.

**R3 fix:** Rename to singleton command names matching the current localStorage shape:

```rust
// src-tauri/src/desktop_store.rs (R5 #2 land)

#[tauri::command]
#[specta::specta]
pub async fn read_kanban_state(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    // Loads kanban-state.json, reads key "kanban-board".
    // No project_id parameter — current Kanban is a singleton in localStorage
    // (key: protopulse-kanban-board). Future R5.5+ wave introduces per-project
    // Kanban with read_project_kanban_state(project_id).
}

#[tauri::command]
#[specta::specta]
pub async fn write_kanban_state(
    app: tauri::AppHandle,
    value: serde_json::Value,
) -> Result<(), String> {
    // Same store + key. No project_id.
}
```

Store key inside `kanban-state.json`: `"kanban-board"` (matches the existing localStorage key name minus the `protopulse-` prefix, since the store path IS the namespace).

Design variables stays per-project with `project_id` (no change — that workflow IS per-project today):

```rust
#[tauri::command]
#[specta::specta]
pub async fn read_project_design_variables(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<Option<serde_json::Value>, String> { /* ... */ }

#[tauri::command]
#[specta::specta]
pub async fn write_project_design_variables(
    app: tauri::AppHandle,
    project_id: String,
    value: serde_json::Value,
) -> Result<(), String> { /* ... */ }
```

Full R3 command surface (6 commands across 3 workflows):

| Workflow | Read | Write | Per-project? |
|---|---|---|---|
| user-settings | `read_user_setting(key)` | `write_user_setting(key, value)` | NO (key-namespaced) |
| kanban-state | `read_kanban_state()` | `write_kanban_state(value)` | NO (singleton — R5 #2) |
| design-variables | `read_project_design_variables(project_id)` | `write_project_design_variables(project_id, value)` | YES |

`topology.test.ts` `WORKFLOW_TO_COMMAND` mapping updated:
```ts
"user-settings": ["read_user_setting", "write_user_setting"],
"kanban-state":  ["read_kanban_state", "write_kanban_state"],
"design-variables": ["read_project_design_variables", "write_project_design_variables"],
```

### Payload size cap → 512 KB per snapshot

**R2 position:** "16 KB per snapshot? configurable" (placeholder).

**R3 fix:** Pick **512 KB** as the hard cap for the whole-snapshot write commands (`write_kanban_state`, `write_project_design_variables`). User-settings writes have a tighter cap of **64 KB per key** since they're individual preference values.

**Rationale:**
- Kanban state typically <50 KB (boards have hundreds of cards with text, not megabytes of media).
- Design variables with full history can grow; 512 KB allows substantial history before triggering a "your snapshot is too large" UX prompt.
- 512 KB is below the 1 MB threshold where IPC payload performance becomes noticeable in Tauri.
- User-setting individual values (theme name, locale, AI model name, keyboard shortcuts JSON) are well under 64 KB.

```rust
// src-tauri/src/desktop_store.rs (R5 #2 land)
const MAX_SNAPSHOT_BYTES: usize = 512 * 1024;       // 512 KB
const MAX_USER_SETTING_VALUE_BYTES: usize = 64 * 1024; // 64 KB per key

fn check_snapshot_size(value: &serde_json::Value, max: usize, label: &str) -> Result<(), String> {
    let serialized = serde_json::to_vec(value).map_err(|e| format!("serialize: {}", e))?;
    if serialized.len() > max {
        return Err(format!(
            "{} payload too large: {} bytes > max {} bytes",
            label, serialized.len(), max,
        ));
    }
    Ok(())
}
```

Both caps are encoded as Rust constants. A future R5.5 wave can raise them with evidence; the implementation logs the actual snapshot size on every write for telemetry.

**Acceptance test:**
- Rust unit test: snapshot at 512 KB + 1 byte → `MAX_SNAPSHOT_BYTES exceeded` error.
- Rust unit test: snapshot at 512 KB exactly → accepted.
- Rust unit test: user-setting value at 64 KB + 1 → exceeded; at 64 KB exactly → accepted.

---

## Convergence

```
---
ROUND_STATUS: revised
OPEN_CRITIQUES: [exclusion of 3 bootstrap keys means R5 #2 user-settings migration is partial; size caps are evidence-light (chosen by reasoning, not by measuring real ProtoPulse Kanban/design-vars snapshots); Bootstrap-Storage Restructure follow-up wave is named but not scoped]
SIGNOFF: Claude
OWNERSHIP: Codex R3 verification
NEXT_ROUND: Codex authors COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R3.md — ratify R3 narrow fixes OR counter once more. If ratified → Claude implements. If counter → R4.
---
```

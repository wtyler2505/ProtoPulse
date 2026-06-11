# R5 Deferral #2 — tauri-plugin-store migration: R2 revised architecture

**Round type:** revised-proposal (Codex R1 returned `needs-revision`)
**Author:** Claude
**Reviewer:** Codex (R2 verification)
**Trigger:** `COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R1.md` Codex R1 review:
- Q2: counter-propose (drop `store:default` + JS plugin dep; backend-only)
- Q3: counter-propose (migration too late; need `DesktopStorageMigrationGate` above providers)
- Q4: ratify with refinements (per-workflow markers; written after save success)
- Q5: ratify with normalization
- Q7: counter-propose broader test set
- 5 missed concerns: explicit save, whole-snapshot commands, design-variables history, classifier reconciliation, capability minimization

---

## Lane Reservation

(Unchanged from R1.)

- **Active channels:** `COLLAB_TAURI_STORE_MIGRATION_*.md`
- **Claimed files (implementation):** same as R1 plus revisions noted below.
  - **REMOVED from claim list:** `@tauri-apps/plugin-store` npm package, `store:default` capability addition.
  - **ADDED:** `client/src/lib/desktop/desktop-storage-migration-gate.tsx` (new component above providers); `client/src/lib/kanban-board.ts` + `client/src/lib/design-vars-persistence.ts` (existing consumers updated).
- **Round type:** revised-proposal
- **Target file edits permitted this round:** `listed-only` (this R2 handoff)
- **Agent cap status:** 1/6 active.

---

## Per-Counter Revisions

### Q2 → Backend-only plugin use (REVISED — Codex counter accepted)

**Original proposal:** Add `tauri-plugin-store` (Rust) + `@tauri-apps/plugin-store` (JS) + `store:default` capability. Frontend uses generated `commands.*` only, but JS plugin package is installed defensively.

**R2 revised:** Backend-only. The Rust plugin is registered; the JS package is NOT installed; the `store:default` capability is NOT granted. Frontend has NO direct path to plugin-store. All store access goes through the generated typed command surface in `client/src/lib/bindings.ts`.

Cargo additions:
- `tauri-plugin-store = "2"` (Rust crate only)

package.json — NO additions. Codex's argument is correct: if frontend only calls generated commands, exposing the plugin's broad permission surface to the webview is unnecessary attack surface.

Capability JSON — NO addition. The webview cannot invoke the plugin directly. The backend Rust commands call the plugin internally with full crate permissions (which is fine — backend code is trusted; the goal is to lock down what the webview can do).

**Acceptance test (Codex R2 verification can probe):**
- `rg "store:default" src-tauri/capabilities/default.json` → no match
- `rg "@tauri-apps/plugin-store" package.json package-lock.json client/` → no match
- `rg "tauri-plugin-store" src-tauri/Cargo.toml` → 1 match (the dep)

### Q3 → DesktopStorageMigrationGate above providers (REVISED — Codex counter accepted)

**Original proposal:** Migration runs from `DesktopLifecycleBridge` `useEffect` after frontend_ready.

**R2 revised:** New `DesktopStorageMigrationGate` component at App.tsx level, ABOVE all providers that read localStorage during init. Bootstrap order:

```
<ThemeProvider>
  <ProtoPulseThemeProvider>
    <GpuPerformanceProvider>
      <QueryClientProvider>
        <TooltipProvider>
          <DesktopStorageMigrationGate>  ← R2 NEW
            <DesktopLifecycleBridge />
            <AuthProvider>               ← reads localStorage; must mount AFTER gate
              <AuthGate><Router /></AuthGate>
            </AuthProvider>
            <Toaster />
          </DesktopStorageMigrationGate>
        </TooltipProvider>
      ...
```

Implementation sketch (NOT final code; full diff in implementation phase):

```tsx
// client/src/lib/desktop/desktop-storage-migration-gate.tsx
export function DesktopStorageMigrationGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'pending' | 'ready' | 'failed'>('pending');
  
  useEffect(() => {
    if (!isTauri) { setStatus('ready'); return; }
    void migrateAllWorkflowsToPluginStore()
      .then(() => setStatus('ready'))
      .catch((e) => {
        console.error('[storage-migration] failed; falling open to localStorage:', e);
        setStatus('failed');
      });
  }, []);
  
  if (status === 'pending') {
    return <div role="status" aria-live="polite">Initializing...</div>;
  }
  // 'ready' or 'failed' — render children (fail-open: localStorage still works)
  return <>{children}</>;
}
```

**Fail-open semantics:** if migration fails for ANY reason, render children anyway. The adapter (`getUserSettingStore` etc.) falls back to localStorage when plugin-store reads return null AND migration marker is absent. Never block app launch indefinitely.

**Session-auth exclusion:** the migration allowlist HARD-EXCLUDES any key matching `SENSITIVE_KEY_ORACLE` from `storage-migration.ts`. Sensitive keys (API keys, OAuth tokens, session IDs) STAY in localStorage until the R5 #4 (Stronghold/keychain) wave migrates them.

### Q4 → Per-workflow markers AND save-then-mark order (REVISED)

**Original proposal:** Single marker `protopulse-migration:tauri-plugin-store-v1` written at the end.

**R2 revised:** Three per-workflow markers:
- `protopulse-migration:user-settings-store-v1`
- `protopulse-migration:kanban-state-store-v1`
- `protopulse-migration:design-variables-store-v1`

Each marker is written to its OWN store AFTER `store.save()` succeeds. If user-settings migration succeeds but kanban-state fails, only the user-settings marker is written; the next launch retries kanban-state migration.

Order:
1. For each workflow: drain localStorage keys → `store.set()` calls → `store.save()` → only on save success: write `migration-vN` marker key → `store.save()` again.
2. NO marker written before the underlying writes are durable on disk.

Markers are tracked in the inventory as `event-name-not-storage` since they're migration metadata, not migrated state. The classifier ignores them.

### Q5 → projectId validation with normalization (REVISED)

**Original proposal:** `^[a-zA-Z0-9_-]{1,64}$`.

**R2 revised:** Same regex PLUS normalization rules. In every command body that accepts `project_id`:

```rust
fn normalize_and_validate_project_id(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("project_id is empty after trim".to_string());
    }
    if trimmed != raw {
        return Err(format!("project_id has surrounding whitespace: '{}'", raw));
    }
    if !trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err(format!("project_id has invalid characters: '{}'", trimmed));
    }
    if trimmed.len() > 64 {
        return Err(format!("project_id too long ({}): '{}'", trimmed.len(), trimmed));
    }
    Ok(trimmed.to_string())
}
```

Project IDs are TREATED AS STORE KEYS, not filesystem paths. If a future wave creates per-project store FILES, the filename derives from a hash or `percent_encode(project_id)` rather than directly using the ID. Keeps this regex narrow forever.

### Q6 → Tight scope, session-auth exclusion, Kanban singleton reconciliation (REVISED)

**R2 revised scope:**

`user-settings` migration allowlist (explicit per-key list, NOT bucket-based scrape):
- All `protopulse_ai_*` keys (provider, model, temp, sysprompt, preview_changes) — non-sensitive preference choices
- `protopulse_routing_strategy`, `protopulse_optimization_goal`, `protopulse_preferred_suppliers`, `protopulse_bom_sort_order`
- `protopulse-high-contrast`, `protopulse-theme`, `protopulse-locale`, `protopulse-beginner-mode`, `protopulse-compact-mode`, `protopulse-ai-safety-mode`, `protopulse-gpu-blur-override`, `protopulse-reduced-motion`, `protopulse-font-scale`, `protopulse-ai-tutor`
- `protopulse-keyboard-shortcuts`, `protopulse-multimodal-input`, `protopulse-offline`, `protopulse-telemetry`, `protopulse-mobile-review-config`, `protopulse-ratsnest-filter`, `protopulse-hidden-projects`
- `protopulse:role-preset`, `protopulse:custom-keybindings`, `protopulse:quick-jump-recents`, `protopulse:sidebar-group-collapsed`, `protopulse:mention-notifications`

`user-settings` migration HARD-EXCLUDES (stay in localStorage; R5 #4 Stronghold wave):
- `protopulse-session-id`
- `protopulse-ai-api-key` + `-gemini` + `-gemini-scratch` variants
- `protopulse-google-workspace-token` + `-scratch`
- `protopulse-supplier-api`
- `protopulse:public-api:keys` + `:webhooks` + `:deliveries`
- Anything matching `SENSITIVE_KEY_ORACLE` regex (defensive runtime check in addition to explicit list)

`kanban-state` migration: **PRESERVE SINGLETON SEMANTICS** for R5 #2. The existing `kanban-board.ts` uses one localStorage key `protopulse-kanban-board` for all kanban state. The plugin-store equivalent is a single key in `kanban-state.json`:
- Read: `store.get("kanban-board")` → JSON parsed Kanban state
- Write: `store.set("kanban-board", json)` then `store.save()`

If a future wave (R5.5+) refactors to per-project Kanban, that becomes a separate migration with a `protopulse-migration:kanban-state-store-v2` marker.

`design-variables` migration: handle BOTH the singleton-style and the per-project paths AND the existing migration marker:
- Single key `protopulse:design-variables` for top-level vars
- Per-project keys `protopulse:design-variables:project:<projectId>` migrated as nested entries
- Existing local migration marker `protopulse:design-variables:migrated` PRESERVED IN PLACE in localStorage (does not migrate to plugin-store — it's an old-era marker)
- Design variable HISTORY (per Codex missed concern #3) — if there's a history key, it migrates alongside

R2 commits to enumerating all design-variable keys from `rg "protopulse:design-variables"` during implementation. The migration allowlist is built from that enumeration, not from a bucket scrape.

### Q7 → Broader test coverage (REVISED — Codex counter accepted)

R2 adopts Codex's full test list:

| Test category | What it asserts | File |
|---|---|---|
| Rust validation tests | Allowed/denied setting keys; project_id validation; payload shape; max-size rejection | `src-tauri/src/desktop_store.rs` `#[cfg(test)]` |
| Rust persistence tests | Write → save → reload → read returns same value | Same file + integration test |
| Adapter selection tests | `isTauri=true` returns plugin-store backend; `isTauri=false` returns localStorage; same API surface | `client/src/lib/__tests__/desktop-store-adapter.test.ts` (new) |
| Migration idempotency | Re-run after marker present is no-op | `client/src/lib/__tests__/desktop-storage-migration.test.ts` (extend) |
| Corrupt JSON tolerance | localStorage entry is malformed JSON → migration logs warning + skips that key, continues | Same |
| Partial failure marker | Marker NOT written when save fails; next launch retries | Same |
| Secret exclusion | Each key in the user-settings allowlist is NOT in SENSITIVE_KEY_ORACLE; defensive runtime check rejects oracle-matched keys | Same |
| Capability assertion | `default.json` does NOT contain `store:default`; package.json does NOT contain `@tauri-apps/plugin-store` | `client/src/lib/__tests__/tauri-native-authority.test.ts` (extend) |
| Topology contract | `user-settings` / `kanban-state` / `design-variables` workflows assert backing Rust commands | `runtime-topology.test.ts` (extend) |
| Existing workflow tests | Kanban + design-variables persistence tests exercise the adapter path, not direct localStorage | Existing test files (probably need updates) |

### Missed concerns (REVISED)

**M1. Explicit save semantics.** Every command that writes calls `store.set(...)` then `store.save()` synchronously before returning Ok(()). NO reliance on autosave or graceful-exit-only durability.

**M2. Command names match whole-snapshot workflow shape.** Renamed from per-variable to per-snapshot:
- `read_user_setting(key: String) -> Result<Option<JsonValue>, String>` (unchanged — keys are first-class)
- `write_user_setting(key: String, value: JsonValue) -> Result<(), String>`
- `read_project_kanban_state(project_id: String) -> Result<Option<JsonValue>, String>`
- `write_project_kanban_state(project_id: String, value: JsonValue) -> Result<(), String>`
- `read_project_design_variables(project_id: String) -> Result<Option<JsonValue>, String>`
- `write_project_design_variables(project_id: String, value: JsonValue) -> Result<(), String>`

Kanban + design-variables work on WHOLE-WORKFLOW snapshots (Kanban board state object; entire design-variables object including history). NOT per-variable. Frontend constructs the snapshot, sends it once, Rust persists.

**M3. Design variables history.** The migration of `design-variables` includes the history sub-object. The whole-snapshot command write/read pattern (M2) naturally handles this — the value blob is whatever the frontend persists.

**M4. Classifier reconciliation (Q1 cleanup).** Update `storage-migration.ts` `MIGRATION_TARGETS`:
```ts
// Before
"project-data": "native-fs",
// After (R2 land)
"project-data": "native-fs-or-plugin-store",  // ambiguous bucket; per-workflow decision
```

OR keep `project-data: native-fs` but mark Kanban + design-variables as EXCEPTIONS via per-workflow metadata. R2 prefers the latter: add `workflowMigrationTarget` field to inventory entries so the planner can decide per-key:

```json
{
  "key": "protopulse-kanban-board",
  "classifiedAs": "project-data",
  "sensitive": false,
  "callSites": [...],
  "workflowMigrationTarget": "tauri-plugin-store"  // R2 NEW
}
```

This addresses Q1 cleanup explicitly + lets the planner emit accurate per-bucket / per-workflow advice.

**M5. Capability minimization confirmed (Q2 above).** No `store:default`, no JS plugin. Strict allowlist via custom commands.

---

## Revised Implementation Order

1. Cargo add `tauri-plugin-store = "2"`. NO npm dep.
2. `src-tauri/src/desktop_store.rs` (new) — 6 typed commands (read/write × 3 workflows) + `normalize_and_validate_project_id` + payload size cap (16 KB per snapshot? configurable) + Rust unit tests for all of the above.
3. `lib.rs` register plugin + commands in `collect_commands!`.
4. `build.rs` allowlist new commands.
5. Capability JSON unchanged (NO `store:default`).
6. Regenerate `bindings.ts`.
7. `client/src/lib/desktop/desktop-store-adapter.ts` (new) — `getUserSettingStore`, `getKanbanStateStore`, `getDesignVariablesStore`; returns plugin-store backend when isTauri, localStorage otherwise.
8. `client/src/lib/desktop/desktop-storage-migration-gate.tsx` (new) — mounts above providers; runs migrations; fail-open.
9. Migration runner module (`client/src/lib/desktop/storage-migration-runner.ts`) — per-workflow migrate functions with explicit allowlists from §Q6.
10. `App.tsx` — wrap providers in `<DesktopStorageMigrationGate>`.
11. Topology update: 3 workflows → `desktop-rust`, drop `resolutionWave`.
12. Inventory + classifier: add `workflowMigrationTarget` field per Q1/M4.
13. Existing consumers (`kanban-board.ts`, `design-vars-persistence.ts`, `useChatSettings.ts`, etc.) updated to call adapter functions.
14. All tests per §Q7 table.

---

## Convergence

```
---
ROUND_STATUS: revised-proposed
OPEN_CRITIQUES: [R2 still has open architectural assumptions Codex may push back on: M4 inventory schema extension; storage-migration-runner.ts allowlist completeness; fail-open vs blocking-on-failure UX tradeoff; payload size cap value; whether kanban-board singleton preservation is correct call vs forcing per-project refactor in same wave]
SIGNOFF: Claude
OWNERSHIP: Codex R2 verification
NEXT_ROUND: Codex authors COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R2.md — ratify or counter again. If ratified → Claude implements per §Revised Implementation Order. If counter → R3 (full retro pattern).
---
```

# ADR — Bootstrap-Storage Restructure (R5 #2 excluded keys + R5 #4 Stronghold activation)

**Status:** ACCEPTED 2026-05-12 (architecture committed; full implementation gated on Tauri-runtime test capability + Tyler go-ahead on auth-context user-impact).
**Context:** Two R5 deferrals share one root blocker — **synchronous storage reads at module-evaluation / provider-init time, before any React migration gate can mount**:
- R5 #2 excluded 3 keys (`protopulse-high-contrast`, `protopulse-gpu-blur-override`, `protopulse-theme`) read at `client/src/App.tsx:24-61` to prevent flash-of-unstyled-content (FOUC) BEFORE React renders.
- R5 #4 (Stronghold session-auth) is blocked because `client/src/lib/auth-context.tsx` reads `protopulse-session-id` during provider init.

Both need the same fix: a mechanism to make synchronous localStorage reads return plugin-store / Stronghold-sourced values without an async refactor of every read site.

---

## Decision: Tauri `initialization_script` shadow-sync

At Tauri webview boot, BEFORE the JS bundle executes, inject a script that pre-populates `localStorage` from the backend stores (plugin-store for prefs, Stronghold for credentials). The existing synchronous `localStorage.getItem` reads then see backend-sourced values transparently. No read-site refactor needed.

**Mechanism:** Tauri's `WebviewWindowBuilder::initialization_script` (or `Builder::on_window_ready` / an app-level init script) runs before page scripts. Per https://v2.tauri.app/reference/javascript/api/, init scripts execute in the webview context before the loaded page's own scripts.

**Flow:**
1. Tauri `setup()` reads the bootstrap keys from plugin-store + session-auth keys from Stronghold (both backend, no webview involvement).
2. Builds a JS init script: `localStorage.setItem('protopulse-theme', '<value>'); localStorage.setItem('protopulse-session-id', '<value>'); ...` for each migrated key that has a backend value.
3. Registers the script on the main window so it runs before the bundle.
4. App.tsx:24-61 + auth-context.tsx read localStorage as today — but the values originate from the backend stores.

**Write path:** writes continue dual-write (localStorage + backend store) per the R5 #2 consumer-migration pattern (commit 83f02cba). The init-script shadow-sync makes localStorage a cache of the backend truth, refreshed at every boot.

---

## Why initialization_script over the alternatives

| Approach | Verdict |
|---|---|
| **A. initialization_script shadow-sync** (chosen) | Zero read-site refactor. FOUC prevention preserved (synchronous reads still work). Backend store is the source of truth; localStorage is a boot-refreshed cache. |
| B. Async-init refactor of every read site | Requires loading-state UI for theme/contrast (visible FOUC) + auth (already has a loading gate). High blast radius across App.tsx + 3 providers + N consumers. Rejected — worse UX, more churn. |
| C. Keep localStorage as source of truth (no restructure) | Means plugin-store/Stronghold never become authoritative for these keys. Defeats R5 #2/#4. Rejected. |

The shadow-sync keeps the FOUC-prevention property (the whole reason these reads are synchronous + eager) while making the backend store authoritative.

---

## Implementation contract (binding for the activation wave)

### Rust side (`src-tauri/src/bootstrap_sync.rs`, new)

```rust
/// Build the localStorage pre-population script from backend stores.
/// Runs at setup() time; reads are backend-only (no webview yet).
pub fn build_bootstrap_init_script(app: &tauri::AppHandle) -> String {
    let mut stmts = Vec::new();

    // 1. Prefs from plugin-store (user-settings.json) — the 3 R5 #2 excluded keys.
    for key in ["protopulse-high-contrast", "protopulse-gpu-blur-override", "protopulse-theme"] {
        if let Ok(store) = app.store("user-settings.json") {
            if let Some(v) = store.get(key) {
                // serde_json::Value → JSON string literal, then JS-escape.
                stmts.push(format!(
                    "try{{localStorage.setItem({}, {});}}catch(e){{}}",
                    js_string_literal(key),
                    js_string_literal(&value_to_localstorage_string(&v)),
                ));
            }
        }
    }

    // 2. Session-auth from Stronghold — read each sensitive key, inject.
    //    (Stronghold unlock per docs/decisions/2026-05-12-adr-session-auth-keychain.md.)
    //    Only inject if Stronghold migration marker is present (post-migration).

    format!("(function(){{{}}})();", stmts.join(""))
}
```

Register via the window builder OR `app.get_webview_window("main").eval(...)` IF the window supports pre-load injection. **Verify in the activation wave** that the script runs before the bundle — if tauri.conf.json-defined windows can't take an init script programmatically, migrate the main window to a `WebviewWindowBuilder` in `setup()`.

### Migration runner additions

- The 3 R5 #2 excluded keys move INTO the `USER_SETTINGS_MIGRATION_ALLOWLIST` (remove from `USER_SETTINGS_HARD_EXCLUDE`) in `storage-migration-runner.ts` — they're now safe to migrate because the init-script shadow-sync handles their eager reads.
- Activate the R5 #4 session-auth migration: drain inventory `sensitive:true` keys into Stronghold via the (then-implemented) `set_session_credential` command, delete from localStorage after successful keychain write.

### auth-context.tsx changes

- Reads stay synchronous (`localStorage.getItem('protopulse-session-id')`) — value now sourced from Stronghold via the init script.
- Writes go through `set_session_credential` Rust command (frontend change) + the init-script refreshes localStorage on next boot.
- **User-impact consideration (per Tyler's note):** if Stronghold is inaccessible (vault locked, corrupted), the init script injects nothing → auth-context reads empty session-id → user appears logged out. The fail-open path must preserve the existing localStorage value when Stronghold read fails, so a Stronghold outage degrades to today's behavior rather than logging everyone out. THIS is the user-impact risk that requires Tyler go-ahead.

### Topology

- `auth-session` workflow flips `remote-server` → `desktop-rust` only after session-auth migration lands + the fail-open path is tested.
- The 3 user-prefs keys are already covered by `user-settings` workflow (already `desktop-rust`); no topology change for them.

---

## Activation gates

This wave does NOT land until:
1. **Tauri-runtime test capability.** The init-script timing (script runs before bundle) must be verified in an actual Tauri dev build, not just unit tests. Requires a Tauri runtime in the test/CI environment OR manual verification.
2. **Tyler go-ahead on auth-context user-impact.** The "Stronghold outage → fail-open to localStorage" path is a security/UX trade-off (a locked vault must NOT log users out). Tyler decides the acceptable behavior.
3. **R5 #4 typed credential commands implemented.** `set_session_credential` / `get_session_credential` / `delete_session_credential` from the Stronghold ADR must land first (they're scaffold-only today).

When all three clear, the implementing wave references this ADR + the R5 #2 / R5 #4 ADRs as binding inputs.

---

## What this ADR commit does NOT change

- No code change to App.tsx, auth-context.tsx, or the migration runner.
- The 3 keys stay in `USER_SETTINGS_HARD_EXCLUDE`.
- Stronghold stays scaffold-only (crate adopted, no commands wired).
- This is the architecture-commitment document only.

---

## References

- R5 #2 store migration: `docs/decisions/2026-05-12-adr-arduino-typed-commands.md` sibling pattern; runner at `client/src/lib/desktop/storage-migration-runner.ts` (`USER_SETTINGS_HARD_EXCLUDE`).
- R5 #4 Stronghold: `docs/decisions/2026-05-12-adr-session-auth-keychain.md`.
- Consumer dual-write: commit 83f02cba.
- Bootstrap reads: `client/src/App.tsx:24-61`, `client/src/lib/auth-context.tsx` (session-id read).
- Tauri init scripts: https://v2.tauri.app/reference/javascript/api/ (WebviewWindow initialization_script).
- Codex R5 #2 R3 Q3 ratification (bootstrap-read exclusion): `COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R3.md`.

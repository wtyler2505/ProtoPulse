# ADR — Session-auth credential storage migration (R5 Deferral #4)

**Status:** ACCEPTED 2026-05-12 (scaffold-level; full migration gated on Bootstrap-Storage Restructure follow-up wave).
**Context:** Tauri retro R3.7 land plan listed Stronghold / OS keychain migration of the session-auth bucket as R5 deferral. The R5 #2 (tauri-plugin-store) wave landed but EXCLUDED session-auth keys per Codex R2 Q6 ratification: those keys belong in a credential-grade store (Stronghold or OS keychain), not in plugin-store.

This ADR commits the architecture for that migration. Implementation lands when the Bootstrap-Storage Restructure follow-up wave restructures `client/src/lib/auth-context.tsx` eager `localStorage` reads (which fire during provider init, BEFORE any migration gate can mount).

---

## Why this is deferred (not just credentialed-pending)

Two distinct gates block full implementation:

1. **Bootstrap-read problem** (same as R5 #2 Q3). `auth-context.tsx:25-37` reads `protopulse-session-id` from localStorage during provider initialization. The provider mounts BEFORE any in-React migration gate can run. Same issue as the 3 user-settings bootstrap keys excluded from R5 #2 (`protopulse-high-contrast`, `protopulse-gpu-blur-override`, `protopulse-theme`). All four must be migrated as part of a single coherent bootstrap restructure, not piecemeal.

2. **Credential migration is irreversible.** Unlike user-prefs (where keep-localStorage-as-backup is acceptable per R5 #2 Q4), credentials in localStorage are a security liability. Migrating them silently means localStorage still contains the credential immediately after the keychain copy. R5 #4 must either delete the localStorage entry AS PART OF the migration write (with rollback to localStorage if keychain access fails) OR move the credentials to keychain and use them from there exclusively going forward.

Both gates point to: ship Stronghold/keychain WIRING (this commit) + commit to the architecture (this ADR) + execute the actual migration in the wave that also restructures `auth-context.tsx`.

---

## Plugin choice: tauri-plugin-stronghold

**Decision:** `tauri-plugin-stronghold` is the Tauri-recommended credential vault. Per https://v2.tauri.app/plugin/stronghold/, it provides encrypted at-rest storage with a password-derived key, suitable for OAuth tokens, session IDs, API keys.

**Alternatives considered:**
- **OS keychain (libsecret / Windows Credential Manager / macOS Keychain Services) via a community plugin (keyring-rs / tauri-plugin-keyring):** strongest at-rest protection (OS-managed encryption keys) but requires per-platform plugins. The community plugin ecosystem is less mature than Stronghold's official Tauri integration.
- **Hand-rolled encrypted JSON via tauri-plugin-fs:** requires us to own the encryption + key derivation. Reinventing what Stronghold provides. Rejected.

Per Tauri 2.x recommendation, **Stronghold is the right starting point**. If a future wave decides to layer OS keychain on top (e.g., for Stronghold's password storage), that's a separate ADR.

## Password derivation: pre-shared secret salted with machine ID

Stronghold requires a password to unlock the vault. Decisions:

**For dev preview / R5 #4:** A pre-shared application secret salted with the machine ID (`tauri::os::os_type()` + hostname hash). NOT user-provided.

**Rationale:** ProtoPulse has no user-password flow today (auth-session is server-issued tokens). Forcing a user to enter a Stronghold unlock password on every launch would be terrible UX. The pre-shared secret + machine-salt gives "encrypted-at-rest, bound to this machine" semantics that match the existing localStorage threat model (localStorage is also bound to this machine).

**Future hardening:** when ProtoPulse adopts a user-password flow OR integrates with OS keychain for unlock-password retrieval, the Stronghold password derivation upgrades. Don't ship a worse UX today to enable a hypothetical better one tomorrow.

**Salt source:** `tauri::os::machine_id()` if available (Tauri 2.x); otherwise a hash of `(hostname, OS, install-time-generated random UUID stored at $APPDATA/protopulse/machine-salt.bin with 0600 perms)`.

## Migration semantics (deferred to Bootstrap-Storage Restructure wave)

When the bootstrap restructure wave lands, the migration runner:

1. **Inventory.** Per the inventory's `sensitive: true` flag, drain these keys:
   - `protopulse-session-id` (and legacy `sessionId`)
   - `protopulse-ai-api-key` + `-gemini` + `-gemini-scratch`
   - `protopulse-google-workspace-token` + `-scratch`
   - `protopulse:public-api:keys` + `:webhooks` + `:deliveries`
   - `protopulse-supplier-api`
2. **Per-key migration.** For each key:
   - Read from localStorage.
   - If non-null: call `set_session_credential(key, value)` typed Rust command.
   - On success: localStorage.removeItem(key) — credentials NOT left in plaintext after migration.
   - On failure (Stronghold inaccessible): leave localStorage in place, log warning, set migration-attempt marker.
3. **Per-workflow marker** like R5 #2, stored INSIDE Stronghold under a non-sensitive key (`__migration_marker__`). Idempotent re-run.
4. **NO migration UX prompt** (matches R5 #2 silent migration). However, on FIRST RUN after migration, the auth context will likely fail to find the session-id in localStorage (it was deleted), so `auth-context.tsx` must be REWRITTEN to read from `get_session_credential` first, fall back to localStorage second (rollback path), and on rollback restore the value to Stronghold + re-delete from localStorage. This rewrite IS the bootstrap restructure.

## Typed command surface

```rust
// src-tauri/src/credentials.rs (future implementation)

#[tauri::command]
#[specta::specta]
pub async fn set_session_credential(
    app: tauri::AppHandle,
    key: String,
    value: String,
) -> Result<(), String> { /* Stronghold set + save */ }

#[tauri::command]
#[specta::specta]
pub async fn get_session_credential(
    app: tauri::AppHandle,
    key: String,
) -> Result<Option<String>, String> { /* Stronghold get */ }

#[tauri::command]
#[specta::specta]
pub async fn delete_session_credential(
    app: tauri::AppHandle,
    key: String,
) -> Result<(), String> { /* Stronghold remove + save */ }
```

Key allowlist enforced inside the commands (per the inventory's sensitive set). Reject any key NOT in the explicit allowlist — preventing arbitrary "store random data in Stronghold" abuse.

## Capability minimization (consistent with R5 #2/#3 pattern)

NO `@tauri-apps/plugin-stronghold` JS dep. NO `stronghold:default` capability. Frontend invokes only `set_session_credential` / `get_session_credential` / `delete_session_credential` via generated bindings.

## What this commit lands

1. **Cargo dep:** `tauri-plugin-stronghold = "2"` added to `src-tauri/Cargo.toml`.
2. **Plugin registration** in `lib.rs::run()` with the pre-shared salted password (machine-id-based).
3. **This ADR** — binding architecture commitments.

## What this commit does NOT land

- Typed `set_session_credential` / `get_session_credential` / `delete_session_credential` commands (deferred — requires Bootstrap-Storage Restructure wave).
- Migration runner for session-auth keys (deferred — same wave).
- `auth-context.tsx` rewrite to read from Stronghold (deferred — same wave).
- Topology flip for `auth-session` workflow (stays `remote-server` with `resolutionWave: r5-storage` until the migration wave lands; then `desktop-rust`).

## Activation gate

When the Bootstrap-Storage Restructure wave lands, the implementing developer references this ADR + R5 #2 Q3 exclusion list. The wave:
1. Restructures App.tsx eager reads (the 3 user-prefs bootstrap keys go first via plugin-store).
2. Restructures auth-context.tsx eager reads (then credentials migrate to Stronghold).
3. Implements the 3 typed credential commands.
4. Runs the migration on first launch.
5. Flips `auth-session` topology to `desktop-rust`.

## References

- Tauri Stronghold plugin: https://v2.tauri.app/plugin/stronghold/
- R5 #2 retro exclusion list: `client/src/lib/desktop/storage-migration-runner.ts` USER_SETTINGS_HARD_EXCLUDE + the session-auth carve-out at USER_SETTINGS_MIGRATION_ALLOWLIST allowlist.
- Inventory sensitive flag: `client/src/lib/desktop/storage-key-inventory.json` entries with `sensitive: true`.
- Codex R5 #2 R3 Q6 ratification (session-auth exclusion): `COLLAB_TAURI_STORE_MIGRATION_RESPONSE_R2.md` §6.

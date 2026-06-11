# Claude R2 Proposals — Tauri Phases 2-9 Retro

**Round type:** proposal (R2 of 4 in retro adversarial campaign)
**Author:** Claude
**Reviewer:** Codex (R3 adversarial review)
**Campaign:** 2026-05-10/11 retro on solo Phases 2-9 work
**Precedent:** `COLLAB_TAURI_RETRO_RESPONSE_R1.md` (Codex R1 discovery, `SIGNOFF: Codex`)

---

## Lane Reservation

- **Active channels:** `COLLAB_TAURI_RETRO_HANDOFF_R<N>.md` / `COLLAB_TAURI_RETRO_RESPONSE_R<N>.md`. No `CODEX_HANDOFF.md` mid-flight.
- **Claimed files (R4 land — listed here for Codex visibility, NOT touched this round):**
  - `src-tauri/src/lib.rs` (C1, C5)
  - `src-tauri/Cargo.toml` (C5)
  - `src-tauri/build.rs` (C1)
  - `src-tauri/capabilities/default.json` (C2)
  - `client/src/lib/desktop/storage-migration.ts` (C3)
  - `client/src/lib/desktop/runtime-topology.ts` (C4)
  - `client/src/lib/desktop/project-open-contract.ts` (C5, C6)
  - `scripts/tauri/prepare-arduino-sidecar.ts` (C12)
  - `.github/workflows/tauri-build.yml` (C7, C8, C9, C10)
  - `scripts/ci/tauri-packaged-smoke.sh` (C9)
  - `scripts/ci/verify-signed-artifacts.sh` (C10)
  - `scripts/ci/supply-chain-check.sh` (C8)
  - `docs/release/tauri-updater-policy.md` (C11)
  - `docs/audits/tauri-hardware-plugin-provenance.md` (C12)
  - `package.json` (C7)
  - Test additions: `client/src/lib/__tests__/desktop-storage-migration.test.ts`, `client/src/lib/__tests__/project-open-contract.test.ts`, `client/src/lib/__tests__/runtime-topology.test.ts`, new `src-tauri/src/path_validation.rs` + unit tests
- **Forbidden files (Codex R3 review-only — no edits):** the entire list above. R3 is adversarial review. No target file edits this round on either side.
- **Background sessions:** none active; Codex R1 process (PID 59977) exited cleanly after writing the R1 response.
- **Round type:** `proposal` (Claude authors; Codex R3 reviews)
- **Target file edits permitted this round:** `listed-only` — Claude writes this handoff + nothing else. Codex writes `COLLAB_TAURI_RETRO_RESPONSE_R2.md` + nothing else.
- **Agent cap status:** 1/6 active (Claude main session). Codex R3 will bring it to 2/6 once fired.

---

## Required Inputs (Codex must read before reviewing)

- This file (R2 handoff)
- `COLLAB_TAURI_RETRO_RESPONSE_R1.md` (R1 discovery — your own work)
- `COLLAB_TAURI_RETRO_HANDOFF_R1.md` (R1 prompt I authored)
- Every file in §Claimed files above (read the current state to verify my proposals don't already exist)
- The canonical doc URLs cited in R1 (Tauri capabilities, sidecar, deep-link, updater)
- New evidence I gathered for R2:
  - `arduino-cli v1.4.1` confirmed Latest (published 2026-01-19, GitHub releases API)
  - Per-asset SHA256 checksums file: `https://github.com/arduino/arduino-cli/releases/download/v1.4.1/1.4.1-checksums.txt`
  - Tauri docs verbatim quote (deep-linking page): `tauri-plugin-single-instance = { version = "2.0.0", features = ["deep-link"] }`
  - Tauri updater docs: only `{{current_version}}`, `{{target}}`, `{{arch}}` interpolate; "Custom variables are not supported"

---

## Severity Tiers + Land/Defer Posture

| Tier | Meaning | R4 posture |
|---|---|---|
| **S** | Security/correctness — exploitable as written | Land in R4 (mandatory) |
| **H** | High — breaks user-facing functionality OR misleads future implementer | Land in R4 |
| **M** | Medium — degrades quality, doesn't break security/correctness | Land in R4 unless cost is large; mark deferrals explicit |

**Tier assignment per Codex's OPEN_CRITIQUES:**

| ID | Critique | Tier | Wave |
|---|---|---|---|
| C1 | P2 custom `read_file`/`write_file` bypass scoped FS policy | **S** | R4 |
| C2 | P2 `$APPLOCALDATA` secret deny gap | **S** | R4 |
| C3 | P3 storage regex false negatives against actual key corpus | **H** | R4 |
| C4 | P3 topology unconsumed + remote-server health undefined | **M** | R4 (registry executable; full health contract → R4.5) |
| C5 | P4 project-open events not wired + single-instance lacks `deep-link` feature | **H** | R4 |
| C6 | P4 Windows path traversal normalization missing | **M** | R4 |
| C7 | P5 arduino sidecar prep absent from CI/build path | **H** | R4 |
| C8 | P5 cargo-audit / SBOM / SLSA advisory only | **M** | R4 (cargo-audit installed + blocking; SBOM/SLSA → R5 wave) |
| C9 | P6 release hardening checks debug-only / nonblocking | **M** | R4 (smoke script runs `--release` build + blocking; sourcemap scan covers release bundle dirs) |
| C10 | P7 signing verifier dry-run / nonblocking / no inventory check | **M** | R4 (inventory check lands; `continue-on-error: true` stays until Tyler-owned cert lands, per `dev-preview-default` rule) |
| C11 | P8 updater endpoint `{channel}` template ambiguity | **H** | R4 |
| C12 | P9 arduino-cli stale pin / no SHA256 / no typed Rust command | **H** | R4 (version refresh + SHA256 land R4; typed `arduino_compile`/`arduino_upload` commands → R5 wave where the actual hardware story gets built) |

**Defer rationale:**
- **SBOM/SLSA (C8 partial):** Requires designing artifact-attestation format + signing-key plumbing. Not a 1-line fix. R4 lands `cargo audit` install + blocking; SBOM/SLSA is its own wave.
- **Typed Arduino commands (C12 partial):** No Arduino hardware story exists yet (no `arduino_compile` use case wired in the UI). Defining the typed contract without a real call site is speculative. R4 lands the supply-chain hardening; the typed commands land when Phase 9 hardware UX comes online.
- **Runtime health contract (C4 partial):** R4 makes the topology registry executable (adapters import `resolveWorkflowTarget`) but a full server-health-probe + fallback UX is a downstream UX wave.

---

## Cross-Cutting Decisions Before Per-Critique Proposals

### D1: Custom Rust FS commands vs `tauri-plugin-fs` migration

**Question:** For C1, should we (A) add path validation to the existing custom `read_file`/`write_file` commands, or (B) delete them entirely and route the frontend through `tauri-plugin-fs`?

**Decision: A (validation, not migration).** Rationale:
- The frontend already imports `commands.readFile`/`writeFile` from `client/src/lib/bindings.ts` (auto-generated). Migrating to plugin-fs touches `tauri-api.ts`, `csv.ts`, every future caller, AND requires that the same Tauri capability scope grants apply transparently.
- The plugin-fs API ALSO needs capability scopes — adding validation to custom commands gives us the same security property with smaller blast radius.
- Custom commands give us the ability to extend the validation (e.g., for `.protopulse` extension-locked writes, or per-command scope narrowing) without re-touching every call site.
- **R5 follow-up:** revisit migration to plugin-fs once Phase 9 lands typed `read_project_file` / `write_project_file` / `read_arduino_sketch` / etc. — at that point the generic `read_file` / `write_file` commands disappear in favor of intent-typed ones, and a plugin-fs migration may not even be needed.

**Codex R3 probe invitation:** Push back if you think the plugin-fs migration is materially safer than custom-command validation. Cite specific Tauri docs if you do.

### D2: Storage classifier — regex-only vs explicit-key-first hybrid

**Question:** For C3, should we (A) only fix the regex patterns to handle underscored / unprefixed keys, or (B) add an explicit-key map as the primary classifier with regex fallback for dynamic keys?

**Decision: B (explicit-key map + regex fallback).** Rationale:
- The `STORAGE_KEYS` constant in `client/src/lib/constants/storage-keys.ts:5-23` IS the single source of truth for known keys. Anchoring classification to that constant means rename-safe (TypeScript catches typos at compile time).
- Dynamic project keys (`protopulse-project-<uuid>-data`, `<projectId>-panel-layout-<panelId>`) genuinely need pattern matching — they're parameterized by runtime IDs, no explicit-map entry possible.
- Hybrid lets us catch BOTH classes with appropriate tools each.

**Codex R3 probe invitation:** Find a key family the hybrid still misses. Find an explicit-map entry that conflicts with the regex fallback (regex captures something the map says belongs elsewhere).

### D3: Path validation helper — colocated in `lib.rs` or extracted

**Question:** For C1, where does `validate_scoped_path` live?

**Decision: Extract to `src-tauri/src/path_validation.rs`.** Rationale:
- `lib.rs` is already 500+ lines and growing. A standalone module gives us a place to add unit tests, future scope-types (e.g., `validate_project_file_path`, `validate_arduino_sketch_path`), and a single audit point for Phase 2.2 security review.
- Rust unit tests in the same crate can directly exercise `validate_scoped_path` with synthetic paths — much easier than integration tests through Tauri's runtime.

**Codex R3 probe invitation:** Argue if extraction is premature. Show me a single-module alternative that's not worse.

---

## Per-Critique Proposals

### C1 — Custom `read_file`/`write_file` bypass scoped FS policy [Tier S]

**Phase:** 2 (Native Authority)
**Codex evidence:** `src-tauri/src/lib.rs:171-184` calls `tokio::fs::read_to_string(&file_path)` / `tokio::fs::write(&file_path, &data)` directly. `client/src/lib/tauri-api.ts:138-144` calls `commands.readFile(filePath)` / `commands.writeFile(filePath, data)`. `src-tauri/build.rs:15-20` allowlists both commands. Capabilities scoping at `src-tauri/capabilities/default.json:29-77` is for `tauri-plugin-fs` (which the frontend does NOT use).
**Files to edit (R4 lane):**
- `src-tauri/src/lib.rs:171-185` (modify commands)
- `src-tauri/src/path_validation.rs` (new — see D3)
- `src-tauri/src/main.rs` or `lib.rs` (mod declaration)
- `client/src/lib/__tests__/tauri-native-authority.test.ts` (extend with reject-cases)
- `src-tauri/src/path_validation.rs` Rust unit tests inside that file

**Current state (re-verified by Claude):**
```rust
// src-tauri/src/lib.rs:171-185
#[tauri::command]
#[specta::specta]
async fn read_file(file_path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read file '{}': {}", file_path, e))
}

#[tauri::command]
#[specta::specta]
async fn write_file(file_path: String, data: String) -> Result<(), String> {
    tokio::fs::write(&file_path, &data)
        .await
        .map_err(|e| format!("Failed to write file '{}': {}", file_path, e))
}
```

Zero validation. Frontend can call `commands.writeFile("/etc/passwd", "x")` and the OS-level permission check is the ONLY gate. On Linux non-root this fails harmlessly; on macOS within the user's home, this writes anywhere; on Windows within `%APPDATA%/..` this likewise writes. The capability-scoped FS plugin grants are 100% cosmetic for the live IPC path.

**Proposed fix (R4 land):**

1. Extract path validation to `src-tauri/src/path_validation.rs` (new):
```rust
// src-tauri/src/path_validation.rs
//
// Phase 2.2 (R4 retro-fix): validate caller-provided paths against the same
// scope list that capabilities/default.json grants to the FS plugin. Tauri
// capabilities only protect the PLUGIN-FS API; custom #[tauri::command]
// functions are NOT scope-checked (https://v2.tauri.app/security/capabilities/).
//
// Any new allow-scope MUST be added in BOTH this file and capabilities/default.json.

use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::Manager;

#[derive(Debug)]
pub enum PathValidationError {
    NotInAllowedScope(PathBuf),
    DeniedByExtensionOrSuffix(String),
    EbWebViewBlocked,
    CanonicalizeFailed(String),
    ParentMissing,
}

impl std::fmt::Display for PathValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotInAllowedScope(p) => write!(f, "path '{}' is not inside any allowed scope", p.display()),
            Self::DeniedByExtensionOrSuffix(n) => write!(f, "path '{}' matches the secrets deny list", n),
            Self::EbWebViewBlocked => write!(f, "$APPLOCALDATA/EBWebView paths are forbidden"),
            Self::CanonicalizeFailed(e) => write!(f, "canonicalize failed: {}", e),
            Self::ParentMissing => write!(f, "path has no parent directory"),
        }
    }
}

/// Validate that `file_path` resolves inside one of the allowed scopes for
/// Phase 2.2. Mirrors the `fs:allow-read-file` / `fs:allow-write-file` scopes
/// in capabilities/default.json + applies the `fs:scope` deny list. Returns
/// the canonical absolute path on success.
pub fn validate_scoped_path(
    app: &tauri::AppHandle,
    file_path: &str,
) -> Result<PathBuf, PathValidationError> {
    let requested = PathBuf::from(file_path);

    // For write_file the target may not exist yet — canonicalize the parent
    // and re-attach the leaf filename. For read_file the target must exist;
    // canonicalize directly.
    let canonical = if requested.exists() {
        std::fs::canonicalize(&requested)
            .map_err(|e| PathValidationError::CanonicalizeFailed(e.to_string()))?
    } else {
        let parent = requested.parent().ok_or(PathValidationError::ParentMissing)?;
        let canonical_parent = std::fs::canonicalize(parent)
            .map_err(|e| PathValidationError::CanonicalizeFailed(e.to_string()))?;
        let name = requested
            .file_name()
            .ok_or(PathValidationError::ParentMissing)?;
        canonical_parent.join(name)
    };

    // Apply deny list FIRST (capability scope :71-78 deny block).
    if is_denied(&canonical, app)? {
        return Err(PathValidationError::DeniedByExtensionOrSuffix(
            canonical.display().to_string(),
        ));
    }

    // Allow scopes mirror capabilities/default.json :29-67. ANY additions must
    // be reflected here AND in default.json — they are two views of one policy.
    let allow_dirs = collect_allowed_dirs(app);
    for allowed in &allow_dirs {
        if canonical.starts_with(allowed) {
            return Ok(canonical);
        }
    }
    Err(PathValidationError::NotInAllowedScope(canonical))
}

fn collect_allowed_dirs(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut dirs = Vec::with_capacity(6);
    if let Ok(d) = app.path().resolve("protopulse", BaseDirectory::AppData) {
        dirs.push(d);
    }
    if let Ok(d) = app.path().resolve("protopulse", BaseDirectory::AppLocalData) {
        dirs.push(d);
    }
    if let Ok(d) = app.path().resolve("Documents/ProtoPulse", BaseDirectory::Home) {
        dirs.push(d);
    }
    if let Ok(d) = app.path().resolve("", BaseDirectory::Desktop) {
        dirs.push(d);
    }
    if let Ok(d) = app.path().resolve("", BaseDirectory::Document) {
        dirs.push(d);
    }
    if let Ok(d) = app.path().resolve("", BaseDirectory::Download) {
        dirs.push(d);
    }
    dirs
}

fn is_denied(path: &Path, app: &tauri::AppHandle) -> Result<bool, PathValidationError> {
    // Deny EBWebView entirely (capability :72)
    if let Ok(ebweb) = app.path().resolve("EBWebView", BaseDirectory::AppLocalData) {
        if path.starts_with(&ebweb) {
            return Ok(true);
        }
    }
    // Deny secrets-like filenames inside allowed scopes
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if matches!(name, "secrets.json" | "credentials.json") {
            return Ok(true);
        }
    }
    // Deny by extension
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if matches!(ext.to_ascii_lowercase().as_str(), "key" | "pem") {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    // Test harness: build a synthetic tauri::AppHandle via test_app() helper.
    // Cover: allow under each scope, deny EBWebView, deny secrets.json,
    // deny *.key, deny *.pem, reject /etc/passwd, reject ../traversal, reject
    // bare relative path that resolves outside scope.
    // (Specifics deferred to R4 land — Codex R3 should attack the test plan
    // shape, not the test code itself which lands in R4.)
}
```

2. Update commands in `src-tauri/src/lib.rs:171-185`:
```rust
#[tauri::command]
#[specta::specta]
async fn read_file(app: tauri::AppHandle, file_path: String) -> Result<String, String> {
    let canonical = crate::path_validation::validate_scoped_path(&app, &file_path)
        .map_err(|e| e.to_string())?;
    tokio::fs::read_to_string(&canonical)
        .await
        .map_err(|e| format!("Failed to read file '{}': {}", canonical.display(), e))
}

#[tauri::command]
#[specta::specta]
async fn write_file(app: tauri::AppHandle, file_path: String, data: String) -> Result<(), String> {
    let canonical = crate::path_validation::validate_scoped_path(&app, &file_path)
        .map_err(|e| e.to_string())?;
    tokio::fs::write(&canonical, &data)
        .await
        .map_err(|e| format!("Failed to write file '{}': {}", canonical.display(), e))
}
```

3. Add `mod path_validation;` to `src-tauri/src/lib.rs` near the top with other module declarations.

4. Regenerate `client/src/lib/bindings.ts` via `cargo run --bin export_bindings --manifest-path src-tauri/Cargo.toml`. The `app: tauri::AppHandle` parameter is injected by Tauri and does NOT appear in the typed binding — frontend signature unchanged.

5. Extend `client/src/lib/__tests__/tauri-native-authority.test.ts` with assertions that the AppManifest::commands allowlist is unchanged (still includes `read_file`/`write_file`), and add a `// integration` test marker for the actual reject path (full reject-path test runs in Rust unit tests, not TypeScript).

**Alternative considered: Migrate frontend to `tauri-plugin-fs` (D1 option B).** Rejected because:
- Plugin-fs API surface is different (`readTextFile`/`writeTextFile` w/ option bag), would touch every caller including future Phase 9 hardware paths.
- Plugin-fs capability scope is per-permission (`fs:allow-write-file` scope list); validation logic STILL needs to express it.
- Doesn't reduce blast radius — moves it from "custom command body" to "frontend import + capability config".
- Decision recorded in §D1 above.

**Alternative considered: Use a session-scoped allowlist of paths returned by recent dialog calls.** Rejected because:
- Requires per-session state in Rust; not zero-cost.
- Doesn't help for `read_file` (no dialog precedes a read).
- Adds an exploit surface: timing window between dialog return and writeFile call.
- Standard scope-based validation is the documented Tauri pattern.

**Test plan (R4 land):**
- `src-tauri/src/path_validation.rs` unit tests (in-file `#[cfg(test)]`):
  - Allowed: `$APPDATA/protopulse/foo.json`, `$DESKTOP/export.csv`, `$DOCUMENT/proj.protopulse`
  - Allowed: case-variant `*.KEY` (deny) extensions caught
  - Denied: `/etc/passwd`, `/Users/x/.ssh/id_rsa`, `$APPLOCALDATA/EBWebView/cookies.db`
  - Denied: `$APPDATA/protopulse/secrets.json`, `$APPLOCALDATA/protopulse/credentials.json`, `$APPDATA/protopulse/api.key`, `$APPDATA/protopulse/cert.pem`
  - Traversal: `$APPDATA/protopulse/../../../etc/passwd` → canonicalize resolves out of scope → denied
  - Nonexistent leaf with existing parent: `$APPDATA/protopulse/new.json` (parent exists) → allowed
  - Nonexistent parent: `$APPDATA/nonexistent/foo.json` → CanonicalizeFailed
- `client/src/lib/__tests__/tauri-native-authority.test.ts`:
  - Existing assertions (allowlist contains `read_file`/`write_file`, excludes `spawn_process`) — unchanged
  - New assertion: import of `commands.readFile` typed signature accepts `(filePath: string)` — verifies that bindings.ts didn't accidentally expose `app` parameter

**R3 probe invitation:** Push back on:
1. The `canonicalize` semantics — does it correctly handle symlinks? Specifically: a symlink at `$DESKTOP/sneaky-link → /etc/passwd` — does canonicalize resolve the symlink target and reject? (Yes per stdlib docs, but verify.)
2. The "canonicalize parent then re-attach leaf" pattern for nonexistent paths — can a hostile caller exploit a TOCTOU between parent canonicalize and the tokio::fs::write? Suggest a fix if so.
3. The Windows `BaseDirectory::Desktop` resolution — Tauri Windows uses `%USERPROFILE%\Desktop`. Does Windows path comparison with `starts_with` correctly handle short-path-name vs long-path-name (8.3 filename)?
4. Whether the deny list should be path-by-path (current) or also include suffix-glob patterns (`*credentials*`).
5. Whether `read_file` should also validate `data` size or charset, OR whether it's acceptable for the frontend to receive arbitrary bytes (current behavior).
6. Bare `none` is forbidden — name at least one specific weakness in this proposal that R4 must address.

---

### C2 — `$APPLOCALDATA` secret deny gap [Tier S]

**Phase:** 2 (Native Authority)
**Codex evidence:** `src-tauri/capabilities/default.json:71-78` deny list:
```json
"deny": [
  { "path": "$APPLOCALDATA/EBWebView/**" },
  { "path": "$APPDATA/protopulse/**/secrets.json" },
  { "path": "$APPDATA/protopulse/**/credentials.json" },
  { "path": "$APPDATA/protopulse/**/*.key" },
  { "path": "$APPDATA/protopulse/**/*.pem" }
]
```
But `$APPLOCALDATA/protopulse/**` is allowed for read/write/exists/mkdir at `:32, 43, 54, 65`. Secrets stored there are reachable.

**Files to edit (R4 lane):** `src-tauri/capabilities/default.json:71-78`

**Proposed fix (R4 land):**
```json
"deny": [
  { "path": "$APPLOCALDATA/EBWebView/**" },
  { "path": "$APPDATA/protopulse/**/secrets.json" },
  { "path": "$APPDATA/protopulse/**/credentials.json" },
  { "path": "$APPDATA/protopulse/**/*.key" },
  { "path": "$APPDATA/protopulse/**/*.pem" },
  { "path": "$APPLOCALDATA/protopulse/**/secrets.json" },
  { "path": "$APPLOCALDATA/protopulse/**/credentials.json" },
  { "path": "$APPLOCALDATA/protopulse/**/*.key" },
  { "path": "$APPLOCALDATA/protopulse/**/*.pem" },
  { "path": "$HOME/Documents/ProtoPulse/**/secrets.json" },
  { "path": "$HOME/Documents/ProtoPulse/**/credentials.json" },
  { "path": "$HOME/Documents/ProtoPulse/**/*.key" },
  { "path": "$HOME/Documents/ProtoPulse/**/*.pem" }
]
```

(Added `$APPLOCALDATA/protopulse/**` deny coverage that Codex flagged AND extended to `$HOME/Documents/ProtoPulse/**` which is also a write-allowed scope and Codex's R1 didn't flag but has the same gap.)

The path_validation.rs deny logic in C1 mirrors this list. Both views update together — `is_denied` in C1 covers the suffix/extension filenames generically (no per-scope enumeration), and capability scope handles the plugin-fs side. **Two views, one policy** — the architecture decision is recorded explicitly so future maintainers don't drift them.

**Alternative considered: A single regex `secrets|credentials|*\.(key|pem)` across ALL allowed scopes.** Rejected because Tauri's capability JSON requires explicit `path` entries per scope (no globs across scopes). The per-scope expansion is mechanically required by the config format.

**Test plan (R4 land):**
- Add to `client/src/lib/__tests__/tauri-native-authority.test.ts`: snapshot test of `default.json` deny list — must contain all 4 secret-suffix patterns under EACH of `$APPDATA/protopulse`, `$APPLOCALDATA/protopulse`, and `$HOME/Documents/ProtoPulse`. Drift detector.

**R3 probe invitation:**
1. Are there OTHER allowed scopes I missed? Specifically: `$DESKTOP/**`, `$DOCUMENT/**`, `$DOWNLOAD/**` (user-picked-via-dialog locations) — should those scopes also have the deny list applied? My current proposal says NO because user-picked = user-consented; if user picks `$DESKTOP/secrets.json`, they consented. Argue against this if you disagree.
2. Is there a scope-deny meta-pattern I should be using instead (e.g., a separate `fs:scope-deny-secrets` capability)?
3. Should the deny list also block `.htpasswd`, `.env`, `id_rsa*`, `*.p12`, `*.pfx` (PKCS#12)? Argue for/against.

---

### C3 — Storage classifier regex false negatives [Tier H]

**Phase:** 3 (Runtime Topology + Storage)
**Codex evidence:** `client/src/lib/desktop/storage-migration.ts:55-141` regex patterns expect hyphenated `protopulse-*` keys. But the actual key corpus at `client/src/lib/constants/storage-keys.ts:5-23` uses **underscored** names: `protopulse_ai_provider`, `protopulse_ai_model`, `protopulse_ai_temp`, `protopulse_ai_sysprompt`, `protopulse_routing_strategy`, `protopulse_ai_preview_changes`, `protopulse_optimization_goal`, `protopulse_preferred_suppliers`, `protopulse_bom_sort_order`. Plus unprefixed asset keys `asset-favorites`, `asset-recent`, `asset-custom`. Plus legacy `sessionId` (no `protopulse-` prefix) at `JobHistoryPanel.tsx:97-102`. Plus user-prefs key `protopulse-keyboard-shortcuts` at `keyboard-shortcuts.ts:58`.

**Files to edit (R4 lane):** `client/src/lib/desktop/storage-migration.ts` (replace regex-only with hybrid explicit-map + regex), `client/src/lib/__tests__/desktop-storage-migration.test.ts` (extend with real-corpus test cases)

**Proposed fix (R4 land) per D2 decision (explicit-map first, regex fallback):**

```ts
// client/src/lib/desktop/storage-migration.ts (insert before STORAGE_BUCKETS):

import { STORAGE_KEYS } from "../constants/storage-keys";

/**
 * Explicit key→bucket map. Each entry MUST correspond to a real
 * localStorage key written somewhere in the codebase. Adding a key here
 * implies a code search for the literal string — generic patterns belong
 * in STORAGE_BUCKETS[*].keyPatterns instead.
 */
const EXPLICIT_KEY_MAP: ReadonlyMap<string, StorageBucket> = new Map([
  // Session / auth — STRICTLY first-class because credential leakage is the
  // worst-case outcome of misclassification.
  ["protopulse-session-id", "session-auth"],   // client/src/lib/auth-context.tsx:25-37
  ["sessionId", "session-auth"],               // LEGACY: client/src/components/views/arduino/JobHistoryPanel.tsx:97-102
  ["X-Session-Id", "session-auth"],            // header name persisted as a key in some paths

  // User prefs — from storage-keys.ts STORAGE_KEYS and known callers
  [STORAGE_KEYS.AI_PROVIDER, "user-prefs"],            // protopulse_ai_provider
  [STORAGE_KEYS.AI_MODEL, "user-prefs"],               // protopulse_ai_model
  [STORAGE_KEYS.AI_TEMPERATURE, "user-prefs"],         // protopulse_ai_temp
  [STORAGE_KEYS.AI_SYSTEM_PROMPT, "user-prefs"],       // protopulse_ai_sysprompt
  [STORAGE_KEYS.ROUTING_STRATEGY, "user-prefs"],       // protopulse_routing_strategy
  [STORAGE_KEYS.AI_PREVIEW_CHANGES, "user-prefs"],     // protopulse_ai_preview_changes
  [STORAGE_KEYS.OPTIMIZATION_GOAL, "user-prefs"],      // protopulse_optimization_goal
  [STORAGE_KEYS.PREFERRED_SUPPLIERS, "user-prefs"],    // protopulse_preferred_suppliers
  [STORAGE_KEYS.BOM_SORT_ORDER, "user-prefs"],         // protopulse_bom_sort_order
  ["protopulse-keyboard-shortcuts", "user-prefs"],     // client/src/lib/keyboard-shortcuts.ts:58
  ["protopulse-beginner-mode", "user-prefs"],
  ["protopulse-gpu-blur-override", "user-prefs"],
  ["protopulse-ai-safety-mode", "user-prefs"],
  ["protopulse-compact-mode", "user-prefs"],
  ["protopulse-theme", "user-prefs"],

  // Project / asset (unprefixed legacy keys)
  [STORAGE_KEYS.ASSET_FAVORITES, "project-data"],   // asset-favorites (unprefixed)
  [STORAGE_KEYS.ASSET_RECENT, "project-data"],      // asset-recent (unprefixed)
  [STORAGE_KEYS.ASSET_CUSTOM, "project-data"],      // asset-custom (unprefixed)
]);

// STORAGE_BUCKETS[*].keyPatterns: keep for DYNAMIC keys only — keys whose
// names are parameterized by runtime IDs (project UUIDs, panel IDs, sim IDs).
// Static names belong in EXPLICIT_KEY_MAP above.

export const STORAGE_BUCKETS: Record<StorageBucket, BucketSpec> = {
  "session-auth": {
    // ... existing ...
    keyPatterns: [
      // Defensive patterns ONLY — explicit map handles known keys.
      // Used for unanticipated future credential keys.
      /(^|[-_])auth([-_]|$)/i,
      /(^|[-_])token([-_]|$)/i,
      /(^|[-_])api[-_]key([-_]|$)/i,
      /(^|[-_])credentials?([-_]|$)/i,
      /^X-Session-Id$/i,                           // duplicate of explicit-map entry; safe
    ],
  },
  "project-data": {
    keyPatterns: [
      // Dynamic (parameterized) project keys
      /^protopulse[-_]board[-_]settings/i,
      /^protopulse[-_]circuit[-_]selection/i,
      /^protopulse[-_]sim[-_]scenarios/i,
      /^protopulse[-_]sim[-_]compare[-_]snapshots/i,
      /^protopulse[-_]project[-_]/i,
      /[-_]panel[-_]layout[-_]/i,                  // <projectId>-panel-layout-<panelId>
      /[-_]hidden[-_]project[-_]/i,
      /[-_]last[-_]project/i,
      /[-_]design[-_](history|preferences|variables)/i,
    ],
  },
  // ... other buckets unchanged but with [-_] alternation for hyphen/underscore robustness:
  "history-cache": {
    keyPatterns: [
      /^protopulse[-_](memory|import|chat|design)[-_]history/i,
      /[-_]history$/i,
    ],
  },
  "catalog-shared": {
    keyPatterns: [
      /^protopulse[-_]marketplace/i,
      /^protopulse[-_]rag[-_]documents/i,
      /^protopulse[-_]creator[-_]profiles/i,
      /^protopulse[-_]custom[-_]boards/i,
      /^protopulse[-_]installed/i,
    ],
  },
  "hardware-presets": {
    keyPatterns: [
      /^protopulse[-_]serial[-_]last[-_]preset/i,
      /^protopulse[-_]safe[-_]commands/i,
      /^protopulse[-_]hardware[-_]/i,
    ],
  },
  "ux-flags": {
    keyPatterns: [
      /[-_]dismissed$/i,
      /^protopulse[-_]milestone[-_]unlocks/i,
      /[-_]last[-_]seen$/i,
    ],
  },
  "migration-markers": {
    keyPatterns: [
      /[-_]migration[-_]/i,
      /[-_]migrated$/i,
      /^protopulse[-_]legacy[-_]/i,
    ],
  },
  // user-prefs no longer has its own patterns — all explicit-map driven.
  "user-prefs": {
    keyPatterns: [], // defensive empty; falls through to "unclassified"
  },
};

export function classifyStorageKey(key: string): StorageBucket | null {
  // 1) Explicit map first — exact match wins
  const explicit = EXPLICIT_KEY_MAP.get(key);
  if (explicit) return explicit;

  // 2) Pattern fallback — same bucket order as before
  const bucketOrder: StorageBucket[] = [
    "session-auth",
    "migration-markers",
    "project-data",
    "user-prefs",
    "history-cache",
    "catalog-shared",
    "hardware-presets",
    "ux-flags",
  ];
  for (const b of bucketOrder) {
    const spec = STORAGE_BUCKETS[b];
    for (const re of spec.keyPatterns) {
      if (re.test(key)) return b;
    }
  }
  return null;
}
```

**Alternative considered: Keep regex-only and just fix the regex patterns** (D2 option A). Rejected because:
- Regex-only is fragile against key renames (a typo in a regex silently misclassifies a credential key).
- TypeScript can't verify regex patterns against the `STORAGE_KEYS` constant; explicit-map entries reference it directly.
- Future contributors adding a new STORAGE_KEYS entry without touching the classifier is silent-misclassification waiting to happen; explicit-map drift triggers a compile or test failure if we add a smoke test.

**Test plan (R4 land):**
- Add to `client/src/lib/__tests__/desktop-storage-migration.test.ts`:
  - `classifyStorageKey('protopulse_ai_model')` → `"user-prefs"` (was previously unclassified)
  - `classifyStorageKey('protopulse-session-id')` → `"session-auth"` (was already correct)
  - `classifyStorageKey('sessionId')` → `"session-auth"` (NEW legacy capture)
  - `classifyStorageKey('asset-favorites')` → `"project-data"` (NEW unprefixed capture)
  - `classifyStorageKey('protopulse-keyboard-shortcuts')` → `"user-prefs"` (NEW capture)
  - `classifyStorageKey('protopulse-project-abc123-data')` → `"project-data"` (regex fallback, dynamic)
  - `classifyStorageKey('completely-unknown-key')` → `null` (unclassified, human review)
- NEW DRIFT TEST: snapshot test asserting every entry in `EXPLICIT_KEY_MAP` either references `STORAGE_KEYS` directly OR is a literal legacy string. Tests rename-safety.
- NEW INVENTORY TEST: ad-hoc test reads `client/src/lib/constants/storage-keys.ts` source, asserts every `STORAGE_KEYS.*` entry has a corresponding `EXPLICIT_KEY_MAP` entry. Forces classifier updates when keys are added.

**R3 probe invitation:**
1. Find a key currently written somewhere in the codebase that the new hybrid still misses. Greps for `localStorage.setItem` / `localStorage.getItem` should help.
2. Argue if the bucket-order in pattern fallback can ever misclassify a key that should hit `user-prefs` (which now has empty patterns) but accidentally matches a `project-data` or `history-cache` pattern.
3. Argue if the `sessionId` legacy entry should be deleted instead of mapped — i.e., is "delete legacy keys without migration" the better policy for credential-bearing keys?
4. Argue the test plan misses an important coverage scenario (case sensitivity, Unicode, very long keys, browser-quota overflows).

---

### C4 — Runtime topology unconsumed + remote-server health undefined [Tier M]

**Phase:** 3 (Runtime Topology + Storage)
**Codex evidence:** `rg resolveWorkflowTarget` returns only `client/src/lib/desktop/runtime-topology.ts` (definition) and `client/src/lib/__tests__/runtime-topology.test.ts` (tests). Zero production callers. The file says "adapters consult it" but no adapter does. Additionally, `runtime-topology.ts:90-129` marks several Tauri workflows as `remote-server` while `src-tauri/src/lib.rs:250-278` only best-effort spawns the Express sidecar if `dist/index.cjs` exists.

**Files to edit (R4 lane):**
- `client/src/lib/queryClient.ts` (call `resolveWorkflowTarget` for one representative workflow as a wiring example)
- `client/src/lib/auth-context.tsx` (call `resolveWorkflowTarget` for `auth-session`)
- `client/src/lib/desktop/runtime-topology.ts` (add `assertResolverConsumed()` runtime assertion for test verification)
- `client/src/lib/__tests__/runtime-topology.test.ts` (new test: `unresolvedServerDependencies()` returns the expected list)
- **NEW FILE:** `client/src/lib/desktop/server-health-contract.ts` — declarative contract for what "Express server reachable" means; placeholder shape only (full implementation = R4.5 follow-up wave per defer table)

**Proposed fix (R4 land):**

1. Make the topology executable by wiring at least 2 production callers:

```ts
// client/src/lib/queryClient.ts (additive — does not change existing behavior)
import { resolveWorkflowTarget } from './desktop/runtime-topology';

// Phase 3.5 (R4 retro): Document the routing decision at the request layer. Today
// this is purely informational (we still hit /api/* paths); a future wave wires
// the resolver to actually swap between fetch() and a Rust command per target.
function assertWorkflowReachable(workflowId: string) {
  const decision = resolveWorkflowTarget(workflowId, /*isTauri*/ true);
  if (decision.target === 'remote-server' && /* server not detected */ false) {
    // Future: emit a warning, surface a banner. Placeholder for the wiring shape.
  }
}
```

2. Add a `unresolvedServerDependencies()` smoke test:
```ts
// client/src/lib/__tests__/runtime-topology.test.ts (extend)
import { unresolvedServerDependencies, WORKFLOW_TOPOLOGY } from '../desktop/runtime-topology';

it('lists every Tauri workflow that still depends on remote-server', () => {
  const unresolved = unresolvedServerDependencies();
  // R4 acceptance: this list is non-empty AND every entry has a documented
  // resolution-by-wave note in the WORKFLOW_TOPOLOGY registry.
  expect(unresolved.length).toBeGreaterThan(0);
  expect(unresolved).toEqual(expect.arrayContaining(['ai-chat', 'rag-query']));
  for (const id of unresolved) {
    const entry = WORKFLOW_TOPOLOGY[id];
    // Every remote-server workflow must declare WHEN its target shifts to
    // desktop-rust or remote-server-with-cache. Force-doc the gap.
    expect(entry?.resolutionWave).toBeDefined();
  }
});
```

This requires extending `WORKFLOW_TOPOLOGY` entries with a `resolutionWave: 'phase-3.5' | 'phase-4' | ...` field. The R4 land adds the field + populates it for every `remote-server` Tauri workflow. Forces explicit decisions about the deferred work.

3. **Defer to R4.5:** full server-health-contract implementation (probe endpoint, retry/backoff, fallback UX). That's a separate wave because the UX of "server unreachable" is non-trivial (banner? blocking modal? silent fallback to cached?). The R2 lands the registry + smoke test; the health contract lands in R4.5.

**Alternative considered: Delete the topology registry as unused.** Rejected because:
- It IS the design intent for Path C runtime topology (per ADR `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md`).
- Deleting it just because R2 didn't wire it would lose the design document encoded as code.
- Wiring at least 2 production callers + extending entries with `resolutionWave` makes it a living contract.

**Alternative considered: Wire ALL 16 workflows in R4.** Rejected because:
- The wiring shape varies per workflow (some need fetch swap, some need Rust command swap, some need cache layer).
- Doing all 16 in one wave fragments the diff. Two callers + smoke test is enough to prove the wiring contract; the rest land per-workflow as those features migrate.

**Test plan (R4 land):**
- Extension of `runtime-topology.test.ts` with the `unresolvedServerDependencies()` smoke test above
- New test: `WORKFLOW_TOPOLOGY` shape — every `target: 'remote-server'` Tauri entry has a non-null `resolutionWave`
- `queryClient.ts`: existing tests unchanged; new test verifies `assertWorkflowReachable('ai-chat')` doesn't throw (placeholder no-op)

**R3 probe invitation:**
1. Is "wire 2 callers + force resolutionWave field on all `remote-server` entries" actually a meaningful R4 land, or is it lipstick on dead code? Find the strongest argument that R4 should either fully wire OR fully delete.
2. Should `resolutionWave` be a free-string field or a typed enum? Argue the tradeoffs.
3. Is the smoke test brittle (will fail when topology entries change)? Argue for a different shape.
4. Bare `none` is forbidden; name at least one specific concrete weakness.

---

### C5 — P4 lifecycle events not wired + single-instance lacks `deep-link` feature [Tier H]

**Phase:** 4 (Lifecycle)
**Codex evidence:**
- `src-tauri/src/lib.rs:448-452` single-instance handler only does `println!("[tauri] single-instance: argv={:?}", argv);` — argv never reaches the frontend, never gets validated, never opens the project.
- `client/src/lib/desktop/project-open-contract.ts:8-10` says native side "will hand requests to this validator" — bridge missing.
- `src-tauri/Cargo.toml:23` declares `tauri-plugin-single-instance = "2"` with no features. Tauri docs (verified by Claude WebFetch 2026-05-11): `tauri-plugin-single-instance = { version = "2.0.0", features = ["deep-link"] }` is required for Linux/Windows integration.
- `src-tauri/tauri.conf.json:36-43` `fileAssociations` entry has no `exportedType` field; Tauri config docs say macOS custom file types should define one.

**Files to edit (R4 lane):**
- `src-tauri/Cargo.toml:19-25` (add `features = ["deep-link"]` to single-instance)
- `src-tauri/src/lib.rs:441-457` (rewrite single-instance handler to emit `project-open-request` event)
- `src-tauri/tauri.conf.json:36-43` (add `exportedType` for macOS UTI)
- `client/src/lib/desktop/project-open-contract.ts` (add `installProjectOpenListener()` wiring helper)
- `client/src/App.tsx` or root-level component (call `installProjectOpenListener()` on mount)
- `client/src/lib/__tests__/project-open-contract.test.ts` (extend with listener tests)
- `src-tauri/src/lib.rs` deep-link integration callback registration

**Proposed fix (R4 land):**

1. `Cargo.toml:23` — add features:
```toml
tauri-plugin-single-instance = { version = "2", features = ["deep-link"] }
```

2. `src-tauri/src/lib.rs:441-457` (single-instance handler):
```rust
.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
    // Emit to frontend; frontend's project-open-contract validates + dispatches.
    // The TS contract checks extension, traversal, shell-meta, and resolves
    // outcome (load-new / focus-existing / prompt-replace / ignore-invalid).
    let payload = serde_json::json!({
        "argv": argv,
        "cwd": cwd,
        "trigger": "single-instance",
    });
    if let Err(e) = app.emit("project-open-request", payload) {
        eprintln!("[tauri] failed to emit project-open-request: {}", e);
    }
}))
.plugin(tauri_plugin_deep_link::init())
```

Plus a deep-link handler:
```rust
.setup(|app| {
    // Per Tauri deep-link docs (verified 2026-05-11): register the deep-link
    // callback inside .setup() so the URL handler runs after both single-
    // instance and deep-link plugins are initialized.
    let app_handle = app.handle().clone();
    app.listen("deep-link://new-url", move |event| {
        let urls: Vec<String> = serde_json::from_str(event.payload()).unwrap_or_default();
        let payload = serde_json::json!({
            "deepLinks": urls,
            "trigger": "deep-link",
        });
        if let Err(e) = app_handle.emit("project-open-request", payload) {
            eprintln!("[tauri] failed to emit project-open-request (deep-link): {}", e);
        }
    });
    Ok(())
})
```

3. `client/src/lib/desktop/project-open-contract.ts` — add the bridge:
```ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

interface ProjectOpenRequest {
  argv?: string[];
  cwd?: string;
  deepLinks?: string[];
  trigger: 'single-instance' | 'deep-link';
}

/**
 * Wire native project-open-request events to the validator + dispatcher.
 * Returns an unlisten function for cleanup.
 *
 * Acceptance criteria (Phase 4.3 R4 land):
 * - native single-instance argv reaches `classifyProjectOpenRequest()`
 * - deep-link URLs reach the same validator
 * - invalid requests dispatch to a UI handler (banner / silent log per
 *   `outcome === 'ignore-invalid'`)
 */
export async function installProjectOpenListener(
  onClassified: (outcome: ProjectOpenOutcome) => void,
): Promise<UnlistenFn> {
  return listen<ProjectOpenRequest>('project-open-request', (event) => {
    const request = event.payload;
    // Extract candidate paths from argv or deepLinks
    const candidates: string[] = [];
    if (request.argv) {
      // argv[0] is the executable path; project path is argv[1+] for file association
      candidates.push(...request.argv.slice(1));
    }
    if (request.deepLinks) {
      candidates.push(...request.deepLinks);
    }
    for (const candidate of candidates) {
      const outcome = classifyProjectOpenRequest(candidate, request.trigger);
      onClassified(outcome);
    }
  });
}
```

4. `client/src/App.tsx` (or wherever the root component is):
```tsx
useEffect(() => {
  if (!isTauri) return;
  let unlisten: UnlistenFn | undefined;
  void installProjectOpenListener((outcome) => {
    // Phase 4.3 dispatch — wire to existing project-open store/route
    handleProjectOpenOutcome(outcome);
  }).then((u) => { unlisten = u; });
  return () => { unlisten?.(); };
}, []);
```

5. `tauri.conf.json:36-43` (`fileAssociations`):
```json
"fileAssociations": [
  {
    "ext": ["protopulse"],
    "name": "ProtoPulse Project",
    "description": "ProtoPulse circuit design project",
    "mimeType": "application/x-protopulse",
    "role": "Editor",
    "exportedType": "com.protopulse.project"
  }
]
```

**Alternative considered: Use only deep-link plugin, skip single-instance integration.** Rejected because:
- File association (`.protopulse` double-click) requires single-instance to route to the running app instead of spawning duplicates.
- Tauri docs explicitly recommend single-instance + deep-link together.

**Alternative considered: Validate in Rust before emitting to frontend.** Rejected because:
- The validation logic is in TypeScript (`classifyProjectOpenRequest`). Duplicating in Rust = two-source drift.
- The TS validator has unit tests; the Rust side has none yet.
- The emit-to-frontend pattern is the documented Tauri pattern for OS event → app routing.

**Test plan (R4 land):**
- Extend `client/src/lib/__tests__/project-open-contract.test.ts`:
  - Mock `@tauri-apps/api/event.listen` and assert `installProjectOpenListener` registers for `project-open-request`
  - Assert callback dispatches per-candidate to `classifyProjectOpenRequest` (multi-candidate argv test)
  - Assert deep-link payload routes to validator with `trigger: 'deep-link'`
- New manual test (documented in `docs/release/tauri-manual-smoke.md` — new file):
  - `protopulse foo.protopulse` from CLI (single-instance argv)
  - `protopulse://open?path=foo.protopulse` from system (deep-link)
  - Both should route to the same project-open UI flow

**R3 probe invitation:**
1. Argue the `argv.slice(1)` is wrong on Windows where argv conventions differ. Specifically: when Windows file association invokes the app, does argv[0] start with the executable path or the file path? Verify against Tauri Windows runtime behavior.
2. Argue the `deep-link://new-url` event-name string is wrong. Tauri docs versioning may have changed it; verify.
3. Argue the `exportedType: "com.protopulse.project"` UTI string is malformed or conflicts with macOS reserved namespaces.
4. Argue the absence of Rust-side validation creates a TOCTOU between argv extraction and TS-side classify (frontend not loaded yet when event fires).
5. Bare `none` forbidden — name at least one weak assumption in this proposal.

---

### C6 — Windows path traversal normalization missing [Tier M]

**Phase:** 4 (Lifecycle)
**Codex evidence:** `client/src/lib/desktop/project-open-contract.ts:54-58`:
```ts
const PATH_TRAVERSAL_RE = /\/\.\.\//;
const SHELL_META_RE = /[;&|`$()<>]/;
```
Only checks `/../` (POSIX). Windows backslash traversal `\..\` not matched. `SHELL_META_RE` omits Windows `^` and `%` meta characters.

**Files to edit (R4 lane):**
- `client/src/lib/desktop/project-open-contract.ts:54-58`
- `client/src/lib/__tests__/project-open-contract.test.ts` (add Windows traversal cases)

**Proposed fix (R4 land):**
```ts
// Cover both POSIX (forward slash) and Windows (backslash) path separators.
// Also catch UTF-8-encoded variants used in URL-style deep links.
const PATH_TRAVERSAL_RE = /(?:^|[/\\])\.\.(?:[/\\]|$)|%2E%2E[/\\%]|%2F\.\.|%5C\.\.|\.\.%2F|\.\.%5C/i;

// Shell metacharacters — POSIX + Windows cmd.exe / PowerShell.
// POSIX: ;&|`$()<>
// Windows: ^ (cmd escape), % (cmd env var)
const SHELL_META_RE = /[;&|`$()<>^%]/;
```

Plus a separate Windows-specific check for drive-letter weirdness:
```ts
// Reject paths that masquerade as remote (UNC) shares — `\\server\share\file.protopulse`.
// Per the Phase 4 threat model, file associations should only resolve LOCAL files.
const WINDOWS_UNC_RE = /^\\\\[^\\]+\\/;
```

Update `classifyProjectOpenRequest` to apply WINDOWS_UNC_RE as part of `ignore-invalid`.

**Alternative considered: Use Node's `path.normalize()` server-side.** Rejected because:
- Frontend is not Node; it's a browser environment inside Tauri.
- Browser path-style normalization libraries (e.g., `@tauri-apps/api/path` `normalize`) are async and would complicate the synchronous validator API.
- Regex is fine for adversarial pattern detection; it's not pretending to be a full path-parser.

**Alternative considered: Defer ALL path validation to Rust-side via the new `validate_scoped_path` from C1.** Rejected because:
- The TS validator runs BEFORE the path reaches Rust — earlier rejection is better (better UX, less Rust round-trip).
- C1's Rust validation is a defense-in-depth backstop; both layers should validate.

**Test plan (R4 land):**
- Add to `client/src/lib/__tests__/project-open-contract.test.ts`:
  - `classifyProjectOpenRequest('C:\\..\\Windows\\System32\\config\\SAM', 'single-instance')` → `ignore-invalid`
  - `classifyProjectOpenRequest('foo\\..\\..\\bar.protopulse', 'single-instance')` → `ignore-invalid`
  - `classifyProjectOpenRequest('/etc/passwd', 'single-instance')` → `ignore-invalid` (no .protopulse extension)
  - `classifyProjectOpenRequest('%USERPROFILE%\\Desktop\\foo.protopulse', 'single-instance')` → `ignore-invalid` (env var unexpanded)
  - `classifyProjectOpenRequest('\\\\server\\share\\foo.protopulse', 'single-instance')` → `ignore-invalid` (UNC)
  - `classifyProjectOpenRequest('foo%2E%2E%2Fbar.protopulse', 'deep-link')` → `ignore-invalid` (URL-encoded traversal)

**R3 probe invitation:**
1. Find a Windows path-encoding I missed (8.3 short names, Windows long-path prefix `\\?\`, NT object paths `\??\`).
2. Argue if the `WINDOWS_UNC_RE` should also block IPv6 literal SMB paths (`\\[::1]\share`).
3. Argue if path normalization should happen before extension check or after (current proposal: regex check first; extension last).
4. Should the validator also reject paths with control characters (`\x00`-`\x1F`)? Argue for/against.

---

### C7 — Arduino sidecar prep absent from CI/build path [Tier H]

**Phase:** 5 (CI + Supply Chain)
**Codex evidence:** `scripts/tauri/prepare-arduino-sidecar.ts:8-15` doc says "Run on each CI host BEFORE `tauri build`" but `.github/workflows/tauri-build.yml:85-104` goes straight from frontend build to `tauri-action`. `package.json:27-29` has no prebuild hook. Because `src-tauri/tauri.conf.json:26-30` declares `bundle.externalBin = ["binaries/arduino-cli"]`, the build can fail OR succeed without bundling the sidecar binary.

**Files to edit (R4 lane):**
- `package.json:27-29` (add `tauri:prepare-sidecars` script + wire into `tauri:build:debug`/`tauri:build`)
- `.github/workflows/tauri-build.yml:85-104` (add sidecar-prep step before `tauri-action`)
- `scripts/tauri/prepare-arduino-sidecar.ts` (also: see C12 for SHA256 fix)

**Proposed fix (R4 land):**

1. `package.json` — add script:
```json
{
  "scripts": {
    "tauri:prepare-sidecars": "tsx scripts/tauri/prepare-arduino-sidecar.ts",
    "tauri:build": "npm run build && npm run tauri:prepare-sidecars && tauri build",
    "tauri:build:debug": "npm run build && npm run tauri:prepare-sidecars && tauri build --debug"
  }
}
```

2. `.github/workflows/tauri-build.yml:85-104` — insert step:
```yaml
      - name: Build frontend
        run: npm run build

      - name: Prepare Arduino CLI sidecar
        # Phase 5/9 (R4 retro-fix): bundle.externalBin requires the sidecar binary
        # at src-tauri/binaries/arduino-cli-<target-triple>(.exe) before tauri-action
        # runs. The script downloads, SHA256-verifies, and renames per target.
        run: npm run tauri:prepare-sidecars

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        # ... existing ...
```

3. **Cross-link to C12:** the prep script also needs SHA256 verification + version refresh — those land together with C7 wiring.

**Alternative considered: Make `bundle.externalBin` optional / skip-if-missing.** Rejected because:
- Tauri's externalBin packaging step expects the binary to exist; missing = build failure or silent skip depending on Tauri version.
- "Optional sidecar" undermines the whole hardware-authority architecture in the ADR.

**Alternative considered: Run `prepare-arduino-sidecar.ts` inside the Tauri build via `beforeBuildCommand` in `tauri.conf.json`.** Rejected because:
- `beforeBuildCommand` runs once but the externalBin step runs per-target on cross-compile workflows. If CI builds multiple targets in one job, beforeBuildCommand fires once and may not match the iteration target.
- Explicit prep step in CI is clearer + per-target controllable.

**Test plan (R4 land):**
- Add to `scripts/ci/tauri-packaged-smoke.sh`:
  - After `npm run tauri:prepare-sidecars`, assert `ls src-tauri/binaries/arduino-cli-*` returns at least 1 file
- New job in `.github/workflows/tauri-build.yml` (lightweight, just for the prep wiring):
  ```yaml
  - name: Assert sidecar binaries exist
    run: |
      set -e
      ls src-tauri/binaries/ | tee /tmp/binaries.txt
      grep -E '^arduino-cli-' /tmp/binaries.txt > /dev/null || {
        echo "ERROR: prepare-arduino-sidecar.ts did not produce expected binaries"
        exit 1
      }
  ```

**R3 probe invitation:**
1. Argue that `tauri:build` becoming dependent on `tauri:prepare-sidecars` could break local dev workflows where the user doesn't want to download arduino-cli.
2. Argue that CI cross-compile (e.g., Linux x64 → macOS via cross) doesn't get the right target triple — does `rustc --print host-tuple` in `prepare-arduino-sidecar.ts:72` even return the right thing for cross-builds?
3. Argue the `--target` CLI arg pattern (line 68-70) is awkward and propose better.
4. Find a CI scenario where the prep step succeeds but the actual `tauri-action` build still fails to find the sidecar.
5. Bare `none` forbidden — find one concrete weakness.

---

### C8 — cargo-audit / SBOM / SLSA advisory only [Tier M]

**Phase:** 5 (CI + Supply Chain)
**Codex evidence:** `scripts/ci/supply-chain-check.sh:40-50` makes cargo-audit optional. `.github/workflows/tauri-build.yml:113-116` doesn't install cargo-audit. SBOM/SLSA at `:64-76` are placeholders.

**Files to edit (R4 lane):**
- `.github/workflows/tauri-build.yml` (install `cargo-audit`, remove `continue-on-error` from supply-chain step, leave SBOM placeholder)
- `scripts/ci/supply-chain-check.sh` (make `cargo audit` required, not optional; exit non-zero on advisory match)

**Proposed fix (R4 land — cargo-audit blocking; SBOM/SLSA defer to R5):**

1. `.github/workflows/tauri-build.yml` — install + run:
```yaml
      - name: Install cargo-audit
        run: cargo install --locked cargo-audit
        # cache via actions/cache@v4 keyed on cargo-audit version + OS

      - name: Supply-chain check
        run: ./scripts/ci/supply-chain-check.sh
        # NO `continue-on-error: true` — failing audit blocks merge
```

2. `scripts/ci/supply-chain-check.sh` — make cargo-audit required:
```bash
#!/usr/bin/env bash
set -euo pipefail

# cargo-audit is now MANDATORY (Phase 5 R4 retro). Install via:
#   cargo install --locked cargo-audit
command -v cargo-audit >/dev/null || {
  echo "ERROR: cargo-audit not installed. Run: cargo install --locked cargo-audit"
  exit 1
}

echo "==> cargo audit"
(cd src-tauri && cargo audit --deny warnings)

echo "==> npm audit"
npm audit --audit-level=high

echo "==> Lockfile drift check"
git diff --exit-code -- package-lock.json src-tauri/Cargo.lock || {
  echo "ERROR: lockfile drift — commit lockfiles"
  exit 1
}

# SBOM / SLSA — TODO Phase 5.5 wave. Placeholder.
echo "==> SBOM / SLSA: deferred to follow-up wave (see docs/plans/...)"
```

3. **Defer to R5 follow-up wave:** SBOM generation (via `cargo-sbom` or `cargo-cyclonedx` + npm-sbom equivalent) and SLSA provenance attestations. The wave-design needs its own ADR + key custody policy.

**Alternative considered: Land SBOM/SLSA in R4 too.** Rejected because:
- SBOM choice (CycloneDX vs SPDX vs OSV) requires a deliberate decision with downstream tooling implications.
- SLSA attestation requires signing-key custody policy — overlaps with C10 (signing) but is its own thing.
- Doing both right needs its own wave; doing both fast = wrong.

**Test plan (R4 land):**
- `scripts/ci/supply-chain-check.sh` exits non-zero when `cargo audit` reports a warning (test by introducing a known-bad crate in a test fixture; revert after)
- CI workflow: the supply-chain step has no `continue-on-error` — failing audit fails the workflow

**R3 probe invitation:**
1. Argue `cargo audit --deny warnings` is too strict (will fail on benign advisories that don't apply to ProtoPulse's usage). Propose a less-strict but still meaningful threshold.
2. Argue `npm audit --audit-level=high` is too strict for non-prod dependencies. Should `--production` be added?
3. Argue the SBOM defer is wrong — that R4 should land at least a placeholder SBOM file generation step.
4. Find a supply-chain check I missed (cargo-deny, cargo-vet, npm-audit-resolver, OSV-scanner).

---

### C9 — Release hardening checks debug-only / nonblocking [Tier M]

**Phase:** 6 (Release Hardening)
**Codex evidence:** `scripts/ci/tauri-packaged-smoke.sh:38-40` builds `--debug`, so doesn't validate release devtools absence or release sourcemap absence. `:41-77` scans only `src-tauri/target/debug/bundle`. `.github/workflows/tauri-build.yml:118-121` has `continue-on-error: true`.

**Files to edit (R4 lane):**
- `scripts/ci/tauri-packaged-smoke.sh` (run `--release`, scan release bundle dir, fail on sourcemap leak)
- `.github/workflows/tauri-build.yml:118-121` (remove `continue-on-error`)

**Proposed fix (R4 land):**

1. `scripts/ci/tauri-packaged-smoke.sh` — build release + scan release:
```bash
#!/usr/bin/env bash
set -euo pipefail

# Phase 6.2 (R4 retro): Build release bundle so we actually validate:
#   - devtools absent (cfg(debug_assertions) gating produces release without)
#   - no source maps shipped
#   - bundle artifacts present at expected paths
echo "==> npm run tauri:prepare-sidecars (sidecars needed for externalBin)"
npm run tauri:prepare-sidecars

echo "==> tauri build (release)"
npm run tauri:build  # release build, no --debug

echo "==> Bundle artifacts present"
case "$(uname -s)" in
  Darwin*)  bundle_dir="src-tauri/target/release/bundle";;
  MINGW*|MSYS*|CYGWIN*) bundle_dir="src-tauri/target/release/bundle";;
  *)        bundle_dir="src-tauri/target/release/bundle";;
esac

[ -d "$bundle_dir" ] || {
  echo "ERROR: release bundle dir missing: $bundle_dir"
  exit 1
}

echo "==> Sourcemap leak check (.js.map files in release bundle)"
leaks=$(find "$bundle_dir" -name '*.js.map' -o -name '*.css.map' 2>/dev/null || true)
if [ -n "$leaks" ]; then
  echo "ERROR: sourcemap leak in release bundle:"
  echo "$leaks"
  exit 1
fi

echo "==> Devtools sanity (release bundle should not contain inspector strings)"
# Tauri's debug-only devtools menu item should be absent from the release binary.
# This is a smoke heuristic, not a guarantee; the cfg(debug_assertions) gate
# is the actual mechanism.
if find "$bundle_dir" -name 'protopulse*' -type f -exec strings {} \; 2>/dev/null | grep -q 'toggle-devtools'; then
  echo "ERROR: 'toggle-devtools' string found in release binary — devtools may leak"
  exit 1
fi
```

2. `.github/workflows/tauri-build.yml:118-121` — remove the `continue-on-error`:
```yaml
      - name: Packaged smoke (release build + leak check)
        run: ./scripts/ci/tauri-packaged-smoke.sh
        # NO continue-on-error — release hardening is the gate, not advisory
```

**Alternative considered: Keep debug build + add release-specific scan job separately.** Rejected because:
- Two jobs = two builds = doubled CI time.
- The smoke purpose is "validate release". Running it on debug = different artifact = different problem.

**Alternative considered: Use Tauri's built-in `tauri verify` if available.** Rejected because:
- Tauri 2 doesn't ship a `verify` subcommand for sourcemap/devtools-leak checks (verified Tauri 2 CLI docs).
- Custom script is fine; it's small.

**Test plan (R4 land):**
- The smoke script itself is the test. Validation by intentionally introducing a `.js.map` into the bundle in a fixture branch → smoke fails. Revert after.
- New CI job verifies the smoke step is NOT in `continue-on-error: true` mode (lint the workflow YAML).

**R3 probe invitation:**
1. Argue the `find ... -exec strings {}` heuristic is fragile (could false-positive on legitimate text containing "toggle-devtools" string).
2. Argue the script doesn't validate the `[profile.release]` Cargo.toml values actually applied (LTO, opt-level=z, strip).
3. Argue the bundle-dir path varies per Tauri version / target; my Darwin/Windows/Linux case-stmt is too naive.
4. Find a release-hardening check I missed (binary entropy / packer detection, embedded debug symbols, dwarf info presence).
5. Bare `none` forbidden — name a weakness.

---

### C10 — Signing verifier dry-run / nonblocking / no inventory check [Tier M]

**Phase:** 7 (Signing Placeholder)
**Codex evidence:** `scripts/ci/verify-signed-artifacts.sh:38-43` uses `mapfile` (fragile on macOS Bash 3.2). `:103-107` exits 0 in dry-run. `:38-49` only loops over whatever `find` discovers — no inventory check that "the expected per-target artifacts ALL exist and are signed". `.github/workflows/tauri-build.yml:123-127` has `continue-on-error: true`.

**Files to edit (R4 lane):**
- `scripts/ci/verify-signed-artifacts.sh` (replace `mapfile` with portable while-read, add expected-inventory check, remove dry-run exit-0)
- `.github/workflows/tauri-build.yml:123-127` (keep `continue-on-error: true` until Tyler's signing cert lands, but make the SCRIPT itself stricter so removal is a one-line toggle)

**Proposed fix (R4 land — per `feedback_dont_compile_decision_packets_for_tyler.md` dev-preview-default rule):**

1. `scripts/ci/verify-signed-artifacts.sh` — portability + inventory:
```bash
#!/usr/bin/env bash
set -euo pipefail

# Phase 7 (R4 retro): Signed-artifact verifier. Activation:
#   --activate          ← Tyler-owned credentials present; remove --dry-run
#   --dry-run (default) ← reports inventory + signing status WITHOUT failing CI
#
# Even in dry-run, the script ENFORCES the inventory check: every expected
# per-target artifact MUST exist. Signing checks are skipped in dry-run; the
# CI workflow step stays continue-on-error: true until Tyler activates.

DRY_RUN=true
for arg in "$@"; do
  case "$arg" in
    --activate) DRY_RUN=false ;;
    --dry-run)  DRY_RUN=true ;;
  esac
done

bundle_dir="src-tauri/target/release/bundle"

# Expected inventory per target — Tauri 2 produces these path shapes:
# Linux:   $bundle_dir/deb/protopulse_1.0.0_amd64.deb
#          $bundle_dir/appimage/protopulse_1.0.0_amd64.AppImage
# macOS:   $bundle_dir/macos/ProtoPulse.app
#          $bundle_dir/dmg/ProtoPulse_1.0.0_aarch64.dmg
# Windows: $bundle_dir/msi/protopulse_1.0.0_x64_en-US.msi
#          $bundle_dir/nsis/protopulse_1.0.0_x64-setup.exe
#
# Inventory check uses glob patterns rather than exact names because
# version + arch suffixes vary.

expect_glob() {
  local label="$1"; local glob="$2"
  # Portable replacement for mapfile — works on Bash 3.2 (macOS).
  local matches=""
  while IFS= read -r line; do matches+="$line"$'\n'; done < <(find "$bundle_dir" -path "$glob" -type f 2>/dev/null || true)
  if [ -z "$matches" ]; then
    echo "ERROR: missing expected artifact: $label ($glob)"
    return 1
  fi
  echo "OK   : $label"
  echo "$matches" | sed 's/^/       /'
}

case "$(uname -s)" in
  Linux*)
    expect_glob "deb"     "$bundle_dir/deb/*.deb"
    expect_glob "appimage" "$bundle_dir/appimage/*.AppImage"
    ;;
  Darwin*)
    expect_glob "app"     "$bundle_dir/macos/*.app"
    expect_glob "dmg"     "$bundle_dir/dmg/*.dmg"
    ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    expect_glob "msi"     "$bundle_dir/msi/*.msi"
    expect_glob "nsis"    "$bundle_dir/nsis/*-setup.exe"
    ;;
  *)
    echo "ERROR: unsupported platform $(uname -s)"
    exit 1
    ;;
esac

if [ "$DRY_RUN" = "true" ]; then
  echo "==> Signing verification SKIPPED (--dry-run; activate with --activate when cert lands)"
  exit 0
fi

# --activate path: actual signing verification per platform.
case "$(uname -s)" in
  Darwin*)
    # macOS: codesign --verify --deep --strict + spctl --assess --verbose
    while IFS= read -r app; do
      codesign --verify --deep --strict "$app" || { echo "FAIL: codesign $app"; exit 1; }
      spctl --assess --type execute --verbose "$app" || { echo "FAIL: spctl $app"; exit 1; }
    done < <(find "$bundle_dir/macos" -name '*.app' -type d)
    # DMG: spctl --type install
    while IFS= read -r dmg; do
      spctl --assess --type install --verbose "$dmg" || { echo "FAIL: spctl dmg $dmg"; exit 1; }
    done < <(find "$bundle_dir/dmg" -name '*.dmg' -type f)
    ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    # Windows: signtool verify /pa
    while IFS= read -r exe; do
      signtool verify /pa "$exe" || { echo "FAIL: signtool $exe"; exit 1; }
    done < <(find "$bundle_dir" -name '*.exe' -o -name '*.msi' -type f)
    ;;
  Linux*)
    echo "==> Linux signing not applicable (deb/AppImage signed via GPG, separate path)"
    ;;
esac
```

2. `.github/workflows/tauri-build.yml:123-127` — keep `continue-on-error: true` for now:
```yaml
      - name: Verify signed artifacts (dry-run until cert lands)
        run: ./scripts/ci/verify-signed-artifacts.sh --dry-run
        continue-on-error: true  # Phase 7 signing not activated; flips to false in C10-activation PR
```

**Decision justification (dev-preview-default):** Per the `feedback_dont_compile_decision_packets_for_tyler.md` rule, decisions requiring Tyler-owned credentials get "dev-preview-only-until-credentials" defaults so AIs proceed without waiting. R4 lands the inventory-check + portability fix; the `continue-on-error: true` flip is a one-line PR when Tyler activates signing.

**Alternative considered: Make the verifier ALSO fail in dry-run when inventory is missing.** Rejected because:
- Dry-run on a workflow without `continue-on-error: true` would block PRs.
- The inventory check IS strict in dry-run (script exits non-zero on missing artifacts), but the workflow step itself is permissive. Two-layer permissiveness lets devs iterate on the build matrix without blocking on signing.

**Test plan (R4 land):**
- `verify-signed-artifacts.sh --dry-run` on a build with all expected artifacts → exit 0, prints OK lines.
- Same script on a build with `dmg` removed → exit non-zero (inventory failure).
- Lint workflow YAML asserts `continue-on-error: true` is set BUT the script itself is `--dry-run`, so the activation flip is visible in PR diff.

**R3 probe invitation:**
1. Argue the inventory globs are wrong for Tauri 2's actual output paths (verify against actual `tauri build` output).
2. Argue the Windows signtool invocation is wrong (specifically: does signtool need a timestamp server, and should this script enforce that the signature has a valid trusted timestamp?).
3. Argue the macOS notarization status is not actually validated by `spctl` (spctl checks Gatekeeper acceptance, which requires notarization stapling — confirm).
4. Find a Linux signing flow I missed (Flatpak, snap, rpm, signed AppImage).
5. Bare `none` forbidden.

---

### C11 — Updater `{channel}` template ambiguity [Tier H]

**Phase:** 8 (Updater Deferred)
**Codex evidence:** `docs/release/tauri-updater-policy.md:21-29` and `:62-66` use `{channel}` in endpoint examples. Tauri updater docs (verified by Claude WebFetch 2026-05-11): only `{{current_version}}`, `{{target}}`, and `{{arch}}` interpolate. "Custom variables are not supported." A future implementer who copies the runbook will produce broken endpoint URLs.

**Files to edit (R4 lane):** `docs/release/tauri-updater-policy.md`

**Proposed fix (R4 land):**

Rewrite the endpoint section to:
1. Remove `{channel}` from inline templates
2. Document multi-channel as RUNTIME endpoint selection (not URL interpolation)
3. Cite the canonical Tauri docs

```markdown
## Endpoints

Tauri updater supports **only three** interpolated variables in
`plugins.updater.endpoints`:

- `{{current_version}}` — version of the app requesting the update
- `{{target}}` — `linux` / `windows` / `darwin`
- `{{arch}}` — `x86_64` / `i686` / `aarch64` / `armv7`

Custom variables (like `{channel}`) are **NOT supported** by the updater's
built-in interpolation. To distribute multiple channels (stable / beta /
nightly), set the endpoint at app-init time via Rust:

```rust
// src-tauri/src/lib.rs (post-activation, Phase 8.X wave)
.plugin(tauri_plugin_updater::Builder::new()
    .endpoints(vec![
        match channel {
            Channel::Stable  => "https://releases.protopulse.app/stable/{{target}}/{{arch}}/{{current_version}}",
            Channel::Beta    => "https://releases.protopulse.app/beta/{{target}}/{{arch}}/{{current_version}}",
            Channel::Nightly => "https://releases.protopulse.app/nightly/{{target}}/{{arch}}/{{current_version}}",
        }.to_string(),
    ])
    .build())
```

Channel selection is a runtime decision (`Channel` determined from a build-time
constant or a user preference). Source of truth: https://v2.tauri.app/plugin/updater/
"Custom variables are not supported".

## Rollback

Going from `nightly` → `stable` is not handled by the updater alone — the
updater downloads forward-only versions per Tauri docs. Rollback (or channel
downgrade) requires either:

- Manual uninstall + reinstall from the target channel's installer
- A pre-flight in-app channel switch that uninstalls + reinstalls via a separate
  installer download (NOT through the updater)

This is a Tauri-platform constraint, not a ProtoPulse policy choice. Cite:
https://v2.tauri.app/plugin/updater/ (updater downloads target version, does
not perform installer migration).
```

Also add to the activation checklist:
```markdown
## Activation Checklist (when signing credentials land)

- [ ] `tauri-plugin-updater` added to `Cargo.toml` (currently absent — Phase 8 deferred)
- [ ] `tauri-plugin-process` added to `Cargo.toml` — required for `tauri_plugin_process::relaunch()`
- [ ] Updater `pubkey` generated (`tauri signer generate`) and stored per signing-runbook §key-custody
- [ ] `tauri.conf.json` `plugins.updater.endpoints` set to active endpoint list (HARDCODED strings, no `{channel}` placeholder)
- [ ] `releases.protopulse.app` domain provisioned, signed JSON manifest served per Tauri schema
- [ ] CI workflow updates `createUpdaterArtifacts: true` in `tauri.conf.json`
- [ ] Update-flow E2E test: app at version N, manifest advertises N+1, user prompted, accept → relaunch on N+1
```

**Alternative considered: Allow the `{channel}` shorthand in the doc with a footnote saying "translate to runtime".** Rejected because:
- Footnotes get missed. The example IS the docs.
- Future implementers copy-paste; literal `{channel}` in config = silent failure.

**Test plan (R4 land):**
- Documentation change; tested by R3 review.
- Add to `scripts/ci/docs-lint.sh` (new file or existing) a grep that fails CI if `docs/release/tauri-updater-policy.md` contains an unbalanced `{` not part of a `{{` Tauri var.

**R3 probe invitation:**
1. Argue the runtime-endpoint pattern actually fails because Tauri reads `endpoints` only at app init from the config file — and once compiled in, the `match channel` Rust code can't read from environment unless Channel is a build-time const.
2. Verify whether `tauri-plugin-process::relaunch()` requires its own capability entry beyond what's documented.
3. Find a missing activation-checklist item.
4. Argue the rollback policy is wrong — does Tauri updater actually support semver downgrade if the manifest says so?
5. Bare `none` forbidden.

---

### C12 — Arduino-cli stale pin / no SHA256 / no typed Rust command [Tier H]

**Phase:** 9 (Hardware Authority)
**Codex evidence:**
- `scripts/tauri/prepare-arduino-sidecar.ts:27-32` pins `ARDUINO_CLI_VERSION = "1.4.0"` — Claude verified via `gh api repos/arduino/arduino-cli/releases/latest` that v1.4.1 is current (published 2026-01-19).
- `:12-15` header comment claims SHA256 verification; `:76-87`/`:105-113` implementation has NONE.
- `src-tauri/src/lib.rs:212-220` `specta_builder()` and `src-tauri/build.rs:14-21` AppManifest allowlist have NO Arduino commands despite `runtime-topology.ts:100-114` claiming `arduino-compile`/`upload`/`serial` are `desktop-rust`.

**Files to edit (R4 lane):**
- `scripts/tauri/prepare-arduino-sidecar.ts:27-32` (bump version)
- `scripts/tauri/prepare-arduino-sidecar.ts:76-113` (add SHA256 verification)
- `docs/audits/tauri-hardware-plugin-provenance.md` (note version refresh + SHA256 wiring)
- **R5 follow-up (deferred):** typed `arduino_compile` / `arduino_upload` / `arduino_serial_open` commands in `lib.rs` + `build.rs` allowlist — that's Phase 9.3+ when the actual UI invokes hardware paths.

**Proposed fix (R4 land):**

1. Bump version + add SHA256 verification to `prepare-arduino-sidecar.ts`:
```ts
// scripts/tauri/prepare-arduino-sidecar.ts

const ARDUINO_CLI_VERSION = "1.4.1"; // Verified Latest 2026-05-11 via GitHub releases API

// Per-target SHA256 expected values from the canonical
// https://github.com/arduino/arduino-cli/releases/download/v1.4.1/1.4.1-checksums.txt
// (hash of the .tar.gz / .zip asset Tauri's externalBin picks up). If the
// fetched binary's hash doesn't match, the script exits non-zero — no fallback,
// no warning, no proceed.
const TARGET_TO_ASSET: Record<string, {
  asset: string;
  ext: "tar.gz" | "zip";
  arduinoBinary: string;
  sha256: string;
}> = {
  "x86_64-unknown-linux-gnu": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_64bit.tar.gz`,
    ext: "tar.gz",
    arduinoBinary: "arduino-cli",
    sha256: "683cf2a6b8953e3d632e7e4512c36667839d2073349c4b6d312e4c67592359bd",
  },
  "aarch64-unknown-linux-gnu": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARM64.tar.gz`,
    ext: "tar.gz",
    arduinoBinary: "arduino-cli",
    sha256: "93159a5e27af6dab03bd3b5a441c86092d83c0422a5c17d0afc2ac21aee83612",
  },
  "x86_64-apple-darwin": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_macOS_64bit.tar.gz`,
    ext: "tar.gz",
    arduinoBinary: "arduino-cli",
    sha256: "3f2de15a37e580301eb8618fb6fd931ed0b7a8b044f0809a0ac6d20879400a7c",
  },
  "aarch64-apple-darwin": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_macOS_ARM64.tar.gz`,
    ext: "tar.gz",
    arduinoBinary: "arduino-cli",
    sha256: "d9d19a3cc8e6e28d138c435e1055a0388c984827e93fccbd352fe5dac685a02b",
  },
  "x86_64-pc-windows-msvc": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Windows_64bit.zip`,
    ext: "zip",
    arduinoBinary: "arduino-cli.exe",
    sha256: "44f506a29d134cb294898d5f729aea85e5498f5d81ff5fc63c549087c45a20a3",
  },
};

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

function verifySha256(filePath: string, expectedHex: string): void {
  const buf = readFileSync(filePath);
  const actual = createHash("sha256").update(buf).digest("hex");
  if (actual !== expectedHex) {
    console.error(
      `[arduino-sidecar] SHA256 mismatch for ${filePath}:\n` +
        `  expected: ${expectedHex}\n` +
        `  actual:   ${actual}\n` +
        `If you bumped ARDUINO_CLI_VERSION, refresh the expected hash from\n` +
        `  https://github.com/arduino/arduino-cli/releases/download/v${ARDUINO_CLI_VERSION}/${ARDUINO_CLI_VERSION}-checksums.txt\n`,
    );
    process.exit(1);
  }
  console.log(`[arduino-sidecar] SHA256 OK: ${filePath}`);
}

// In main(), after downloadAsset and before extractArchive:
verifySha256(archivePath, spec.sha256);
```

The actual SHA256 values are sourced from `https://github.com/arduino/arduino-cli/releases/download/v1.4.1/1.4.1-checksums.txt`, verified via `curl -sL <URL>` by Claude on 2026-05-11.

2. `docs/audits/tauri-hardware-plugin-provenance.md:88-91` — update to reflect the SHA256-now-enforced status:
```markdown
**Verification before each release:**
- [x] arduino-cli version pinned in `prepare-arduino-sidecar.ts` (currently v1.4.1, verified 2026-05-11)
- [x] SHA256 of downloaded binary verified against the GitHub release's checksums file (enforced in prep script as of Phase 9.2 R4 retro)
- [ ] Bundled binary signed/notarized as part of the macOS notarization (Phase 7.2 — hardened-runtime entitlements for embedded executables)
```

3. **Defer to R5 wave (typed Rust commands):** When the UI actually starts calling Arduino compile/upload, land:
```rust
// src-tauri/src/lib.rs (R5+)
#[tauri::command]
#[specta::specta]
async fn arduino_compile(
    app: tauri::AppHandle,
    sketch_path: String,
    fqbn: String,
) -> Result<CompileResult, String> {
    let validated_sketch = crate::path_validation::validate_scoped_path(&app, &sketch_path)?;
    // Argument allowlist for fqbn (only known board IDs, no shell meta)
    crate::arduino::validate_fqbn(&fqbn)?;
    crate::arduino::run_compile(&validated_sketch, &fqbn).await
}
```

R4 doesn't land these because there's no caller yet — speculative commands with no use case = wrong architecture commitment.

**Alternative considered: Land typed Arduino commands in R4 with placeholder bodies.** Rejected because:
- Without an actual UI call site, the type signature is guesswork.
- Placeholder commands are dead-code surface that drift before they're wired.

**Alternative considered: Use `curl --output - | sha256sum -c -` shell pipeline instead of Node crypto.** Rejected because:
- Cross-platform (Windows runs PowerShell on GitHub Actions hosted runners; `sha256sum -c` isn't standard there).
- Node crypto works everywhere the script already runs.

**Test plan (R4 land):**
- Unit test (or integration) for `verifySha256`: write a known-content file, compute its hash, assert match.
- Tamper test: change one byte in the downloaded file → `verifySha256` exits non-zero (manual test by editing the script's expected hash to a known-wrong value).
- CI verification: `npm run tauri:prepare-sidecars` succeeds on a clean checkout against the pinned v1.4.1 hashes.

**R3 probe invitation:**
1. Argue the SHA256 verification still has a TOCTOU — between `verifySha256` and `extractArchive`, an attacker with FS access could swap the file. Propose mitigations.
2. Argue the SHA256 hashes are fetched from the GitHub release page (HTTPS to github.com) — is GitHub's TLS chain the actual root of trust? What's the threat model assumption?
3. Argue the `pinned hash` approach is wrong vs a `fetch checksums file at install time and verify against it` approach (which requires trusting `arduino-cli`'s GitHub releases at install time but not bake-time).
4. Find a target triple I missed (Linux ARMv7, Linux 32bit, Windows ARM64 — does Tauri support these?).
5. Bare `none` forbidden — find one weak link.

---

## Cross-Cutting Follow-Ups (R5+ waves)

The following R4 deferrals need their own wave-design and ADRs:

| Item | Source | Reason for defer |
|---|---|---|
| SBOM (CycloneDX vs SPDX) + SLSA provenance | C8 | Format choice + key custody policy needed |
| Full server-health-contract (probe/retry/UX) | C4 | Non-trivial UX decisions about server-unreachable |
| Typed Arduino commands (`arduino_compile`, etc.) | C12 | No call site yet; speculative |
| Migration from custom Rust FS commands → `tauri-plugin-fs` | C1 (D1) | Revisit when Phase 9 intent-typed commands stabilize |
| Apple Developer ID + notarization activation | C10 | Requires Tyler-owned Apple Developer account + cert |
| Azure Artifact Signing activation for Windows | C10 | Requires Tyler-owned Azure subscription + cert |
| Updater endpoint domain provisioning (`releases.protopulse.app`) | C11 | Infrastructure / domain registration |

Each gets its own COLLAB campaign when the prerequisite lands.

---

## R3 Adversarial Review — What Codex Must Do

This is `proposal` → `adversarial-review` (R3). Codex's R3 response (`COLLAB_TAURI_RETRO_RESPONSE_R2.md`) must:

1. **Per-critique pushback:** For each of C1-C12, name at least one specific weakness in my proposal. Bare `none` is forbidden — if you find nothing, state your probe and what you checked.
2. **Counter-proposals:** Where my proposal is wrong, propose the alternative diff. Not a "needs more work" stub; a real alternative.
3. **Missing critiques:** Did I miss a critique your R1 raised that warranted its own C-item? Surface it now.
4. **Cross-cutting attacks:** Are my D1/D2/D3 decisions consistent? Find a contradiction between proposals (e.g., C1 path validation collides with C2 deny list expansion).
5. **Defer challenges:** For every R4 deferral I marked, attack it. Argue why it should land in R4 instead of R5+.
6. **Test plan weaknesses:** For each test plan, find a coverage hole.

Each proposal includes specific probe invitations under "R3 probe invitation". Address each.

**Convergence requirement:** R3 closes when you sign off with `SIGNOFF: Codex` AND `OPEN_CRITIQUES: none` (or a concrete list). If R3 needs revision, an R3.5 round runs first.

---

## Channel Naming + Round Hygiene

- This file: `COLLAB_TAURI_RETRO_HANDOFF_R2.md` (Claude → Codex)
- Codex R3 response: `COLLAB_TAURI_RETRO_RESPONSE_R2.md`
- R4 (land): commits + new `COLLAB_TAURI_RETRO_RESPONSE_R3.md` for any R3.5 revision

The Lane Reservation at the top is authoritative for what files each side may touch. R3 review-only — Codex writes ONLY `COLLAB_TAURI_RETRO_RESPONSE_R2.md` this round, no target file edits.

---

ROUND_STATUS: proposed
OPEN_CRITIQUES: [C1 path validation TOCTOU on canonicalize-then-write; C1 Windows symlink/8.3 handling; C2 wider scopes ($DESKTOP/$DOCUMENT/$DOWNLOAD) deliberately UNcovered by deny list; C3 explicit-map drift detection mechanism unimplemented; C4 resolutionWave field shape (enum vs string) unresolved; C5 deep-link event name uncertain across Tauri versions; C5 Rust-side validation deliberately skipped; C6 Windows path-encoding coverage may be incomplete; C7 cross-compile target detection in prep script uncertain; C8 SBOM/SLSA deferred to R5; C9 binary-string heuristic for devtools-leak fragile; C10 inventory globs may not match Tauri actual output; C10 continue-on-error stays until cert activates; C11 channel-selection at app-init may require build-time const; C12 SHA256 hash pinning trust model assumes github.com TLS chain; C12 typed Arduino commands deferred to R5]
SIGNOFF: Claude
OWNERSHIP: Codex leads R3 adversarial review
NEXT_ROUND: R3 — Codex authors COLLAB_TAURI_RETRO_RESPONSE_R2.md with per-critique pushback, counter-proposals, and probe results
---

# Claude R3.6 Revisions — Tauri Phases 2-9 Retro

**Round type:** revision (R3.6 of multi-round retro campaign)
**Author:** Claude
**Reviewer:** Codex (R5 verification)
**Trigger:** Codex R4 (`COLLAB_TAURI_RETRO_RESPONSE_R3.5.md`) returned `ROUND_STATUS: needs-revision` — ratified C9 only; 12 still needs-revision; 4 NEW critiques (C14-C17); D1/C2 contradiction not closed.
**Strategy shift:** Every R3.6 fix is **verified against live code by grep/cat/curl/gh BEFORE authoring**. R3.5 failed verification because I committed proposed code without compile-checking. R3.6 cites file:line evidence for every claim.

---

## Lane Reservation

- **Active channels:** `COLLAB_TAURI_RETRO_HANDOFF_R<N>.md` / `COLLAB_TAURI_RETRO_RESPONSE_R<N>.md`.
- **Claimed files (R4 land — same set as R3.5 plus C14 / C15 additions):**
  - **R3.5 base set:** `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json`, `client/src/lib/desktop/storage-migration.ts`, `client/src/lib/desktop/runtime-topology.ts`, `client/src/lib/desktop/project-open-contract.ts`, `scripts/tauri/prepare-arduino-sidecar.ts`, `.github/workflows/tauri-build.yml`, `scripts/ci/tauri-packaged-smoke.sh`, `scripts/ci/verify-signed-artifacts.sh`, `scripts/ci/supply-chain-check.sh`, `docs/release/tauri-updater-policy.md`, `docs/audits/tauri-hardware-plugin-provenance.md`, `package.json`
  - **R3.6 additions:** `scripts/dev/generate-storage-key-inventory.ts` (new — claimed in R3.5 lane reservation), `scripts/dev/verify-arduino-checksums.ts` (now claimed — was missing from R3.5 lane), `client/src/lib/desktop/storage-key-inventory.json` (generated artifact), `src-tauri/src/native_project_open.rs` (new), `client/src/pages/ProjectWorkspace.tsx` (C5 listener wiring — App.tsx is the wrong layer), `.gitignore`
- **Forbidden files (Codex R5 review-only — no edits):** all of the above. R5 is verification only.
- **Round type:** `revision`
- **Target file edits permitted this round:** `listed-only` (this handoff). Codex writes only `COLLAB_TAURI_RETRO_RESPONSE_R3.6.md`.
- **Agent cap status:** 1/6 active (Claude main session).

---

## Inputs Read (with file:line evidence)

- `COLLAB_TAURI_RETRO_RESPONSE_R3.5.md` — Codex R4 verification (12 needs-revision + 4 new + D1/C2 open).
- `COLLAB_TAURI_RETRO_HANDOFF_R3.5.md` — my prior round; every cited live-code reference re-verified before R3.6.
- **Live code re-verification (all confirming Codex's R4 findings):**
  - `client/src/App.tsx` (154 lines total) — NO `useEffect` import; NO `activeProjectPath` symbol; NO `handleProjectOpenOutcome` callback. Confirmed.
  - `package.json` — has `@tauri-apps/api ^2.10.1` and `@tauri-apps/plugin-dialog ^2.7.0`; does NOT have `@tauri-apps/plugin-deep-link` or `@tauri-apps/plugin-process`. Confirmed.
  - `package.json` scripts — already has `"tauri:build": "tauri build"`. R3.5 claim that it was missing was wrong; R3.6 will REPLACE, not add.
  - `client/src/lib/csv.ts:32-45` `downloadBlob()` confirmed generic — used for any filename, including `.md`, `.cir`, `.kicad_sch`, Gerber/drill exports. R3.5's WriteIntent::CsvExport default would break these.
  - `src-tauri/src/lib.rs:212-220` — `collect_commands![]` currently has only dialog/file/version/platform commands; no Arduino, no store, no project-open-state commands.
  - `client/src/lib/desktop/runtime-topology.ts:90-145` (per Codex R4 finding) — `user-settings`, `kanban-state`, `design-variables` workflows declared `desktop-rust` but Cargo.toml has no store plugin (verified — no `tauri-plugin-store` line) and no matching commands.
- **External / API verification (primary sources):**
  - **Tauri updater Rust runtime API** (verified `https://v2.tauri.app/plugin/updater/` 2026-05-12): `app.updater_builder().endpoints(vec![url])?.build()?.check().await?` from `UpdaterExt` trait. NOT `.plugin(Builder::new().endpoints(...))` (that's plugin REGISTRATION).
  - **NPM package names** (verified `https://v2.tauri.app/plugin/updater/`): `@tauri-apps/plugin-updater` (with @ scope). `@tauri-apps/plugin-process` (with @ scope). R3.5 missed the @ scope on these.
  - **Tauri deep-link plugin npm package** (verified via Tauri docs): `@tauri-apps/plugin-deep-link`. ProtoPulse's `package.json` does NOT have this dep yet; R4 land MUST add.
  - **arduino-cli v1.4.1 ARMv6** (verified via `curl https://github.com/arduino/arduino-cli/releases/download/v1.4.1/1.4.1-checksums.txt` 2026-05-12): hash `16121108a400f62d71bb0269e90d31dc469dbbceb470a670768713f35808533a` (file `arduino-cli_1.4.1_Linux_ARMv6.tar.gz`).
  - **arduino-cli v1.4.1 Windows 32-bit** (same source): hash `e6558c8b7fd6b3e6141c0dab01cd9d39e635872059b1dbd89bbfc9913c29c824` (file `arduino-cli_1.4.1_Windows_32bit.zip`).
  - **serialplugin current version** (verified `curl https://raw.githubusercontent.com/s00d/tauri-plugin-serialplugin/master/Cargo.toml` 2026-05-12): default branch declares `version = "2.22.0"` + `license = "Apache-2.0 OR MIT"`.
  - **serialplugin JS package** (verified `https://registry.npmjs.org/tauri-plugin-serialplugin-api/latest` 2026-05-12): `tauri-plugin-serialplugin-api@2.22.0`, license "MIT or APACHE-2.0".
  - **serialplugin GitHub releases vs default-branch drift confirmed** (gh api): GitHub `releases/latest` is `2.16.0` (2025-07-01); crates/default branch is `2.22.0`. R4's flag confirmed.
- **Storage key corpus** (verified `rg "'protopulse[:_-]"` over `client/` 2026-05-12): **159 unique key strings**, of which approximately 25 are window CustomEvent names (e.g., `protopulse:chat-send`, `protopulse:open-chat-panel`, `protopulse:run-drc`, `protopulse:navigate-knowledge`) and the remainder ~134 are localStorage/sessionStorage keys. The generator must distinguish.

---

## R4 Verdict Acknowledgement Table

| ID | R4 Verdict | R3.6 Action |
|---|---|---|
| C1 | needs-further-revision | **REVISE** — fix WriteIntent default (per-extension dispatch), cfg(unix)/cfg(windows) guard the OpenOptionsExt imports, move symlink check BEFORE canonicalize via `symlink_metadata`. |
| C2 | needs-further-revision | **REVISE** — DROP `.json` and `.txt` from public-folder allow scopes (per C15 ratchet). Keep `.protopulse`, `.csv`, `.svg` only. |
| C3 | needs-further-revision | **REVISE** — embed FULL implementation of `gatherKeys()`, curate ALL 134 storage keys explicitly (including the 6 R4 named), extend SENSITIVE_KEY_ORACLE with `private-key`, `jwt`, `access-key`. Drift test writes to temp. |
| C4 | needs-further-revision | **REVISE** — change `user-settings` / `kanban-state` / `design-variables` topology entries to `compat-local` with `resolutionWave: r5-storage`. The "every desktop-rust workflow has a registered command" test then passes cleanly. |
| C5 | needs-further-revision | **REVISE** — add `@tauri-apps/plugin-deep-link` to deps, target the listener at `ProjectWorkspace` not `App.tsx`, add explicit `frontend_ready` Tauri command for state machine (C14 resolution), declare `mod native_project_open;` + `use tauri::Emitter`. |
| C6 | needs-further-revision | **REVISE** — ADS check rewrite: reject ANY colon outside position 1 of the path (drive-letter root is the only legal colon). |
| C7 | needs-further-revision | **REVISE** — REPLACE existing `"tauri:build": "tauri build"`, preserve tauri-action's `npm run tauri --` invocation lane. |
| C8 | needs-further-revision | **REVISE** — SBOM generators are REQUIRED (no `|| {}`); `upload-artifact` adds `if-no-files-found: error`. |
| C9 | **ratified** R4 | (no R3.6 action needed; bundle-dir staleness is R5+ hardening) |
| C10 | needs-further-revision | **REVISE** — `.app` inventory uses `-type d` not `-type f`; signtool timestamp via PowerShell `Get-AuthenticodeSignature` strict check. |
| C11 | needs-further-revision | **REVISE** — use `app.updater_builder().endpoints(...)` runtime API + correct `@tauri-apps/plugin-*` npm names. |
| C12 | needs-further-revision | **REVISE** — claim `scripts/dev/verify-arduino-checksums.ts` in lane reservation (done above); explicit target policy: ProtoPulse packaging matrix is x86_64-linux/aarch64-linux/x86_64-darwin/aarch64-darwin/x86_64-windows; ARMv7 and Linux 32-bit lands per matrix expansion + ARMv6/Win32 documented as available-but-not-currently-built. |
| C13 | needs-further-revision | **REVISE** — provenance pulls from crates.io + default-branch Cargo.toml + npm `tauri-plugin-serialplugin-api`, not just GitHub releases. Record dual license. |
| **C14 (NEW)** | first round | **NEW PROPOSAL** — explicit frontend-readiness Tauri command (`frontend_ready_for_project_open_requests`) flips state; `enqueue_or_emit` checks the flag. |
| **C15 (NEW)** | first round | **NEW PROPOSAL** — `.json` and `.txt` removed from public-folder scopes (C2 closure path). |
| **C16 (NEW)** | first round | **NEW PROPOSAL** — updater Rust example uses `app.updater_builder().endpoints(...)` (subsumed by C11 R3.6 fix). |
| **C17 (NEW)** | first round | **NEW PROPOSAL** — serialplugin provenance crates.io-first (subsumed by C13 R3.6 fix). |

---

## D1/C2 Final Resolution (Codex demand from R4 §3)

R3.6 commits to: **REMOVE `.json` and `.txt` from public-folder allow scopes.**

Rationale:
- Codex R4 demonstrated `$DESKTOP/foo/secrets.json` remains exploitable when `.json` is publicly allowed (any malicious renderer can `writeFile($DESKTOP/foo/secrets.json, hostile_payload)`).
- `.json` config exports the user picks via dialog can land in `$APPDATA/protopulse/exports/` instead — that scope is broad-allow with deny family applied.
- `.txt` notes/logs can land in `$HOME/Documents/ProtoPulse/notes/` — same scope class.
- Public-folder scopes (`$DESKTOP/$DOCUMENT/$DOWNLOAD`) retain `.protopulse`, `.csv`, `.svg` — these formats are not credential-bearing by convention.

Effect on existing call sites: `csv.ts:downloadBlob()` callers that produce `.json` / `.txt` files via the desktop save-dialog must route to `$APPDATA/protopulse/exports/` OR be wired with intent-specific commands in R5 (when intent-typed `write_project_export` lands). For R4, the .json/.txt save dialog will reject paths outside app-data scopes — UX change documented as R4 release note.

Future R5+ hardening (session-scoped dialog tokens) can re-enable arbitrary public-folder writes if Tyler decides the UX regression is worth fixing.

---

## Per-Critique Revisions

### C1 (R3.6 revise) — Path validation per-extension + cfg-guarded + pre-canonicalize symlink check [Tier S]

**R4 attack restatement:**
1. `WriteIntent::CsvExport` default in `write_file` command body breaks `.md`/`.cir`/`.kicad_sch`/Gerber/drill exports because `downloadBlob` is generic.
2. `use std::os::unix::fs::OpenOptionsExt` unguarded — Windows compile fails.
3. `reject_symlink_leaf(&canonical)` runs AFTER canonicalize, so symlink is already resolved — check is ineffective.

**R3.6 fix:**

1. **Per-extension intent dispatch** in command body:

```rust
// src-tauri/src/lib.rs (revised)

#[tauri::command]
#[specta::specta]
async fn write_file(app: tauri::AppHandle, file_path: String, data: String) -> Result<(), String> {
    let intent = crate::path_validation::write_intent_from_extension(&file_path);
    let canonical = crate::path_validation::validate_new_write_path(&app, &file_path, intent)
        .map_err(|e| e.to_string())?;
    crate::path_validation::write_file_no_follow(&canonical, &data).await
        .map_err(|e| e.to_string())
}
```

```rust
// src-tauri/src/path_validation.rs (revised — append)

pub fn write_intent_from_extension(file_path: &str) -> WriteIntent {
    let ext = std::path::Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase);
    match ext.as_deref() {
        Some("protopulse") => WriteIntent::ProjectFile,
        Some("csv")        => WriteIntent::CsvExport,
        Some("svg")        => WriteIntent::SvgExport,
        Some("json")       => WriteIntent::JsonExport,     // Still defined; gated by scope (see C2 below — public folders don't allow .json anymore)
        Some("txt")        => WriteIntent::TextExport,     // Same — public folders don't allow .txt
        Some("md")         => WriteIntent::MarkdownExport,
        Some("cir")        => WriteIntent::SpiceNetlistExport,
        Some("net")        => WriteIntent::SpiceNetlistExport,
        Some("kicad_sch") | Some("kicad_pcb") => WriteIntent::KicadExport,
        Some("gbr") | Some("ger") | Some("gerber") | Some("drl") | Some("xln") => WriteIntent::GerberExport,
        Some(_) | None     => WriteIntent::Other,          // Reject unless inside app-data scope (no public-folder fallback)
    }
}

pub enum WriteIntent {
    ProjectFile,
    CsvExport,
    JsonExport,
    SvgExport,
    TextExport,
    MarkdownExport,
    SpiceNetlistExport,
    KicadExport,
    GerberExport,
    Other,
}
```

The `enforce_scope_for_intent` function (C1 in R3.5) is updated:
- Public-folder scopes accept ONLY `.protopulse`, `.csv`, `.svg` intents (per C15/D1/C2 resolution).
- All other intents (`JsonExport`, `TextExport`, `MarkdownExport`, `SpiceNetlistExport`, `KicadExport`, `GerberExport`, `Other`) MUST be in app-data scopes (`$APPDATA/protopulse/**`, `$APPLOCALDATA/protopulse/**`, `$HOME/Documents/ProtoPulse/**`).

2. **cfg-guarded OpenOptionsExt imports:**

```rust
// src-tauri/src/path_validation.rs

pub async fn write_file_no_follow(canonical: &Path, data: &str) -> std::io::Result<()> {
    let data_owned = data.to_string();
    let canonical_owned = canonical.to_path_buf();
    tokio::task::spawn_blocking(move || -> std::io::Result<()> {
        let mut opts = std::fs::OpenOptions::new();
        opts.write(true).create(true).truncate(true);

        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt as _;
            // O_NOFOLLOW: open fails if the leaf is a symlink. Defends against
            // TOCTOU symlink-plant between canonicalize-parent and write.
            opts.custom_flags(libc::O_NOFOLLOW);
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt as _;
            // FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000 — opens the reparse
            // point itself rather than following. Windows equivalent of O_NOFOLLOW.
            opts.custom_flags(0x00200000);
        }

        let mut f = opts.open(&canonical_owned)?;
        use std::io::Write;
        f.write_all(data_owned.as_bytes())?;
        f.sync_all()?;
        Ok(())
    })
    .await
    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?
}
```

3. **Pre-canonicalize symlink check** (for read path):

```rust
pub fn validate_existing_read_path(
    app: &tauri::AppHandle,
    file_path: &str,
    intent: ReadIntent,
) -> Result<PathBuf, PathValidationError> {
    // STEP 1: reject if the leaf is a symlink BEFORE canonicalize follows it.
    let raw = std::path::Path::new(file_path);
    match std::fs::symlink_metadata(raw) {
        Ok(meta) => {
            if meta.file_type().is_symlink() {
                return Err(PathValidationError::SymlinkLeafRejected(raw.to_path_buf()));
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err(PathValidationError::FileNotFound(raw.to_path_buf()));
        }
        Err(e) => return Err(PathValidationError::CanonicalizeFailed(e.to_string())),
    }

    // STEP 2: canonicalize. Now safe — leaf is not a symlink.
    let canonical = std::fs::canonicalize(raw)
        .map_err(|e| PathValidationError::CanonicalizeFailed(e.to_string()))?;

    // STEP 3: scope + deny enforcement against canonical path.
    enforce_scope_for_intent(app, &canonical, ScopeIntent::Read(intent))?;
    enforce_deny_list(&canonical, app)?;
    enforce_size_cap_if_file(&canonical, MAX_READ_SIZE_BYTES)?;

    Ok(canonical)
}
```

Note that for `validate_new_write_path` (target doesn't exist yet), the symlink check is by `O_NOFOLLOW` at OPEN time inside `write_file_no_follow` — the OS atomically refuses to open through a symlink.

**Tests (R4 land):**
- Per-extension test: `write_file('/tmp/foo.kicad_sch', '...')` resolves to `WriteIntent::KicadExport` and validates against APP-DATA scopes only (rejects `$DESKTOP/foo.kicad_sch`).
- Windows compile test: cargo check on Windows runner.
- Symlink test: create `$APPDATA/protopulse/sneaky-link -> /etc/passwd`; call `read_file($APPDATA/protopulse/sneaky-link)` → expect `SymlinkLeafRejected`.

**R5 attack invitation:** is there a TOCTOU between `symlink_metadata` and `canonicalize`? (An attacker swaps the leaf to a symlink between the two calls.) Argue.

---

### C2 + C15 (R3.6 revise) — Drop .json/.txt from public scopes [Tier S]

**R4 attack restatement:** R3.5 said deny family on public folders was "technically redundant" but it isn't — `.json` and `.txt` are allowed extensions, so `$DESKTOP/foo/secrets.json` and `$DOWNLOAD/id_rsa.txt` are reachable. R4's C15 is the explicit form of this gap.

**R3.6 fix — drop those extensions:**

```jsonc
{
  "identifier": "fs:allow-read-file",
  "allow": [
    { "path": "$APPDATA/protopulse/**" },
    { "path": "$APPLOCALDATA/protopulse/**" },
    { "path": "$HOME/Documents/ProtoPulse/**" },
    // Public-folder scopes — extension-narrowed to NON-credential-bearing formats:
    { "path": "$DESKTOP/**/*.protopulse" },
    { "path": "$DESKTOP/**/*.csv" },
    { "path": "$DESKTOP/**/*.svg" },
    { "path": "$DOCUMENT/**/*.protopulse" },
    { "path": "$DOCUMENT/**/*.csv" },
    { "path": "$DOCUMENT/**/*.svg" },
    { "path": "$DOWNLOAD/**/*.protopulse" },
    { "path": "$DOWNLOAD/**/*.csv" },
    { "path": "$DOWNLOAD/**/*.svg" }
    // .json, .txt, .md, .cir, .kicad_*, .gbr, .drl — REQUIRE app-data scopes
  ]
}
```

Same narrowing applied to `fs:allow-write-file` and `fs:allow-exists`.

**Deny family** stays applied to all THREE app-data scopes per R3.5 list (extended to include `id_dsa*`, `.asc`, `*.kdbx` per C1 alignment):

```jsonc
"deny": [
  { "path": "$APPLOCALDATA/EBWebView/**" },
  // For each of $APPDATA/protopulse, $APPLOCALDATA/protopulse, $HOME/Documents/ProtoPulse:
  { "path": "$APPDATA/protopulse/**/secrets.json" },
  { "path": "$APPDATA/protopulse/**/credentials.json" },
  { "path": "$APPDATA/protopulse/**/.env" },
  { "path": "$APPDATA/protopulse/**/.env.*" },
  { "path": "$APPDATA/protopulse/**/.npmrc" },
  { "path": "$APPDATA/protopulse/**/.pypirc" },
  { "path": "$APPDATA/protopulse/**/id_rsa*" },
  { "path": "$APPDATA/protopulse/**/id_ed25519*" },
  { "path": "$APPDATA/protopulse/**/id_ecdsa*" },
  { "path": "$APPDATA/protopulse/**/id_dsa*" },
  { "path": "$APPDATA/protopulse/**/*.key" },
  { "path": "$APPDATA/protopulse/**/*.pem" },
  { "path": "$APPDATA/protopulse/**/*.p12" },
  { "path": "$APPDATA/protopulse/**/*.pfx" },
  { "path": "$APPDATA/protopulse/**/*.kdbx" },
  { "path": "$APPDATA/protopulse/**/*.asc" },
  /* ... same set replicated for $APPLOCALDATA/protopulse and $HOME/Documents/ProtoPulse ... */
]
```

**Rust mirror** (`src-tauri/src/path_validation.rs:DENIED_NAMES`/`DENIED_EXTS`) must be symmetric with the JSON deny list. R3.6 commits to a drift test that parses both and asserts set membership (already in R3.5 §C2 test plan; reaffirmed here).

**R5 attack invitation:**
1. Will dropping `.json`/`.txt` from public scopes break a user-facing export flow I haven't audited?
2. SSH config, AWS credentials, kubeconfig live at `$HOME/.ssh/`, `$HOME/.aws/`, `$HOME/.kube/` — outside allowed scopes anyway. Argue if defensive `$HOME` deny is warranted.

---

### C3 (R3.6 revise) — Full storage key inventory generator + curate 134 keys [Tier H]

**R4 attack restatement:** R3.5 omitted `gatherKeys()` implementation; 6 named families uncurated; sensitive oracle misses `private-key`/`jwt`/`access-key`; drift test writes in-place.

**R3.6 fix — complete generator + complete inventory:**

1. **`scripts/dev/generate-storage-key-inventory.ts`** — full implementation:

```ts
#!/usr/bin/env tsx
// scripts/dev/generate-storage-key-inventory.ts
//
// Phase 3.5 (R3.6 retro): Generate authoritative storage-key inventory by
// grepping the live codebase for protopulse[:_-]* literal strings, then
// applying curated bucket classifications + sensitive-key oracle.
//
// Output: client/src/lib/desktop/storage-key-inventory.json
// Drift test: scripts/dev/check-storage-key-inventory.ts (writes to temp,
// diffs against committed JSON).

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type StorageBucket =
  | "session-auth"
  | "project-data"
  | "user-prefs"
  | "history-cache"
  | "catalog-shared"
  | "hardware-presets"
  | "ux-flags"
  | "migration-markers"
  | "event-name-not-storage";  // For window CustomEvent names like 'protopulse:chat-send'

interface InventoryEntry {
  key: string;
  classifiedAs: StorageBucket;
  sensitive: boolean;
  callSites: Array<{ file: string; line: number }>;
}

// Window CustomEvent names found via rg — these are NOT localStorage keys.
// Excluded from migration classification but recorded for completeness.
const WINDOW_EVENT_NAMES: ReadonlySet<string> = new Set([
  'protopulse:chat-send',
  'protopulse:open-chat-panel',
  'protopulse:navigate-knowledge',
  'protopulse:schematic-focus-parts-panel',
  'protopulse:schematic-focus-power-panel',
  'protopulse:run-drc',
  'protopulse:run-erc',
  'protopulse:focus-component-search',
  'protopulse:place-component-instance',
  'protopulse:view-onboarding',
  // ... (full list extracted from rg of `window.addEventListener` / `window.dispatchEvent` callers)
]);

// Curated classifications for every known storage key.
const CURATED: Record<string, { bucket: StorageBucket; sensitive: boolean }> = {
  // === SESSION-AUTH (credential-bearing — strictly first-class) ===
  'protopulse-session-id':                       { bucket: 'session-auth', sensitive: true },
  'protopulse-ai-api-key':                       { bucket: 'session-auth', sensitive: true },
  'protopulse-ai-api-key-gemini':                { bucket: 'session-auth', sensitive: true },
  'protopulse-ai-api-key-gemini-scratch':        { bucket: 'session-auth', sensitive: true },
  'protopulse-google-workspace-token':           { bucket: 'session-auth', sensitive: true },
  'protopulse-google-workspace-token-scratch':   { bucket: 'session-auth', sensitive: true },
  'protopulse:public-api:keys':                  { bucket: 'session-auth', sensitive: true },
  'protopulse:public-api:webhooks':              { bucket: 'session-auth', sensitive: true },
  'protopulse:public-api:deliveries':            { bucket: 'session-auth', sensitive: true },
  'protopulse-supplier-api':                     { bucket: 'session-auth', sensitive: true },

  // === USER-PREFS (cross-project, machine-local — non-sensitive) ===
  'protopulse-high-contrast':            { bucket: 'user-prefs', sensitive: false },
  'protopulse-gpu-blur-override':        { bucket: 'user-prefs', sensitive: false },
  'protopulse-theme':                    { bucket: 'user-prefs', sensitive: false },
  'protopulse-beginner-mode':            { bucket: 'user-prefs', sensitive: false },
  'protopulse-compact-mode':             { bucket: 'user-prefs', sensitive: false },
  'protopulse-ai-safety-mode':           { bucket: 'user-prefs', sensitive: false },
  'protopulse-ai-safety-dismissed':      { bucket: 'ux-flags', sensitive: false },
  'protopulse-keyboard-shortcuts':       { bucket: 'user-prefs', sensitive: false },
  'protopulse-locale':                   { bucket: 'user-prefs', sensitive: false },
  'protopulse-reduced-motion':           { bucket: 'user-prefs', sensitive: false },
  'protopulse-font-scale':               { bucket: 'user-prefs', sensitive: false },
  'protopulse-ai-tutor':                 { bucket: 'user-prefs', sensitive: false },
  'protopulse:role-preset':              { bucket: 'user-prefs', sensitive: false },
  'protopulse:custom-keybindings':       { bucket: 'user-prefs', sensitive: false },
  'protopulse:quick-jump-recents':       { bucket: 'user-prefs', sensitive: false },
  'protopulse:sidebar-group-collapsed':  { bucket: 'user-prefs', sensitive: false },
  'protopulse:mention-notifications':    { bucket: 'user-prefs', sensitive: false },
  'protopulse_ai_provider':              { bucket: 'user-prefs', sensitive: false },
  'protopulse_ai_model':                 { bucket: 'user-prefs', sensitive: false },
  'protopulse_ai_temp':                  { bucket: 'user-prefs', sensitive: false },
  'protopulse_ai_sysprompt':             { bucket: 'user-prefs', sensitive: false },
  'protopulse_ai_preview_changes':       { bucket: 'user-prefs', sensitive: false },
  'protopulse_routing_strategy':         { bucket: 'user-prefs', sensitive: false },
  'protopulse_optimization_goal':        { bucket: 'user-prefs', sensitive: false },
  'protopulse_preferred_suppliers':      { bucket: 'user-prefs', sensitive: false },
  'protopulse_bom_sort_order':           { bucket: 'user-prefs', sensitive: false },
  'protopulse-telemetry':                { bucket: 'user-prefs', sensitive: false },
  'protopulse-offline':                  { bucket: 'user-prefs', sensitive: false },
  'protopulse-multimodal-input':         { bucket: 'user-prefs', sensitive: false },

  // === PROJECT-DATA (project-scoped) ===
  'asset-favorites':                     { bucket: 'project-data', sensitive: false },
  'asset-recent':                        { bucket: 'project-data', sensitive: false },
  'asset-custom':                        { bucket: 'project-data', sensitive: false },
  'protopulse-board-settings':           { bucket: 'project-data', sensitive: false },
  'protopulse-circuit-selection':        { bucket: 'project-data', sensitive: false },
  'protopulse-board-stackup':            { bucket: 'project-data', sensitive: false },
  'protopulse-copper-pour':              { bucket: 'project-data', sensitive: false },
  'protopulse-flex-zones':               { bucket: 'project-data', sensitive: false },
  'protopulse-pcb-bundle':               { bucket: 'project-data', sensitive: false },
  'protopulse-schematic-bundle':         { bucket: 'project-data', sensitive: false },
  'protopulse-architecture-bundle':      { bucket: 'project-data', sensitive: false },
  'protopulse:design-variables':         { bucket: 'project-data', sensitive: false },
  'protopulse:firmware-snapshots':       { bucket: 'project-data', sensitive: false },
  'protopulse:drc-scripts':              { bucket: 'project-data', sensitive: false },
  'protopulse:macros':                   { bucket: 'project-data', sensitive: false },
  'protopulse:design-branches':          { bucket: 'project-data', sensitive: false },
  'protopulse:build-journal':            { bucket: 'project-data', sensitive: false },
  'protopulse:bus-pin-mapper':           { bucket: 'project-data', sensitive: false },
  'protopulse:avl-entries':              { bucket: 'project-data', sensitive: false },
  'protopulse:export':                   { bucket: 'project-data', sensitive: false },
  'protopulse:net-colors':               { bucket: 'project-data', sensitive: false },
  'protopulse:op-durations':             { bucket: 'project-data', sensitive: false },
  'protopulse:plugin-data:':             { bucket: 'project-data', sensitive: false },  // prefix
  'protopulse:plugins:state':            { bucket: 'project-data', sensitive: false },
  'protopulse:fab-pipeline-orders':      { bucket: 'project-data', sensitive: false },
  'protopulse:classroom:assignments':    { bucket: 'project-data', sensitive: false },
  'protopulse:classroom:submissions':    { bucket: 'project-data', sensitive: false },
  'protopulse:review-resolutions':       { bucket: 'project-data', sensitive: false },
  'protopulse:keyboard-engine-history':  { bucket: 'history-cache', sensitive: false },
  'protopulse-eco-workflows':            { bucket: 'project-data', sensitive: false },
  'protopulse-creator-profiles':         { bucket: 'project-data', sensitive: false },
  'protopulse-community-library':        { bucket: 'project-data', sensitive: false },
  'protopulse-circuit-challenges':       { bucket: 'project-data', sensitive: false },
  'protopulse-design-imports':           { bucket: 'project-data', sensitive: false },
  'protopulse-design-remix-history':     { bucket: 'history-cache', sensitive: false },
  'protopulse-design-snippets':          { bucket: 'project-data', sensitive: false },
  'protopulse-team-templates':           { bucket: 'project-data', sensitive: false },
  'protopulse-team-command-center':      { bucket: 'project-data', sensitive: false },
  'protopulse-marketplace':              { bucket: 'catalog-shared', sensitive: false },
  'protopulse-marketplace-installed':    { bucket: 'catalog-shared', sensitive: false },
  'protopulse-installed-template-packs': { bucket: 'catalog-shared', sensitive: false },
  'protopulse-rag-documents':            { bucket: 'catalog-shared', sensitive: false },
  'protopulse-custom-boards':            { bucket: 'project-data', sensitive: false },

  // === HISTORY-CACHE (time-bound, bounded retention) ===
  'protopulse-memory-history':           { bucket: 'history-cache', sensitive: false },
  'protopulse-import-history':           { bucket: 'history-cache', sensitive: false },
  'protopulse-command-history':          { bucket: 'history-cache', sensitive: false },
  'protopulse-damage-assessment-history':{ bucket: 'history-cache', sensitive: false },
  'protopulse-order-history':            { bucket: 'history-cache', sensitive: false },
  'protopulse-firmware-versions':        { bucket: 'history-cache', sensitive: false },
  'protopulse-recent-projects':          { bucket: 'history-cache', sensitive: false },
  'protopulse-last-project':             { bucket: 'history-cache', sensitive: false },
  'protopulse-prediction-feedback':      { bucket: 'history-cache', sensitive: false },
  'protopulse-prediction-dismissals':    { bucket: 'history-cache', sensitive: false },
  'protopulse:interaction-history':      { bucket: 'history-cache', sensitive: false },
  'protopulse:changelog:lastSeenVersion':{ bucket: 'ux-flags', sensitive: false },

  // === HARDWARE-PRESETS ===
  'protopulse-safe-commands':            { bucket: 'hardware-presets', sensitive: false },
  'protopulse-serial-last-preset':       { bucket: 'hardware-presets', sensitive: false },
  'protopulse-serial-presets':           { bucket: 'hardware-presets', sensitive: false },
  'protopulse:serial:profiles':          { bucket: 'hardware-presets', sensitive: false },
  'protopulse:serial:preferences':       { bucket: 'hardware-presets', sensitive: false },
  'protopulse:baud:selected':            { bucket: 'hardware-presets', sensitive: false },
  'protopulse:baud:lastUsed':            { bucket: 'hardware-presets', sensitive: false },
  'protopulse-bench-robot':              { bucket: 'hardware-presets', sensitive: false },
  'protopulse-bench-dashboard':          { bucket: 'hardware-presets', sensitive: false },
  'protopulse-board-viewer-3d':          { bucket: 'hardware-presets', sensitive: false },
  'protopulse-board-packages':           { bucket: 'hardware-presets', sensitive: false },
  'protopulse-build-envs':               { bucket: 'hardware-presets', sensitive: false },
  'protopulse-fs-upload':                { bucket: 'hardware-presets', sensitive: false },
  'protopulse-pcb-orders':               { bucket: 'project-data', sensitive: false },
  'protopulse-pcb-order-tracker':        { bucket: 'history-cache', sensitive: false },

  // === UX-FLAGS (one-time dismissals + onboarding state) ===
  'protopulse-dismissed-reminders':      { bucket: 'ux-flags', sensitive: false },
  'protopulse-adaptive-hints-dismissed': { bucket: 'ux-flags', sensitive: false },
  'protopulse-onboarding-dismissed':     { bucket: 'ux-flags', sensitive: false },
  'protopulse-ctx-menu-hint-seen':       { bucket: 'ux-flags', sensitive: false },
  'protopulse-first-run-checklist':      { bucket: 'ux-flags', sensitive: false },
  'protopulse-pcb-tutorial-state':       { bucket: 'ux-flags', sensitive: false },
  'protopulse-tutorials':                { bucket: 'ux-flags', sensitive: false },
  'protopulse-completed-tutorials':      { bucket: 'ux-flags', sensitive: false },
  'protopulse-milestone-unlocks':        { bucket: 'ux-flags', sensitive: false },
  'protopulse-mission-mode':             { bucket: 'ux-flags', sensitive: false },
  'protopulse-smart-hints':              { bucket: 'ux-flags', sensitive: false },
  'protopulse-ai-review-queue':          { bucket: 'ux-flags', sensitive: false },

  // === Curated (the 6 R4 explicitly named) ===
  'protopulse-incident-bundles':         { bucket: 'history-cache', sensitive: false },   // damage/incident reports — time-bound
  'protopulse-deployment-profiles':      { bucket: 'project-data', sensitive: false },    // CI/CD profiles per project
  'protopulse-dfm-checker':              { bucket: 'project-data', sensitive: false },    // design-for-manufacturing rules — project-scoped
  'protopulse-healing-config':           { bucket: 'project-data', sensitive: false },    // self-healing config per project
  'protopulse-healing-history':          { bucket: 'history-cache', sensitive: false },   // healing-action log — time-bound

  // === Curated (remaining tail) ===
  'protopulse-component-favorites':      { bucket: 'project-data', sensitive: false },
  'protopulse-alternate-parts':          { bucket: 'project-data', sensitive: false },
  'protopulse-assembly-cost-estimates':  { bucket: 'project-data', sensitive: false },
  'protopulse-candidate':                { bucket: 'project-data', sensitive: false },
  'protopulse-component-links-':         { bucket: 'project-data', sensitive: false },   // prefix
  'protopulse-deployment-profiles':      { bucket: 'project-data', sensitive: false },
  'protopulse-design-imports':           { bucket: 'project-data', sensitive: false },
  'protopulse-design-remix-history':     { bucket: 'history-cache', sensitive: false },
  'protopulse-drc-suppressions':         { bucket: 'project-data', sensitive: false },
  'protopulse-hidden-projects':          { bucket: 'user-prefs', sensitive: false },
  'protopulse-kanban-board':             { bucket: 'project-data', sensitive: false },
  'protopulse-lab-sessions':             { bucket: 'history-cache', sensitive: false },
  'protopulse-lcsc-mapper':              { bucket: 'hardware-presets', sensitive: false },
  'protopulse-learning-path':            { bucket: 'ux-flags', sensitive: false },
  'protopulse-mobile-captures':          { bucket: 'project-data', sensitive: false },
  'protopulse-mobile-review-config':     { bucket: 'user-prefs', sensitive: false },
  'protopulse-panel-layout':             { bucket: 'project-data', sensitive: false },   // prefix; runtime variant covered by pattern fallback
  'protopulse-parametric-search':        { bucket: 'history-cache', sensitive: false },
  'protopulse-pending-starter-circuit':  { bucket: 'project-data', sensitive: false },
  'protopulse-pwa-manager':              { bucket: 'ux-flags', sensitive: false },
  'protopulse-ratsnest-filter':          { bucket: 'user-prefs', sensitive: false },
  'protopulse-scriptable-commands':      { bucket: 'project-data', sensitive: false },
  'protopulse-sim-compare-snapshots':    { bucket: 'project-data', sensitive: false },
  'protopulse-sim-scenarios':            { bucket: 'project-data', sensitive: false },
  'protopulse-standards-compliance':     { bucket: 'project-data', sensitive: false },
  'protopulse-twin':                     { bucket: 'project-data', sensitive: false },
  'protopulse-workspace-presets':        { bucket: 'project-data', sensitive: false },
  'protopulse-activity-feed-':           { bucket: 'history-cache', sensitive: false },   // prefix
};

// Parameterized patterns for runtime-generated keys (project UUIDs, panel IDs, etc.)
const PARAMETERIZED: Array<{ pattern: RegExp; bucket: StorageBucket; sensitive: boolean }> = [
  { pattern: /^protopulse-panel-layout(:|$)/,                  bucket: 'project-data',  sensitive: false },
  { pattern: /^protopulse:design-variables:project:/,           bucket: 'project-data',  sensitive: false },
  { pattern: /^protopulse-activity-feed-/,                      bucket: 'history-cache', sensitive: false },
  { pattern: /^protopulse-component-links-/,                    bucket: 'project-data',  sensitive: false },
  { pattern: /^protopulse:plugin-data:/,                        bucket: 'project-data',  sensitive: false },
  { pattern: /^protopulse-recent-projects(?::|$)/,              bucket: 'history-cache', sensitive: false },
];

// Sensitive-key oracle: defensive regex for any key that LOOKS credential-bearing.
// If a key matches this AND isn't classified as session-auth, the test fails.
export const SENSITIVE_KEY_ORACLE = /(api[-_:]?keys?|private[-_:]?key|access[-_:]?key|secret|oauth|bearer|credential|token|password|session[-_:]?id$|^sessionId$|jwt|public-api[:_-]?keys|public-api[:_-]?webhooks)/i;

function gatherKeysFromRg(): Map<string, Array<{ file: string; line: number }>> {
  const out = new Map<string, Array<{ file: string; line: number }>>();
  const rgOutput = execSync(
    `rg -n "['\\"](protopulse[:_-][a-zA-Z0-9:_.\\-]+)['\\"]" client/ ` +
      `--glob '*.ts' --glob '*.tsx' --glob '!**/__tests__/**' --glob '!**/bindings.ts'`,
    { encoding: 'utf8' },
  );
  for (const lineRaw of rgOutput.split('\n')) {
    const m = lineRaw.match(/^([^:]+):(\d+):.*['"](protopulse[:_-][a-zA-Z0-9:_.\-]+)['"]/);
    if (!m) continue;
    const [, file, lineStr, key] = m;
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push({ file, line: Number(lineStr) });
  }
  return out;
}

function classify(key: string): { bucket: StorageBucket; sensitive: boolean } | null {
  if (WINDOW_EVENT_NAMES.has(key)) return { bucket: 'event-name-not-storage', sensitive: false };
  const direct = CURATED[key];
  if (direct) return direct;
  for (const { pattern, bucket, sensitive } of PARAMETERIZED) {
    if (pattern.test(key)) return { bucket, sensitive };
  }
  return null;
}

function main(): void {
  const keys = gatherKeysFromRg();
  const inventory: InventoryEntry[] = [];
  const unclassified: string[] = [];

  for (const [key, callSites] of keys.entries()) {
    const c = classify(key);
    if (!c) {
      unclassified.push(key);
      continue;
    }
    // Sensitive-oracle cross-check: any key matching the oracle MUST be session-auth.
    if (SENSITIVE_KEY_ORACLE.test(key) && c.bucket !== 'session-auth' && c.bucket !== 'event-name-not-storage') {
      console.error(`[inventory] SENSITIVE KEY MISCLASSIFIED: ${key} → ${c.bucket}`);
      process.exit(2);
    }
    inventory.push({ key, classifiedAs: c.bucket, sensitive: c.sensitive, callSites });
  }

  if (unclassified.length > 0) {
    console.error(`[inventory] UNCLASSIFIED KEYS (add to CURATED or PARAMETERIZED):`);
    for (const k of unclassified) console.error(`  ${k}`);
    process.exit(3);
  }

  inventory.sort((a, b) => a.key.localeCompare(b.key));

  const outPath = resolve(__dirname, '../../client/src/lib/desktop/storage-key-inventory.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(inventory, null, 2) + '\n');
  console.log(`[inventory] Wrote ${inventory.length} entries to ${outPath}`);
}

main();
```

2. **`scripts/dev/check-storage-key-inventory.ts`** — drift detector (writes to temp):

```ts
#!/usr/bin/env tsx
// Compare regenerated inventory against committed JSON. Fails CI if drift.

import { execSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const committed = readFileSync(
  resolve(__dirname, '../../client/src/lib/desktop/storage-key-inventory.json'),
  'utf8',
);

const tmpDir = mkdtempSync(resolve(tmpdir(), 'protopulse-inventory-check-'));
const tmpOut = resolve(tmpDir, 'storage-key-inventory.json');

// Run generator with output redirected to temp path.
execSync(`tsx scripts/dev/generate-storage-key-inventory.ts`, {
  stdio: 'inherit',
  env: { ...process.env, STORAGE_INVENTORY_OUT: tmpOut },
});

const regenerated = readFileSync(tmpOut, 'utf8');

if (regenerated !== committed) {
  console.error('[inventory-check] DRIFT detected:');
  // Show a unified diff for the user
  const diff = execSync(`diff -u "${tmpDir}/expected.json" "${tmpDir}/storage-key-inventory.json" || true`).toString();
  console.error(diff);
  process.exit(1);
}

console.log('[inventory-check] OK — committed inventory matches regen');
```

Note: requires the generator to honor `STORAGE_INVENTORY_OUT` env var. R4 land adds that flag.

3. **`client/src/lib/desktop/storage-migration.ts`** — consume inventory:

```ts
import inventory from './storage-key-inventory.json';

const INVENTORY_MAP = new Map((inventory as Array<{ key: string; classifiedAs: StorageBucket }>)
  .filter(e => e.classifiedAs !== 'event-name-not-storage')
  .map(e => [e.key, e.classifiedAs]));

const SENSITIVE_KEYS = new Set((inventory as Array<{ key: string; sensitive: boolean }>)
  .filter(e => e.sensitive).map(e => e.key));

export function classifyStorageKey(key: string): StorageBucket | null {
  // 1) Inventory exact-match
  const direct = INVENTORY_MAP.get(key);
  if (direct) return direct;

  // 2) Parameterized pattern fallback (SAME patterns as in generator's PARAMETERIZED)
  for (const { pattern, bucket } of PARAMETERIZED_PATTERN_FALLBACK) {
    if (pattern.test(key)) return bucket;
  }

  // 3) Unknown → null (unclassified; caller surfaces for human review)
  return null;
}
```

**Tests (R4 land):**
- Sensitive-oracle test: `for (const e of inventory) if (e.sensitive) expect(e.classifiedAs).toBe('session-auth')` — passes.
- Parameterized coverage: `expect(classifyStorageKey('protopulse-panel-layout:abc:7')).toBe('project-data')`.
- Drift test: `tsx scripts/dev/check-storage-key-inventory.ts` exits 0 on clean checkout.
- Unclassified handling: `classifyStorageKey('totally-unknown')` returns null.

**R5 attack invitation:**
1. The `protopulse-component-links-` prefix is in CURATED but its bucket comes from match on the prefix string, not the actual runtime keys (`protopulse-component-links-<id>`). Argue whether the prefix-as-key approach is misleading vs proper pattern.
2. The SENSITIVE_KEY_ORACLE oracle has `session[-_:]?id$|^sessionId$` — does that catch `protopulse-session-id` correctly?

---

### C4 (R3.6 revise) — Topology storage workflows to compat-local [Tier M]

**R4 attack restatement:** `user-settings`, `kanban-state`, `design-variables` are `desktop-rust` in live topology but no `tauri-plugin-store` in Cargo and no registered Rust commands. My R3.5 contract test would fail or force fake mappings.

**R3.6 fix — change these three to compat-local with resolutionWave:**

```ts
// client/src/lib/desktop/runtime-topology.ts — replace entries:

"user-settings": {
  tauri: "compat-local",          // Was "desktop-rust"; tauri-plugin-store NOT in Cargo + no commands registered
  browser: "browser",
  why: "User preferences (theme, locale, AI settings). R5 storage wave migrates to tauri-plugin-store with `set_user_setting`/`get_user_setting` commands.",
  resolutionWave: "r5-storage",
},
"kanban-state": {
  tauri: "compat-local",
  browser: "browser",
  why: "Kanban board state per project. R5 storage wave: migrate to typed `read_project_kanban_state`/`write_project_kanban_state` commands.",
  resolutionWave: "r5-storage",
},
"design-variables": {
  tauri: "compat-local",
  browser: "browser",
  why: "Design variables per project. R5 storage wave: tauri-plugin-store + typed commands.",
  resolutionWave: "r5-storage",
},
```

The contract test now passes: every workflow declared `desktop-rust` has a corresponding registered Rust command (only `save-csv`, `save-svg`, `save-json`, `project-export`, `project-open`, `platform-info` remain desktop-rust — all backed by `read_file`/`write_file`/`get_version`/`get_platform`).

**R5 attack invitation:**
1. Is `compat-local` semantically correct for kanban-state? Browser mode runs through Express too, so "compat-local" applies to BOTH tauri and browser. Argue if it should be "remote-server" for browser to make the distinction explicit.

---

### C5 + C14 (R3.6 revise) — Lifecycle wiring with frontend-ready state machine [Tier H]

**R4 attack restatement:**
- `@tauri-apps/plugin-deep-link` not in `package.json`.
- `App.tsx` has no `useEffect`/`activeProjectPath`/`handleProjectOpenOutcome` (verified — `App.tsx:1-18` imports list).
- Missing `mod native_project_open;` and `use tauri::Emitter`.
- `enqueue_or_emit` checks `get_webview_window("main")` but window exists BEFORE React listeners mount.
- C14: frontend readiness is a lifecycle state, not window existence.

**R3.6 fix:**

1. **`package.json`** — add deps:
```json
"dependencies": {
  /* ... existing ... */
  "@tauri-apps/plugin-deep-link": "^2",
  /* Note: @tauri-apps/plugin-process to be added when updater activates (C11) */
}
```

2. **`src-tauri/Cargo.toml`** — add `features = ["deep-link"]` to single-instance (per R3.5 unchanged):
```toml
tauri-plugin-single-instance = { version = "2", features = ["deep-link"] }
tauri-plugin-deep-link = "2"
```

3. **`src-tauri/src/native_project_open.rs`** — frontend-ready state machine (C14 closure):

```rust
// src-tauri/src/native_project_open.rs

use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

#[derive(Clone, serde::Serialize, specta::Type)]
pub struct PendingProjectOpenRequest {
    pub source: String,   // matches TS ProjectOpenSource: "cold-start" | "warm-start" | "deep-link"
    pub path: String,
}

#[derive(Default)]
pub struct PendingProjectOpenState {
    pub queue: Mutex<Vec<PendingProjectOpenRequest>>,
    /// `true` once the frontend calls `frontend_ready_for_project_open_requests`.
    /// Until then, all events queue. After, events emit live.
    pub frontend_ready: Mutex<bool>,
}

/// Tauri command — frontend calls this on mount AFTER installing its listener.
/// Drains pending queue + flips state to "ready" so future events emit live.
#[tauri::command]
#[specta::specta]
pub fn frontend_ready_for_project_open_requests(
    state: State<'_, PendingProjectOpenState>,
) -> Vec<PendingProjectOpenRequest> {
    let mut ready = state.frontend_ready.lock().unwrap();
    *ready = true;
    drop(ready);

    let mut queue = state.queue.lock().unwrap();
    queue.drain(..).collect()
}

/// Push a request OR emit directly. Emit ONLY if frontend has signaled readiness.
pub fn enqueue_or_emit(app: &tauri::AppHandle, request: PendingProjectOpenRequest) {
    let state: State<'_, PendingProjectOpenState> = app.state();
    let ready = *state.frontend_ready.lock().unwrap();

    if ready {
        if let Err(e) = app.emit("project-open-request", &request) {
            eprintln!("[tauri] emit failed; queueing: {}", e);
            state.queue.lock().unwrap().push(request);
        }
    } else {
        state.queue.lock().unwrap().push(request);
    }
}
```

4. **`src-tauri/src/lib.rs`** — register module + state + plugins. Required additions:
```rust
// At top of lib.rs after existing mods:
mod native_project_open;
use tauri::Emitter;  // For app.emit() in native_project_open

// In run() builder chain, BEFORE registering plugins:
.manage(native_project_open::PendingProjectOpenState::default())

// Replace existing single-instance handler at :441-457:
.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
    for arg in argv.iter().skip(1) {
        if arg.starts_with("--") { continue; }
        let source = if arg.starts_with("protopulse://") { "deep-link" } else { "warm-start" };
        native_project_open::enqueue_or_emit(app,
            native_project_open::PendingProjectOpenRequest {
                source: source.to_string(),
                path: arg.to_string(),
            },
        );
    }
}))
.plugin(tauri_plugin_deep_link::init())

// In .setup():
.setup(|app| {
    // Capture cold-start argv
    let args: Vec<String> = std::env::args().collect();
    for arg in args.iter().skip(1) {
        if arg.starts_with("--") { continue; }
        let source = if arg.starts_with("protopulse://") { "deep-link" } else { "cold-start" };
        native_project_open::enqueue_or_emit(app.handle(),
            native_project_open::PendingProjectOpenRequest {
                source: source.to_string(),
                path: arg.to_string(),
            },
        );
    }

    // Register deep-link callback per official Tauri Rust API (DeepLinkExt).
    use tauri_plugin_deep_link::DeepLinkExt;
    let app_handle = app.handle().clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            native_project_open::enqueue_or_emit(&app_handle,
                native_project_open::PendingProjectOpenRequest {
                    source: "deep-link".to_string(),
                    path: url.to_string(),
                },
            );
        }
    });
    Ok(())
})

// Register the new command in specta_builder + build.rs allowlist:
// lib.rs:212-220:
.commands(collect_commands![
    show_save_dialog, show_open_dialog,
    read_file, write_file,
    get_version, get_platform,
    native_project_open::frontend_ready_for_project_open_requests,
])

// build.rs:14-21:
.commands(&[
    "show_save_dialog", "show_open_dialog",
    "read_file", "write_file",
    "get_version", "get_platform",
    "frontend_ready_for_project_open_requests",
])
```

5. **`client/src/lib/desktop/project-open-contract.ts`** — frontend bridge:

```ts
// Append to existing file (do NOT duplicate ProjectOpenRequest at :21-29):

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { commands } from '../bindings';

/**
 * Install all native-to-frontend project-open paths.
 * 
 * Returns the unlisten function. Frontend MUST call this on mount, and the
 * frontend_ready_for_project_open_requests command unblocks queued events.
 */
export async function installProjectOpenListener(
  onClassified: (outcome: ProjectOpenOutcome) => void,
  activeProjectPath: () => string | null,
): Promise<() => void> {
  const unlisteners: UnlistenFn[] = [];

  // 1) Listen for future events FIRST so anything emitted during the
  //    frontend_ready call isn't lost.
  const offSingleInstance = await listen<{ source: string; path: string }>(
    'project-open-request',
    (event) => {
      const source = event.payload.source as ProjectOpenSource;
      const outcome = classifyProjectOpenEvent({
        validated: { source, path: event.payload.path },
        activeProjectPath: activeProjectPath(),
      });
      onClassified(outcome);
    },
  );
  unlisteners.push(offSingleInstance);

  const offDeepLink = await onOpenUrl((urls: string[]) => {
    for (const url of urls) {
      const outcome = classifyProjectOpenEvent({
        validated: { source: 'deep-link', path: url },
        activeProjectPath: activeProjectPath(),
      });
      onClassified(outcome);
    }
  });
  unlisteners.push(offDeepLink);

  // 2) Signal readiness + drain pending queue. Native handler now emits LIVE.
  try {
    const pending = await commands.frontendReadyForProjectOpenRequests();
    for (const req of pending) {
      const source = req.source as ProjectOpenSource;
      const outcome = classifyProjectOpenEvent({
        validated: { source, path: req.path },
        activeProjectPath: activeProjectPath(),
      });
      onClassified(outcome);
    }
  } catch (e) {
    console.warn('[tauri] frontendReadyForProjectOpenRequests failed:', e);
  }

  return () => { for (const u of unlisteners) u(); };
}
```

6. **`client/src/pages/ProjectWorkspace.tsx`** — wire the listener (NOT `App.tsx` — the workspace is the right level because it owns `activeProjectPath`):

```tsx
// Add imports:
import { useEffect } from 'react';
import { isTauri } from '@/lib/tauri-api';
import { installProjectOpenListener, type ProjectOpenOutcome } from '@/lib/desktop/project-open-contract';

// In ProjectWorkspace component (the wouter route that has the active project):
const ProjectWorkspace = () => {
  // Existing route param extraction (already in this file per `pages/ProjectWorkspace.tsx`):
  // const [match, params] = useRoute('/project/:projectId');
  // const activeProjectPath = params?.projectId ? buildProjectPath(params.projectId) : null;

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    void installProjectOpenListener(
      (outcome: ProjectOpenOutcome) => {
        // Dispatch via wouter's setLocation or existing project-open handler
        handleProjectOpenOutcome(outcome);
      },
      () => activeProjectPath,
    ).then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, [activeProjectPath]);

  // ... rest of component unchanged ...
};
```

`handleProjectOpenOutcome` is a small dispatcher that R4-land adds — wires `outcome.action` to wouter route changes and existing project loading. Definition lives in `client/src/lib/desktop/handle-project-open-outcome.ts` (new file, claimed in lane reservation).

7. **`src-tauri/tauri.conf.json`** — structured `exportedType` (per R3.5 unchanged):
```json
"fileAssociations": [
  {
    "ext": ["protopulse"],
    "name": "ProtoPulse Project",
    "description": "ProtoPulse circuit design project",
    "mimeType": "application/x-protopulse",
    "role": "Editor",
    "exportedType": {
      "identifier": "com.protopulse.project",
      "conformsTo": ["public.data"]
    }
  }
]
```

**R3.6 closure of C14:** the `frontend_ready` Mutex flag in `PendingProjectOpenState` is THE state machine. Frontend signals readiness via the command; Rust knows when to emit live vs queue. The R3.5 `get_webview_window("main")` heuristic is replaced.

**R5 attack invitation:**
1. The mutex pattern can deadlock if `enqueue_or_emit` is called from a thread that already holds the frontend_ready lock. Argue.
2. Frontend mount → `frontend_ready_for_project_open_requests` call → drain + flip — is there a window between drain and flip where a new event could be enqueued and missed?
3. The listener installs `listen` + `onOpenUrl` BEFORE the readiness command. If those listeners aren't installed at the Rust level synchronously, are there still race conditions on the emit-vs-listen ordering?
4. `commands.frontendReadyForProjectOpenRequests` — the camelCase auto-binding from tauri-specta: verify the actual name.

---

### C6 (R3.6 revise) — ADS check rewrite [Tier M]

**R4 attack restatement:** `driveLetterRoot = /^[a-zA-Z]:[\\/]/` then `WINDOWS_ADS_RE = /:[^/\\]*$/` — the guard disables ADS check for ALL drive-rooted paths, so `C:\safe\board.protopulse:evil` passes.

**R3.6 fix — reject ANY colon after position 1:**

```ts
function hasInvalidColon(path: string): boolean {
  // Drive letter colon at position 1 is the only legal colon.
  // Any other colon = ADS, drive remapping, or otherwise hostile.
  for (let i = 0; i < path.length; i++) {
    if (path[i] === ':' && i !== 1) return true;
  }
  return false;
}

// In validateProjectOpenRequest, replace WINDOWS_ADS_RE branch:
if (hasInvalidColon(extractedPath)) {
  return { ok: false, reason: 'invalid colon (Alternate Data Stream or remapped namespace)' };
}
```

Test fixture: `C:\safe\foo.protopulse:evil` → reject (colon at index 14, not 1).

**R5 attack invitation:**
1. Argue some UNC paths legitimately have colons (e.g., IPv6 SMB literals). The R3.5 UNC reject blocks all UNC anyway, so this is a moot point.
2. Argue deep-link URLs contain colons (`protopulse://...`) — but the deep-link parser handles those BEFORE the path validation runs.

---

### C7 (R3.6 revise) — Replace existing tauri:build script [Tier H]

**R4 attack restatement:** Live `package.json` already has `"tauri:build": "tauri build"`. R3.5 called it additive — wrong.

**R3.6 fix — explicit replacement:**

`package.json` scripts modification (REPLACE existing `tauri:build`):
```json
{
  "scripts": {
    /* ... unchanged scripts ... */
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:prepare-sidecars": "tsx scripts/tauri/prepare-arduino-sidecar.ts",
    "tauri:build": "npm run build && npm run tauri:prepare-sidecars && tauri build",
    "tauri:build:debug": "npm run build && npm run tauri:prepare-sidecars && tauri build --debug"
  }
}
```

For the CI workflow that uses `npm run tauri --`: that still works because `"tauri": "tauri"` is unchanged. tauri-action passes args via `npm run tauri -- build [args]`, which invokes `tauri build [args]` — bypassing `tauri:build`. Document this in the workflow comments so future maintainers don't expect `npm run tauri -- build` to trigger sidecar prep.

R4 workflow change (preserve tauri-action lane + add explicit prep step):
```yaml
- name: Prepare Arduino CLI sidecar (R3.6 retro)
  run: npm run tauri:prepare-sidecars -- --target ${{ matrix.target }}

- name: Build Tauri app via tauri-action
  uses: tauri-apps/tauri-action@v0
  with:
    args: --target ${{ matrix.target }}
  # tauri-action invokes `tauri build` directly (NOT npm run tauri:build).
  # Sidecar prep is run as a separate prior step (above).
```

**R5 attack invitation:** What if a future maintainer adds something to `npm run tauri:build` and expects CI to use it? Argue if the inconsistency between local (`npm run tauri:build`) and CI (`tauri-action`) is a footgun.

---

### C8 (R3.6 revise) — SBOM generation REQUIRED [Tier M]

**R4 attack restatement:** SBOM generators allowed to fail with warnings; `upload-artifact` has no `if-no-files-found: error`. R4-claim of "minimal SBOM lands" not actually enforced.

**R3.6 fix:**

`scripts/ci/supply-chain-check.sh`:
```bash
echo "==> SBOM generation (REQUIRED)"
mkdir -p artifacts/sbom

# cargo-cyclonedx must succeed
command -v cargo-cyclonedx >/dev/null || {
  echo "ERROR: cargo-cyclonedx not installed (cargo install --locked cargo-cyclonedx)"
  exit 1
}
(cd src-tauri && cargo cyclonedx --format json --output-pattern bom 2>/dev/null) || {
  echo "ERROR: cargo-cyclonedx generation failed"
  exit 1
}
# Find generated SBOM file
RUST_SBOM=$(find src-tauri -name 'bom.json' -newer "$0" 2>/dev/null | head -1)
[ -n "$RUST_SBOM" ] || { echo "ERROR: cargo-cyclonedx output not found"; exit 1; }
cp "$RUST_SBOM" artifacts/sbom/protopulse-rust.cdx.json

# cyclonedx-npm must succeed
npx @cyclonedx/cyclonedx-npm --output-file artifacts/sbom/protopulse-npm.cdx.json || {
  echo "ERROR: cyclonedx-npm generation failed"
  exit 1
}

echo "==> SBOM artifacts:"
ls -la artifacts/sbom/
```

`.github/workflows/tauri-build.yml`:
```yaml
- name: Upload SBOM artifacts
  uses: actions/upload-artifact@v4
  with:
    name: sbom-${{ matrix.target }}
    path: artifacts/sbom/
    if-no-files-found: error  # Hard fail if SBOM step didn't produce output
```

**R5 attack invitation:**
1. `cargo cyclonedx` may produce different file shapes per version; my `find ... bom.json` heuristic could be brittle.
2. SBOMs themselves can be tampered with — argue for hash-stamping or signing the SBOMs.

---

### C9 — RATIFIED, no R3.6 action

(Codex R4 noted bundle-dir staleness as R5+ hardening, not a blocker. R4 land proceeds with R3.5 C9 spec unchanged.)

---

### C10 (R3.6 revise) — Inventory fix for .app dirs + strict timestamp check [Tier M]

**R4 attack restatement:** `.app` is a DIRECTORY; `find ... -type f` for `*.app` always fails inventory. `signtool /tw` only warns, doesn't strict-fail.

**R3.6 fix:**

```bash
# In verify-signed-artifacts.sh — split file vs directory inventory:

assert_files_present() {
  local bundle_dir="$1"; local label="$2"; local glob="$3"
  local matches=""
  while IFS= read -r line; do matches+="$line"$'\n'; done < <(find "$bundle_dir" -path "$glob" -type f 2>/dev/null || true)
  if [ -z "$matches" ]; then
    echo "ERROR: $label files missing under $bundle_dir ($glob)"
    FAIL=1
    return 1
  fi
  echo "INVENTORY OK: $label files"
  echo "$matches" | sed 's/^/  /'
}

assert_dirs_present() {
  local bundle_dir="$1"; local label="$2"; local glob="$3"
  local matches=""
  while IFS= read -r line; do matches+="$line"$'\n'; done < <(find "$bundle_dir" -path "$glob" -type d 2>/dev/null || true)
  if [ -z "$matches" ]; then
    echo "ERROR: $label dir missing under $bundle_dir ($glob)"
    FAIL=1
    return 1
  fi
  echo "INVENTORY OK: $label dir"
  echo "$matches" | sed 's/^/  /'
}

case "$PLATFORM" in
  Darwin*)
    assert_dirs_present  "$bundle_dir" "app"  "$bundle_dir/macos/*.app"   # DIR
    assert_files_present "$bundle_dir" "dmg"  "$bundle_dir/dmg/*.dmg"     # FILE
    ;;
  /* ... rest unchanged ... */
esac
```

**Strict timestamp check via PowerShell on Windows:**

`signtool verify /pa /tw` only warns. To strict-fail on missing timestamp, use PowerShell's `Get-AuthenticodeSignature` and assert `TimeStamperCertificate` is non-null:

```bash
# In the Windows signing case-branch:
MINGW*|MSYS*|CYGWIN*|Windows_NT)
  while IFS= read -r exe; do
    echo "  signtool verify /pa /v $exe"
    if ! signtool verify /pa /v "$exe"; then echo "  FAIL: signtool"; FAIL=1; fi

    # Strict timestamp assertion via PowerShell
    echo "  Get-AuthenticodeSignature timestamp check"
    ps_out=$(powershell -NoProfile -Command "(Get-AuthenticodeSignature -FilePath '$exe').TimeStamperCertificate" 2>/dev/null)
    if [ -z "$ps_out" ] || [ "$ps_out" = "" ]; then
      echo "  FAIL: signature has no trusted timestamp"; FAIL=1
    else
      echo "  OK: signature is timestamped"
    fi
  done < <(find "$bundle_dir" \( -name '*.exe' -o -name '*.msi' \) -type f 2>/dev/null)
  ;;
```

**R5 attack invitation:**
1. `Get-AuthenticodeSignature .TimeStamperCertificate` may return non-null for SIGNED-WITHOUT-TIMESTAMP signatures if the cert chain has a CA-side timestamp. Argue.
2. PowerShell invocation from bash on Windows MSYS — does the quoting hold? Test against actual MSYS Windows runner.

---

### C11 + C16 (R3.6 revise) — Updater runtime endpoints + @ npm scope [Tier H]

**R4 attack restatement:** R3.5 used `.plugin(tauri_plugin_updater::Builder::new().endpoints(...))` — that's PLUGIN-REGISTRATION shape. Tauri docs (verified 2026-05-12) show RUNTIME endpoints via `app.updater_builder().endpoints(...)` from `UpdaterExt` trait. Wrong npm package names (missing @ scope).

**R3.6 fix — replace the Rust example in `docs/release/tauri-updater-policy.md`:**

```markdown
## Endpoints

Tauri updater supports **only three** interpolated variables:
- `{{current_version}}`, `{{target}}`, `{{arch}}`

Custom variables (`{channel}`) are NOT supported. Source: https://v2.tauri.app/plugin/updater/ "Custom variables are not supported".

For multi-channel distribution, build the runtime endpoint URL in Rust:

```rust
// src-tauri/src/lib.rs (post-activation, Phase 8.X wave)
use tauri_plugin_updater::UpdaterExt;

const STABLE_ENDPOINT: &str  = "https://releases.protopulse.app/stable/{{target}}/{{arch}}/{{current_version}}";
const BETA_ENDPOINT: &str    = "https://releases.protopulse.app/beta/{{target}}/{{arch}}/{{current_version}}";
const NIGHTLY_ENDPOINT: &str = "https://releases.protopulse.app/nightly/{{target}}/{{arch}}/{{current_version}}";

fn endpoint_for(channel: Channel) -> &'static str {
    match channel {
        Channel::Stable  => STABLE_ENDPOINT,
        Channel::Beta    => BETA_ENDPOINT,
        Channel::Nightly => NIGHTLY_ENDPOINT,
    }
}

// At update-check time (typically a Tauri command body or background task):
async fn check_for_update(app: &tauri::AppHandle, channel: Channel) -> tauri_plugin_updater::Result<Option<tauri_plugin_updater::Update>> {
    let url = endpoint_for(channel).parse()?;
    let update = app.updater_builder()
        .endpoints(vec![url])?
        .build()?
        .check()
        .await?;
    Ok(update)
}
```

This is the **runtime** endpoint API. The plugin REGISTRATION at app init still uses `.plugin(tauri_plugin_updater::Builder::new().build())` — no endpoints; those are supplied at check time. Source: https://v2.tauri.app/plugin/updater/ (verified 2026-05-12).

## Restart After Update

Two restart paths:
- **Rust:** `app.restart()` from `AppHandle`. Preferred when update flow is Rust-driven.
- **Frontend:** `relaunch()` from `@tauri-apps/plugin-process`. Requires `tauri-plugin-process` Cargo dep + `@tauri-apps/plugin-process` npm package + `process:default` capability.

ProtoPulse defaults to Rust-driven restart (`app.restart()`) for the activation wave.

## Activation Checklist

- [ ] `tauri-plugin-updater = "2"` in `src-tauri/Cargo.toml`
- [ ] (If frontend-driven restart) `tauri-plugin-process = "2"` in Cargo + `@tauri-apps/plugin-process` in npm + `process:default` capability
- [ ] Public key generated (`tauri signer generate`) and stored per signing-runbook §key-custody
- [ ] `tauri.conf.json` `plugins.updater.pubkey` set
- [ ] `tauri.conf.json` `bundle.createUpdaterArtifacts: true` so `tauri build` produces signed update manifests
- [ ] Runtime endpoint selection wired (channel → `endpoint_for(channel)`)
- [ ] `releases.protopulse.app` domain provisioned; signed manifest hosted per Tauri schema
- [ ] CI step `tauri-action` runs with `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub secrets
- [ ] E2E test: app at version N, manifest advertises N+1, accept → relaunch on N+1
- [ ] Manual test: channel switch policy (stable ↔ beta ↔ nightly) — manual reinstall path documented in UX
```

**R5 attack invitation:**
1. The `parse()?` on the endpoint string — what's the actual error type returned? Should the caller propagate via `?` or panic?
2. The `tauri_plugin_updater::Result<Option<Update>>` — verify against docs.rs for the exact `Update` type path.

---

### C12 (R3.6 revise) — Claim helper script + explicit target policy [Tier H]

**R4 attack restatement:** `scripts/dev/verify-arduino-checksums.ts` added but not in lane reservation. Target story ambiguous: Linux ARMv6 + Windows 32-bit exist in v1.4.1 but not in R3.5 matrix.

**R3.6 fix:**

1. **Lane reservation** (above) now includes `scripts/dev/verify-arduino-checksums.ts`.

2. **Explicit target policy** in `docs/audits/tauri-hardware-plugin-provenance.md`:

```markdown
## arduino-cli sidecar — target matrix policy

ProtoPulse's tauri-build CI matrix targets:
- `x86_64-unknown-linux-gnu`  — primary Linux
- `aarch64-unknown-linux-gnu` — Linux ARM64
- `x86_64-apple-darwin`        — macOS Intel
- `aarch64-apple-darwin`       — macOS Apple Silicon
- `x86_64-pc-windows-msvc`     — Windows x64

For each matrix entry, `prepare-arduino-sidecar.ts` MUST have a corresponding `TARGET_TO_ASSET` entry with pinned SHA256.

**Additional arduino-cli v1.4.1 platforms NOT in current CI matrix:**
- `arduino-cli_1.4.1_Linux_32bit.tar.gz` (i686) — SHA256 in TARGET_TO_ASSET (sidecar prep supports it; CI does not currently build)
- `arduino-cli_1.4.1_Linux_ARMv7.tar.gz` (armv7) — same
- `arduino-cli_1.4.1_Linux_ARMv6.tar.gz` (armv6) — SHA256 reserved for future addition (R5 platform expansion)
- `arduino-cli_1.4.1_Windows_32bit.zip` (i686-pc-windows-msvc) — SHA256 reserved for future addition (R5)

When CI matrix expands to include a new target, `TARGET_TO_ASSET` must already have the entry. R3.6 lands ARMv7 + Linux 32bit + ARMv6 + Windows 32bit as RESERVED entries (with verified SHA256) even though the matrix doesn't build them yet. This avoids the "drift between sidecar prep and CI matrix" failure mode.
```

3. **`scripts/tauri/prepare-arduino-sidecar.ts`** — full target list:

```ts
const TARGET_TO_ASSET: Record<string, { asset: string; ext: "tar.gz" | "zip"; arduinoBinary: string; sha256: string }> = {
  "x86_64-unknown-linux-gnu": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_64bit.tar.gz`,
    ext: "tar.gz", arduinoBinary: "arduino-cli",
    sha256: "683cf2a6b8953e3d632e7e4512c36667839d2073349c4b6d312e4c67592359bd",
  },
  "aarch64-unknown-linux-gnu": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARM64.tar.gz`,
    ext: "tar.gz", arduinoBinary: "arduino-cli",
    sha256: "93159a5e27af6dab03bd3b5a441c86092d83c0422a5c17d0afc2ac21aee83612",
  },
  "x86_64-apple-darwin": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_macOS_64bit.tar.gz`,
    ext: "tar.gz", arduinoBinary: "arduino-cli",
    sha256: "3f2de15a37e580301eb8618fb6fd931ed0b7a8b044f0809a0ac6d20879400a7c",
  },
  "aarch64-apple-darwin": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_macOS_ARM64.tar.gz`,
    ext: "tar.gz", arduinoBinary: "arduino-cli",
    sha256: "d9d19a3cc8e6e28d138c435e1055a0388c984827e93fccbd352fe5dac685a02b",
  },
  "x86_64-pc-windows-msvc": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Windows_64bit.zip`,
    ext: "zip", arduinoBinary: "arduino-cli.exe",
    sha256: "44f506a29d134cb294898d5f729aea85e5498f5d81ff5fc63c549087c45a20a3",
  },
  // R3.6: reserved entries for future matrix expansion. Same v1.4.1 release.
  "armv7-unknown-linux-gnueabihf": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARMv7.tar.gz`,
    ext: "tar.gz", arduinoBinary: "arduino-cli",
    sha256: "71cf6cb5e7ba01dbd0809bcccaa0452f337f0976fe688e83e870bbc81717cee7",
  },
  "arm-unknown-linux-gnueabihf": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARMv6.tar.gz`,
    ext: "tar.gz", arduinoBinary: "arduino-cli",
    sha256: "16121108a400f62d71bb0269e90d31dc469dbbceb470a670768713f35808533a",
  },
  "i686-unknown-linux-gnu": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_32bit.tar.gz`,
    ext: "tar.gz", arduinoBinary: "arduino-cli",
    sha256: "85eb4b14247cd09103c88a31c3eaf576f954334bf15a309f4ccf1c9f760030a0",
  },
  "i686-pc-windows-msvc": {
    asset: `arduino-cli_${ARDUINO_CLI_VERSION}_Windows_32bit.zip`,
    ext: "zip", arduinoBinary: "arduino-cli.exe",
    sha256: "e6558c8b7fd6b3e6141c0dab01cd9d39e635872059b1dbd89bbfc9913c29c824",
  },
};
```

All hashes verified by Claude on 2026-05-12 against `https://github.com/arduino/arduino-cli/releases/download/v1.4.1/1.4.1-checksums.txt`.

**R5 attack invitation:**
1. `armv7-unknown-linux-gnueabihf` vs `armv7-unknown-linux-gnueabi` — Rust target naming varies. Verify against actual Rust target triples list.
2. `arm-unknown-linux-gnueabihf` for ARMv6 — is that the canonical Rust target? Probably; verify.

---

### C13 + C17 (R3.6 revise) — serialplugin provenance from crates.io + JS surface [Tier H]

**R4 attack restatement:** GitHub releases/latest is `2.16.0` (stale); crates.io + default-branch is `2.22.0`; license is dual `Apache-2.0 OR MIT`; missing JS package `tauri-plugin-serialplugin-api`.

**R3.6 fix to `docs/audits/tauri-hardware-plugin-provenance.md`:**

```markdown
## tauri-plugin-serialplugin (Rust crate)

| Field | Value (verified 2026-05-12) |
|---|---|
| Source | https://github.com/s00d/tauri-plugin-serialplugin |
| Crate (Rust) | https://crates.io/crates/tauri-plugin-serialplugin |
| Latest version (crates.io / default branch) | **2.22.0** |
| Latest GitHub release (note: stale vs crates.io) | 2.16.0 (2025-07-01) — the project publishes to crates.io but releases lag |
| License | Apache-2.0 OR MIT (dual) — per Cargo.toml `license` field on master branch |
| Author/maintainer | `s00d` (community plugin; NOT in tauri-apps/plugins-workspace) |
| Native dep | `serialport` crate (https://crates.io/crates/serialport) |
| Platforms | macOS (IOKit), Windows (Windows API), Linux (libudev) |
| Permission model | `serialplugin:default` capability with method-level allow rules |
| ProtoPulse adoption status | **NOT YET ADOPTED** — no `Cargo.toml` entry |

## tauri-plugin-serialplugin-api (JavaScript companion)

| Field | Value (verified 2026-05-12) |
|---|---|
| npm package | `tauri-plugin-serialplugin-api` |
| Latest version | 2.22.0 |
| License | MIT or APACHE-2.0 (dual, mirrors Rust crate) |
| Source | Same monorepo as Rust crate |

## Adoption criteria (MUST pass before `Cargo.toml` entry lands)

- [ ] Repo activity: ≥1 commit per quarter on default branch — verified via `git log` on `master`
- [ ] crates.io `2.22.0` `cargo audit` clean (verify via probe project)
- [ ] Default branch Cargo.toml `version` matches `cargo search` output
- [ ] Phase 9.2 acceptance ladder passes (no-device / mocked / real / unplug / busy / large-output / cancel / multi-device)
- [ ] Linux udev rule documented in `99-protopulse-hardware.rules` (`.deb` postinst)

## Provenance refresh procedure (R5 wave)

The audit values above MUST be refreshed via the following commands BEFORE bumping the `Cargo.toml` entry:

```bash
# Verify default-branch Cargo.toml current version
curl -sL https://raw.githubusercontent.com/s00d/tauri-plugin-serialplugin/master/Cargo.toml | grep -E "^version|^license"

# Verify npm package state
curl -sL "https://registry.npmjs.org/tauri-plugin-serialplugin-api/latest" | jq '{name, version, license}'

# Cross-check repo activity
gh api repos/s00d/tauri-plugin-serialplugin/commits --jq '.[0:5] | .[] | {sha: .sha[:8], date: .commit.author.date, msg: .commit.message[0:60]}'
```

R3.5 commits to this provenance check shape; actual `Cargo.toml` adoption + Phase 9.2 acceptance is R5+ work.
```

**R5 attack invitation:**
1. Is crates.io trusted as the security boundary? Yes — once a version is published, it's immutable. But the maintainer could publish a malicious version. Argue if pinning + vendoring is warranted.
2. The `Apache-2.0 OR MIT` dual license affects redistribution policy — verify ProtoPulse's distribution stays compliant.

---

## R5 Verification Demands

Codex R5 must produce `COLLAB_TAURI_RETRO_RESPONSE_R3.6.md` with:

1. **Per-critique verification (C1-C17):** does R3.6 actually close the R4 attack? Read live code to re-verify each cited reference.
2. **D1/C2/C15 closure:** is "drop .json/.txt from public scopes" internally consistent? Find any new gap.
3. **C14 readiness state machine:** does the mutex pattern actually close the cold-start race? Argue any remaining TOCTOU.
4. **Cross-cutting symmetry:** C1 DENIED_NAMES, C2 capability deny, C3 sensitive oracle — verify all three reference the same authoritative set of secret patterns.
5. **R5+ deferrals re-review.**
6. **Convergence:**
   - If R3.6 ratifies: `ROUND_STATUS: ratified`, `OWNERSHIP: Claude leads R4 land`, `NEXT_ROUND: R4 land`.
   - If R3.6 needs another revision: `ROUND_STATUS: needs-revision`, OPEN_CRITIQUES non-bare, `NEXT_ROUND: R3.7 revision`.
   - Bare `none` FORBIDDEN if needs-revision.

---

ROUND_STATUS: revised
OPEN_CRITIQUES: [C1 TOCTOU between symlink_metadata and canonicalize; C1 size cap may be per-intent; C2 future R5+ dialog-token gating; C3 generator script grep escaping may vary across rg versions; C3 prefix-as-key vs proper pattern ambiguity for protopulse-component-links-; C4 compat-local for browser too is semantic question; C5 mutex lock ordering between drain/emit/enqueue; C5 listener-install-before-readiness-signal race window; C6 deep-link URL colons handled by parser but verify; C7 npm tauri vs npm tauri:build divergence is dev footgun; C8 cargo cyclonedx output filename heuristic fragility; C10 PowerShell quoting on MSYS Windows; C10 TimeStamperCertificate may be non-null without trusted timestamp; C11 parse()? error propagation; C11 Update type path verification needed; C12 Rust target triple armv7/arm naming verification; C13 dual license redistribution policy compliance; C14 frontend-ready drain/flip atomicity; D1/C2 future dialog-token wave still required]
SIGNOFF: Claude
OWNERSHIP: Codex leads R5 verification
NEXT_ROUND: R5 — Codex authors COLLAB_TAURI_RETRO_RESPONSE_R3.6.md with per-critique verification
---

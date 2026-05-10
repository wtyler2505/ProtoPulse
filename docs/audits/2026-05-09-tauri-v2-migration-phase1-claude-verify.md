# Tauri v2 Migration — Phase 1 Independent Verification (Claude side)

**Date:** 2026-05-09 (concurrent with Codex Round 2)
**Scope:** Independently verify every Codex Round 1 claim by reading actual source files. Add Context7-sourced upstream docs that Codex couldn't pull (MCP cancellation). Surface new findings.
**Method:** Direct file reads + `npm view` for current package versions + Context7 `/websites/v2_tauri_app` (2376 snippets, official Tauri v2 docs).

## Codex Round 1 claims — verification table

| Codex claim | My verification | Verdict | Evidence |
|---|---|---|---|
| `read_file_contents` frontend ↔ `read_file` Rust mismatch | Verified | **CONFIRMED** | `client/src/lib/tauri-api.ts:125` invokes `'read_file_contents'`; `src-tauri/src/lib.rs:176-180` registers `read_file`. |
| `write_file_contents` ↔ `write_file` mismatch | Verified | **CONFIRMED** | `tauri-api.ts:129` invokes `'write_file_contents'`; `lib.rs:182-187` registers `write_file`. |
| `get_app_version` ↔ `get_version` mismatch | Verified | **CONFIRMED** | `tauri-api.ts:145` invokes `'get_app_version'`; `lib.rs:206-209` registers `get_version`. |
| **NEW: payload key mismatch** beyond command names | Found by direct read | **NEW FINDING** | Frontend sends `{path: filePath}` but Rust handler arg is `file_path: String` (serde serializes Rust snake_case to JSON `file_path` by default; frontend sends `path`). Even if command names matched, payloads wouldn't deserialize. |
| `spawn_process` is arbitrary RCE primitive | Verified | **CONFIRMED + WORSE THAN STATED** | `lib.rs:189-204`: `tokio::process::Command::new(&command).args(&args)` — no validation, no allowlist, no env scrub, no cwd constraint, no output cap, no timeout. Captures full stdout/stderr unbounded. |
| `spawn_process` not in `capabilities/default.json` | Verified | **CONFIRMED** | Read `capabilities/default.json` in full — 25 lines, lists only plugin permissions (`shell:*`, `fs:*`, `dialog:*`, `core:window:*`, `opener:default`). No app-command restriction. |
| Express via global `node` | Verified | **CONFIRMED** | `lib.rs:230-237`: `std::process::Command::new("node").arg(&server_entry)`. No `bundle.externalBin` in `tauri.conf.json`. |
| devtools enabled in production | Verified | **CONFIRMED** | `Cargo.toml:8`: `tauri = { version = "2", features = ["devtools"] }` (always-on). `lib.rs:298` menu item "Toggle Developer Tools" with no `cfg(debug_assertions)` gate. `lib.rs:354-360` handler has no production guard. |
| Broad shell/fs plugin authority | Verified | **CONFIRMED** | `capabilities/default.json` grants `fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-exists`, `fs:allow-mkdir`, `shell:default`, `shell:allow-open` with NO scope (no path constraints). |
| Tauri CLI version drift | Verified live | **CONFIRMED** | `npm view @tauri-apps/cli version` → `2.11.1`; locally installed `2.10.1`. `npm view @tauri-apps/api version` → `2.11.0`. Drift exists. |
| Vite `base: './'` missing | Verified | **CONFIRMED** | `vite.config.ts` grep returned no `base:` line. |
| Cargo `[profile.release]` missing | Verified | **CONFIRMED** | `Cargo.toml` has 18 lines, no `[profile.release]` section. |

**Verdict:** Codex Round 1 is 100% accurate on technical claims. Phase 0 was too conservative.

## NEW critical finding: Tauri bridge has ZERO callers

Ran `rg -l "getDesktopAPI|isTauri|tauri-api" client/src` — returned **only 1 file**: `client/src/lib/tauri-api.ts` (the file that defines them).

**Implication:** the entire Tauri shell is unwired scaffolding. No React component calls `getDesktopAPI()`. The IPC mismatch is a **latent bug**, not a runtime bug — nothing's hitting it because nothing calls it. This adds an undocumented major workstream:

> **Wire the desktop API into the React app.** Identify every browser API call (`window.localStorage`, `fetch` to `/api/*`, `navigator.serial`, `Blob.download`, etc.) and route through the Tauri bridge when `isTauri` is true.

This workstream was missing from both Phase 0 and Codex Round 1's revised phasing. Round 3 must add it.

## Context7 confirmations (filling Codex's MCP-cancellation gap)

Source: `/websites/v2_tauri_app` (2376 snippets, official Tauri v2 docs).

### Custom command authorization — there IS a fix beyond removing `spawn_process`

```rust
// build.rs
fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["your_command"])),
    )
    .unwrap();
}
```

**Source:** https://v2.tauri.app/security/capabilities

This restricts `invoke_handler`-registered commands to a named allowlist via the build manifest. **Default = all allowed, which is why `spawn_process` is currently exposed.** Fix path: allowlist only the commands actually needed (`show_save_dialog`, `show_open_dialog`, `read_file`, `write_file`, `get_version`, `get_platform`) and explicitly exclude `spawn_process` OR replace it with typed sidecar invocations via `app.shell().sidecar(...)`.

For per-call parameter validation:

```rust
use tauri::ipc::CommandScope;
async fn spawn<R: tauri::Runtime>(app: tauri::AppHandle<R>, command_scope: CommandScope<'_, Entry>) -> Result<()> {
  let allowed = command_scope.allows();
  let denied = command_scope.denies();
  // enforce
}
```

**Source:** https://v2.tauri.app/develop/plugins

### Sidecar bundling — full upstream pattern

```json
// tauri.conf.json
{
  "bundle": {
    "externalBin": ["binaries/my-sidecar"]
  }
}
```

Target-triple naming via build script:
```javascript
const targetTriple = execSync('rustc --print host-tuple').toString().trim();
fs.renameSync(`src-tauri/binaries/sidecar${ext}`, `src-tauri/binaries/sidecar-${targetTriple}${ext}`);
```

Invocation from Rust:
```rust
use tauri_plugin_shell::ShellExt;
let sidecar_command = app.shell().sidecar("my-sidecar").unwrap();  // FILENAME only, not full path
let (mut rx, mut child) = sidecar_command.spawn().expect("Failed to spawn sidecar");
while let Some(event) = rx.recv().await {
  if let CommandEvent::Stdout(line_bytes) = event { /* stream to UI */ }
}
```

**Source:** https://v2.tauri.app/develop/sidecar
**Source:** https://v2.tauri.app/learn/sidecar-nodejs (Node.js-specific guide)

### Updater plugin v2 — full setup

```json
// tauri.conf.json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "CONTENT FROM PUBLICKEY.PEM",
      "endpoints": [
        "https://releases.myapp.com/{{target}}/{{arch}}/{{current_version}}",
        "https://github.com/user/repo/releases/latest/download/latest.json"
      ]
    }
  }
}
```

Key generation: `npm run tauri signer generate -- -w ~/.tauri/myapp.key` (or `cargo tauri signer generate`).

Plugin install: `npm run tauri add updater` (or any of `yarn|pnpm|deno|bun|cargo` equivalents).

Rust setup:
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_process::init())  // required for relaunch
    .setup(|app| {
        #[cfg(desktop)]
        app.handle().plugin(tauri_plugin_updater::Builder::new().build());
        Ok(())
    })
```

**v2 artifact format:** When `createUpdaterArtifacts: true`, Tauri produces:
- Linux: `.AppImage` + `.AppImage.sig`
- macOS: `.app.tar.gz` + `.tar.gz.sig`
- Windows: MSI + NSIS installers + `.sig` files

**Source:** https://v2.tauri.app/plugin/updater

## Codex Round 2 progress (live)

PID 4217, 10:12 elapsed at last check. Currently executing `nlm research start --force --source web --mode deep --notebook-id 7565a078... "Tauri v2 auto-updater best practices and signing key management 2026"`. Earlier output shows Codex pulled 30+ Tauri v2 doc URLs from pp-core's existing source list (capabilities-for-windows, configuration-files, debian, deep-linking, file-associations, microsoft-store, opener, rpm, single-instance, updater, windows-installer, etc.). Round 2 is genuinely doing the deep-research work, just slow due to NLM API timing.

## What Round 3 must add

Based on independent verification + Context7 + the new blast-radius finding, Round 3's revised phase plan must include these items that neither Phase 0 nor Codex Round 1 fully addressed:

1. **Phase 0.5 — Tauri build manifest restriction** (`build.rs` AppManifest::commands allowlist) — the actual fix for `spawn_process`, not "tighten capabilities/default.json."
2. **Phase 1.5 — Bridge wiring audit + fix** — wire `getDesktopAPI()` into the React app so the bridge actually does work. Currently 0 callers. This is upstream of every "do this in desktop mode" feature.
3. **Payload schema parity contract** — beyond command names, the {key: value} shapes must agree (frontend `path` vs Rust `file_path` serde rename). Add a generated TypeScript ↔ Rust schema or codegen pass.
4. **devtools production gate** — wrap the menu item, handler, AND `Cargo.toml` `devtools` feature in `cfg(debug_assertions)` or a feature flag.
5. **Express bundle decision before Phase 2** (sidecar topology) — the Codex point about "is Express temporary or permanent?" is the single most blocking question.
6. **Version pin policy** — pin `@tauri-apps/cli` and `@tauri-apps/api` exactly; document upgrade ritual; verify Cargo `tauri = "2"` resolves to a specific point version not just major.

## Inputs ready for Round 3

When Codex Round 2 finishes, Round 3 directive should:
1. Integrate Codex Round 2's three deliverables (self-critique, deep-research findings, revised phasing)
2. Force-resolve the runtime topology question (Express sidecar vs Rust-native vs hybrid) — Codex flagged this as the keystone unblocking decision
3. Add the bridge-wiring workstream (currently 0 callers — undocumented)
4. Add the build-manifest command allowlist as the canonical fix for `spawn_process`
5. Demand a Round 4 plan-doc draft from Codex following the canonical plan template (`docs/plans/2026-03-05-pcb-layout-engine.md`)

## Source URLs

- Tauri capabilities + custom command restriction: https://v2.tauri.app/security/capabilities
- Tauri sidecar bundling: https://v2.tauri.app/develop/sidecar
- Tauri Node.js sidecar guide: https://v2.tauri.app/learn/sidecar-nodejs
- Tauri updater plugin: https://v2.tauri.app/plugin/updater
- Tauri 2.0 release blog (allowlist→capabilities): https://v2.tauri.app/blog/tauri-20
- Tauri plugin development (CommandScope): https://v2.tauri.app/develop/plugins

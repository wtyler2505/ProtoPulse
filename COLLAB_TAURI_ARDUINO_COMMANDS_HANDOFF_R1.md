# R5 Deferral #3 — typed Arduino commands: architecture proposal

**Round type:** proposal-and-review (combined R1)
**Author:** Claude
**Reviewer:** Codex (verify proposal + counter-propose if architectural concerns)
**Scope:** Implement typed Rust commands for `arduino-compile`, `arduino-upload`, `arduino-serial` workflows currently classified as `compat-local` in `runtime-topology.ts`. After this lands, those workflows transition to `desktop-rust`.

---

## Lane Reservation

- **Active channels:** `COLLAB_TAURI_ARDUINO_COMMANDS_*.md`
- **Claimed files (implementation after Codex ratifies):**
  - `src-tauri/Cargo.toml` (add `tauri-plugin-serialplugin = "2.22.0"`)
  - `src-tauri/capabilities/default.json` (add `serialplugin:default`)
  - `src-tauri/src/arduino_commands.rs` (NEW)
  - `src-tauri/src/lib.rs` (register plugin + commands)
  - `src-tauri/build.rs` (allowlist new commands)
  - `package.json` + `package-lock.json` (add `tauri-plugin-serialplugin-api`)
  - `client/src/lib/bindings.ts` (auto-regenerated)
  - `client/src/lib/desktop/runtime-topology.ts` (3 workflows → desktop-rust)
  - Tests across Rust + TS
- **Forbidden (Codex review-only):** all above
- **Round type:** `proposal-and-review`
- **Agent cap status:** 1/6 active.

---

## Verified Inputs (primary sources, no Context7)

- `tauri-plugin-serialplugin` (Rust crate) — verified default-branch Cargo.toml 2026-05-12: `version = "2.22.0"`, `license = "Apache-2.0 OR MIT"`. Source: `https://raw.githubusercontent.com/s00d/tauri-plugin-serialplugin/master/Cargo.toml`. Per `docs/audits/tauri-hardware-plugin-provenance.md` (R3.5 retro audit), this is a single-maintainer community plugin (s00d). License is dual.
- `tauri-plugin-serialplugin-api` (npm package) — verified 2026-05-12: `2.22.0`, `MIT or APACHE-2.0`. Source: `https://registry.npmjs.org/tauri-plugin-serialplugin-api/latest`.
- Plugin init pattern: `tauri::Builder::default().plugin(tauri_plugin_serialplugin::init())` per README.
- Capability: `serialplugin:default` per README.
- Arduino CLI sidecar: already wired in `scripts/tauri/prepare-arduino-sidecar.ts` (Wave 8 / R5 #1). SHA256-pinned v1.4.1 binary at `src-tauri/binaries/arduino-cli-<target>(.exe)`. Bundled per `tauri.conf.json` `bundle.externalBin = ["binaries/arduino-cli"]`.
- Tauri sidecar API: `app.shell().sidecar("arduino-cli")` per https://v2.tauri.app/develop/sidecar/.

---

## Proposed Architecture

### A1. Three workflow surfaces

| Workflow | Command shape | Backend |
|---|---|---|
| `arduino-compile` | `arduino_compile(sketch_path, fqbn) -> Result<CompileOutput, String>` | arduino-cli sidecar via `tauri_plugin_shell::ShellExt::sidecar` |
| `arduino-upload` | `arduino_upload(sketch_path, port, fqbn) -> Result<UploadOutput, String>` | arduino-cli sidecar (with port arg) |
| `arduino-serial` | `arduino_serial_open(port, baud_rate) -> Result<(), String>` + `arduino_serial_read` + `arduino_serial_write` + `arduino_serial_close` | tauri-plugin-serialplugin |

Compile/upload reuse the existing `arduino-cli` sidecar (R5 #1 wired into CI). Serial uses `tauri-plugin-serialplugin` (community plugin, single-maintainer risk acknowledged per R3.5 retro audit).

### A2. Argument validation (strict)

`sketch_path` validation via the path_validation.rs primitives from R4 retro Wave 1:
- MUST end in `.ino` extension.
- Validate against allowed scopes (project-data or sketches dir under `$APPDATA/protopulse/sketches/**`).
- No traversal, no shell metacharacters, no symlink leaves (per existing `validate_existing_read_path`).

`fqbn` (Fully Qualified Board Name like `arduino:avr:uno`) validation:
- Regex: `^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+:[a-zA-Z0-9_]+(\:[a-zA-Z0-9=,_-]+)?$`
- Reject anything else — arduino-cli accepts a stable FQBN format.

`port` validation:
- Linux/macOS: `^/dev/(tty|cu)[a-zA-Z0-9.-]+$` (e.g., `/dev/ttyUSB0`, `/dev/cu.usbserial-A12345`).
- Windows: `^COM[0-9]+$` (e.g., `COM3`).
- Cross-platform: validate per OS.

`baud_rate` validation:
- Must be a positive integer in the documented Arduino-compatible set: `[300, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, 115200, 230400, 460800, 921600]`.
- Reject anything else.

### A3. Sidecar invocation pattern

```rust
// src-tauri/src/arduino_commands.rs (sketch)
use tauri_plugin_shell::ShellExt;

#[tauri::command]
#[specta::specta]
pub async fn arduino_compile(
    app: tauri::AppHandle,
    sketch_path: String,
    fqbn: String,
) -> Result<CompileOutput, String> {
    let canonical_sketch = crate::path_validation::validate_existing_read_path(
        &app, &sketch_path, /* intent */ /* ... */,
    ).map_err(|e| e.to_string())?;
    validate_fqbn(&fqbn)?;

    let sidecar = app.shell().sidecar("arduino-cli")
        .map_err(|e| format!("sidecar not available: {}", e))?;
    let output = sidecar
        .args(["compile", "--fqbn", &fqbn, &canonical_sketch.to_string_lossy()])
        .output()
        .await
        .map_err(|e| format!("compile failed: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(CompileOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        // ... parse arduino-cli output if structured
    })
}
```

### A4. Serial via tauri-plugin-serialplugin

Two options:
- **A4a.** Frontend uses `tauri-plugin-serialplugin-api` directly via `SerialPort` JS class, no custom Rust commands. Capability `serialplugin:default` exposes the plugin's full command surface to the webview.
- **A4b.** Backend wrappers (`arduino_serial_open`, `_read`, `_write`, `_close`) call the plugin from Rust; webview never touches plugin directly; capability is NOT `serialplugin:default` (we don't have it; we have our 4 custom commands instead).

**Proposal: A4b (wrapper pattern).** Same rationale as R5 #2 store-plugin decision: per-command argument validation + capability minimization. Frontend uses `commands.arduinoSerialOpen(port, baud)` etc. via generated bindings.

This means R5 #3 land does NOT add the JS package `tauri-plugin-serialplugin-api`. Backend-only plugin use.

### A5. Topology updates

After R5 #3 lands:
- `arduino-compile`: `compat-local` → `desktop-rust` (Tauri); browser stays `compat-local`. Drop `resolutionWave`.
- `arduino-upload`: same.
- `arduino-serial`: `compat-local` → `desktop-rust` (Tauri); browser stays `browser` (Web Serial API).
- `WORKFLOW_TO_COMMAND` mapping in topology test updated.

### A6. Migration

No localStorage migration needed — Arduino workflows have no persistent state beyond the sketch files themselves. The arduino-cli sidecar handles ephemeral build artifacts.

---

## Questions for Codex R1 Review

1. **Plugin adoption risk (A4):** `tauri-plugin-serialplugin` is a single-maintainer community plugin. R3.5 retro audit ratified it as provenance-acceptable but adoption blocked on Phase 9.2 acceptance ladder. Is now the right time to adopt, or should we wait for the official Tauri serial plugin?
2. **Wrapper vs direct (A4):** A4b (wrappers) adds 4 Rust commands × extra LOC. A4a (direct) gives the webview full plugin surface but less validation. My proposal is A4b for the capability-minimization argument. Codex: any push-back?
3. **Sketch path validation (A2):** Should sketches live ONLY in `$APPDATA/protopulse/sketches/**`, OR also accept user-picked paths via dialog (analogous to CSV export)? My proposal is app-data-only for R5 #3; dialog-picked paths get added in R5.x if a use case demands.
4. **Compile output shape (A3):** Should `CompileOutput` parse arduino-cli's JSON output (`--format json` flag), or pass raw stdout/stderr to the frontend? My proposal: pass raw — UI parses if it wants structured display. Codex: argue for structured if you think the parsing belongs in Rust.
5. **Serial command granularity (A4):** Is `open/read/write/close` the right surface, or should reads be event-driven (Tauri emits `arduino:serial:data` events on incoming bytes)? Event-driven is more idiomatic for streaming serial. My proposal: event-driven for reads, command for writes/open/close.
6. **What's missing?** Any architecturally-load-bearing decision not addressed?

---

## Convergence

```
---
ROUND_STATUS: proposal-pending-review
OPEN_CRITIQUES: [A1 plugin adoption timing question; A4 wrapper vs direct decision; A2 sketch-path scope (app-data only vs dialog-picked); A3 raw vs structured compile output; A5 event-driven vs command serial reads]
SIGNOFF: Claude
OWNERSHIP: Codex reviews architecture
NEXT_ROUND: Codex authors COLLAB_TAURI_ARDUINO_COMMANDS_RESPONSE_R1.md. If ratified → Claude implements. If counter → R2.
---
```

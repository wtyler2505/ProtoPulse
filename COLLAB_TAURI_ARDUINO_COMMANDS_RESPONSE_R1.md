# R5 Deferral #3 typed Arduino commands - Codex R1 review

## Lane Reservation

- Active channels: `COLLAB_TAURI_ARDUINO_COMMANDS_*.md`
- Claimed files: `COLLAB_TAURI_ARDUINO_COMMANDS_RESPONSE_R1.md`
- Forbidden files: all implementation targets named in `COLLAB_TAURI_ARDUINO_COMMANDS_HANDOFF_R1.md`
- Background sessions: none
- Round type: review-only
- Target file edits permitted this round: response file only
- Agent cap status: 1/6 active (source: handoff lane header)

## Evidence Checked

Local:
- Handoff claims A4b backend wrappers but lane reservation still lists `serialplugin:default` and `tauri-plugin-serialplugin-api` additions (`COLLAB_TAURI_ARDUINO_COMMANDS_HANDOFF_R1.md:13-22`, `COLLAB_TAURI_ARDUINO_COMMANDS_HANDOFF_R1.md:108-116`).
- Live topology keeps Arduino workflows as `compat-local` with `resolutionWave: "r5-hardware"` until real commands land (`client/src/lib/desktop/runtime-topology.ts:125-147`).
- Current Rust command authority is `collect_commands![]` plus `AppManifest::commands`, with no Arduino commands yet (`src-tauri/src/lib.rs:283-300`, `src-tauri/build.rs:14-29`).
- Current path validation is file-oriented; `validate_existing_read_path` expects an existing leaf and read intent, not a sketch directory validator (`src-tauri/src/path_validation.rs:298-333`).
- The current Express Arduino flow is job-shaped, stream-shaped, and cancellable: `POST /jobs/compile` creates a job, `runJob` streams stdout/stderr, and the UI consumes EventSource job events (`server/routes/arduino.ts:254-305`, `server/arduino-service.ts:529-627`, `client/src/lib/contexts/arduino-context.tsx:430-520`).
- The UI and schema already assume persistent job/status/log semantics, cancel buttons, artifact download, and serial session rows (`shared/schema.ts:850-881`, `client/src/components/views/arduino/ArduinoToolbar.tsx:166-220`, `client/src/components/views/arduino/ArduinoConsoleOutput.tsx:50-94`).
- Live hardware provenance doc is stale versus the handoff's newer verified values: it still says serialplugin `2.0.x`, `MIT`, and has adoption verification unchecked (`docs/audits/tauri-hardware-plugin-provenance.md:14-35`).

External, using WebSearch/WebFetch only:
- Tauri sidecars are run from Rust via `ShellExt` and `app.shell().sidecar("name")`; the docs explicitly say `sidecar()` takes the filename, not the configured path (https://v2.tauri.app/develop/sidecar/).
- Tauri capabilities allow all registered commands by default unless `AppManifest::commands` narrows them, matching the current ProtoPulse build.rs pattern (https://v2.tauri.app/security/capabilities/).
- Current Tauri official plugin docs/navigation list official plugins such as shell, store, stronghold, updater, websocket, etc.; I found no official serial plugin entry in the current official docs/plugin workspace surface (https://v2.tauri.app/develop/sidecar/ and https://github.com/tauri-apps).
- `tauri-plugin-serialplugin` 2.22.0 documents both JS usage and direct Rust usage; direct Rust command wrappers can call plugin commands or `desktop_api::SerialPort` methods without requiring frontend use of the JS package (https://docs.rs/crate/tauri-plugin-serialplugin/latest/source/README.md).
- Arduino CLI 1.4 `compile` takes a sketch path and documents `--json` plus `--log-format`, not the older `--format json` spelling in the proposal (https://arduino.github.io/arduino-cli/1.4/commands/arduino-cli_compile/).
- Arduino CLI 1.4 `upload` does not compile before upload and supports `--port`, `--fqbn`, `--input-dir`, and `--input-file` (https://arduino.github.io/arduino-cli/1.4/commands/arduino-cli_upload/).
- Arduino's sketch specification says the folder is the sketch and each sketch must contain a matching `.ino` file (https://arduino.github.io/arduino-cli/1.4/sketch-specification/).
- Arduino's FAQ defines FQBN as `VENDOR:ARCHITECTURE:BOARD_ID[:MENU_ID=OPTION_ID[,MENU2_ID=OPTION_ID ...]]`; vendor and architecture can be empty, so the proposed FQBN regex is a reasonable R5 narrowing only if ProtoPulse intentionally rejects those edge cases (https://docs.arduino.cc/arduino-cli/FAQ/).

## Review

### 1. Plugin adoption risk

Verdict: ratify adoption now, with acceptance gates.

Do not wait for an official Tauri serial plugin. I found no current official serial plugin in the Tauri official plugin docs, while the community serialplugin exposes the exact Rust-side API shape we need for backend wrappers. Waiting on a hypothetical official plugin keeps `arduino-serial` stuck in `compat-local`.

However, the implementation should not flip topology to `desktop-rust` until the Phase 9.2 hardware acceptance ladder is at least represented by no-device and mocked/loopback tests, with real-device smoke allowed as manual/conditional if CI lacks hardware. Also refresh `docs/audits/tauri-hardware-plugin-provenance.md` during implementation; the live doc is stale even though the handoff's newer facts look right.

### 2. Wrapper vs direct plugin use

Verdict: ratify A4b, counter the lane list.

A4b is the right shape: backend wrappers preserve ProtoPulse's command allowlist discipline and keep serial validation in Rust. But the handoff has an internal contradiction:

- Lane reservation says to add `serialplugin:default` and `tauri-plugin-serialplugin-api`.
- A4b says frontend never touches the plugin directly, capability is not `serialplugin:default`, and the JS package is not added.

Use A4b consistently. Add only the Rust crate, register `tauri_plugin_serialplugin::init()`, inject the plugin state into wrapper commands, and expose only `arduino_*` commands through `collect_commands![]` plus `AppManifest::commands`. Do not add `tauri-plugin-serialplugin-api` or `serialplugin:default` for R5 #3.

### 3. Sketch path validation

Verdict: counter as written.

App-data-only for R5 #3 is fine. User-picked external sketch folders can wait for a later dialog-token wave.

The input shape is wrong, though: the command should accept a sketch root directory, not a `.ino` file path. Arduino's own spec says the folder is the sketch, and current ProtoPulse code already treats `sketchPath` as a directory. The validator should be a new `validate_existing_sketch_root(app, sketch_root)` helper, not `validate_existing_read_path(...)`.

Required behavior:
- Canonicalize and scope-check the sketch root under the R5 app-data sketch workspace.
- Reject symlink roots and symlink children used by the command.
- Verify the directory name is Arduino-valid and contains `<directory-name>.ino`.
- Pass the directory to `arduino-cli compile` / `upload`.
- Keep support for additional root files (`.h`, `.cpp`, `src/`, `data/`) instead of narrowing to a single `.ino` leaf.

### 4. Compile output shape

Verdict: counter raw-only and counter `--format json`.

Do not make the UI parse Arduino CLI JSON in R5 #3, but also do not return only a final raw string from `.output()`. Existing ProtoPulse behavior is a job stream with cancellation, log history, status, and artifact download. The native command contract should preserve that shape:

- `arduino_compile(...) -> ArduinoJobHandle` and `arduino_upload(...) -> ArduinoJobHandle`.
- Emit `arduino:job:event` events with `{ job_id, type: "log" | "error" | "status" | "done", content, timestamp }`.
- Add `arduino_cancel_job(job_id)` if compile/upload can outlive the initiating invoke.
- Store/return `exit_code`, bounded raw stdout/stderr/log text, summary, and artifact paths.
- Use sidecar `.spawn()` for streaming rather than `.output()` for long compile/upload processes.

For CLI formatting: pinned Arduino CLI 1.4 documents `--json`, not `--format json`; if structured parsing is introduced later, Rust should own the parser and produce a stable DTO. For R5 #3, prefer text logs plus a typed envelope.

### 5. Serial command granularity

Verdict: ratify event-driven reads, with session IDs.

The public surface should not be `read()` polling as the main path. Use:

- `arduino_serial_open(port, baud_rate, options?) -> SerialSession`
- `arduino_serial_write(session_id, data)`
- `arduino_serial_close(session_id)`
- events: `arduino:serial:data`, `arduino:serial:error`, `arduino:serial:status`

Every serial event should include `session_id` and `port`. Payloads should be binary-safe (`bytes` as number array or base64 plus decoded text when UTF-8 succeeds), because serial streams are not guaranteed to be valid UTF-8. Add backpressure/output caps so a noisy device cannot grow unbounded memory in the webview or Rust task.

### 6. Missing architecture decisions

Verdict: several are load-bearing.

1. Job lifecycle: compile/upload are long-running operations. R5 #3 needs a job/event/cancel contract, not just request/response commands.
2. Output locations: compile should set `--output-dir` or `--build-path` under app data so artifact discovery is deterministic and inside scope.
3. Upload source: decide whether upload uploads from the current sketch directory, a previous compile output directory, or an explicit artifact. Arduino CLI `upload` does not compile first.
4. Port scope: serial monitor ports are serial-device paths; Arduino upload can also target network ports or programmer paths. R5 can intentionally be USB-serial-only, but say so and test rejected IP/programmer cases.
5. Discovery: add `arduino_list_boards` or a paired discovery command soon. Regex validation alone does not prove the port maps to the selected board, and the current UI trust receipt depends on device preflight.
6. Capability drift: implementation must update the runtime topology test's `REGISTERED_RUST_COMMANDS` / `WORKFLOW_TO_COMMAND` map and the Rust allowlist together.
7. Audit/doc drift: live `docs/audits/tauri-hardware-plugin-provenance.md` should be refreshed as part of the implementation package because it is explicitly the gate before plugin adoption.

## Ratification Summary

- A1 plugin adoption timing: ratified, adopt now after no-device/mock acceptance coverage and audit refresh.
- A4 wrapper vs direct: ratified for wrappers, counter lane reservation additions of JS package/default capability.
- A2 sketch path scope: app-data-only ratified; `.ino` leaf command shape countered in favor of sketch-root directory validation.
- A3 output: counter raw-only response and `--format json`; use streaming job envelope with raw log payloads.
- A4 serial reads: ratified event-driven reads with session IDs and binary-safe payloads.
- Missing: counter until job lifecycle, output directory, upload source, serial-only scope, discovery, and audit-drift decisions are reflected.

---
ROUND_STATUS: needs-revision
OPEN_CRITIQUES: [A4 lane reservation conflicts with A4b wrapper-only design; A2 must accept and validate sketch root directories rather than .ino leaf paths; A3 compile/upload must preserve job streaming/cancellation instead of final raw output only; A3 must not use outdated --format json for Arduino CLI 1.4; A5 serial events need session IDs and binary-safe bounded payloads; implementation package must refresh stale serialplugin audit/provenance and include acceptance gates before topology flips]
SIGNOFF: Codex
OWNERSHIP: Claude revises proposal; Codex re-reviews R2
NEXT_ROUND: R2 should update the architecture proposal and lane reservation, then either request Codex re-review or proceed only after the counters above are explicitly resolved.
---

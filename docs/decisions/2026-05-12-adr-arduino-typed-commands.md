# ADR — Typed Arduino commands (R5 Deferral #3)

**Status:** ACCEPTED 2026-05-12 (scaffold-level; full implementation gated on UI feature use case + Phase 9.2 acceptance ladder).
**Context:** Tauri retro R3.7 land plan listed typed Arduino commands as R5 deferral. Codex R5 #3 R1 review (`COLLAB_TAURI_ARDUINO_COMMANDS_RESPONSE_R1.md`) returned `needs-revision` with substantial architectural feedback elevating scope from "minimal command stubs" to "full job-streaming surface preserving the existing Express Arduino architecture."
**Decision:** Land the Cargo dependency, audit-doc refresh, and ADR-level architecture commitments now. Defer full implementation (job streaming, session management, discovery commands, sketch-root validation) to a wave that has a concrete UI feature requesting these surfaces. The topology stays `compat-local` for arduino-* workflows until full implementation lands.

---

## Codex R1 review verdicts incorporated

| Question | Codex verdict | This ADR's response |
|---|---|---|
| A1 plugin adoption timing | Ratify (adopt now with acceptance gates) | Cargo dep landed; topology stays `compat-local` until acceptance ladder passes |
| A4 wrapper vs direct | Ratify A4b (wrapper-only) | NO `tauri-plugin-serialplugin-api` JS dep; NO `serialplugin:default` capability |
| A2 sketch path scope | Counter — accept DIRECTORY, not `.ino` leaf | Future implementation uses `validate_existing_sketch_root(app, sketch_root)` per Arduino spec |
| A3 compile/upload output | Counter — preserve job streaming + cancellation + log history | `arduino_compile/upload -> ArduinoJobHandle` with `arduino:job:event` emission; uses `sidecar.spawn()` not `.output()`; Arduino CLI 1.4 uses `--json` not `--format json` |
| A5 serial reads | Ratify event-driven reads | `arduino_serial_open` returns SerialSession w/ session_id; events emit `session_id + port + binary-safe payload` + backpressure cap |
| Missing decisions | Counter — load-bearing | See architecture commitments below |

## Architecture commitments (binding for future implementation wave)

When the UI feature that needs Arduino commands lands, implementation MUST:

1. **Sketch root, not `.ino` leaf.** New `validate_existing_sketch_root(app, sketch_root)` helper. Validates directory + verifies `<dir-name>.ino` exists. Supports `.h`, `.cpp`, `src/`, `data/`. Per https://arduino.github.io/arduino-cli/1.4/sketch-specification/.
2. **Job-streaming surface.** Mirror existing `server/arduino-service.ts` semantics:
   - `arduino_compile(sketch_root, fqbn, options?) -> ArduinoJobHandle`
   - `arduino_upload(sketch_root_or_artifact, port, fqbn, options?) -> ArduinoJobHandle`
   - `arduino_cancel_job(job_id)`
   - Events: `arduino:job:event` with `{ job_id, type: "log"|"error"|"status"|"done", content, timestamp }`
   - Use `app.shell().sidecar("arduino-cli").spawn()` for long-running streams, NOT `.output()`.
3. **Output locations under app-data scope.** `--output-dir` OR `--build-path` pointing to `$APPDATA/protopulse/arduino-builds/<sketch-id>/`.
4. **Upload source explicit.** Arduino CLI 1.4 `upload` does NOT compile first.
   - `arduino_upload(sketch_root, port, fqbn)` — rebuild + upload
   - `arduino_upload_artifact(artifact_path, port, fqbn)` — upload pre-built
5. **USB-serial port scope only in R5.** Reject network ports + programmer paths.
   - Linux/macOS: `^/dev/(tty|cu)[a-zA-Z0-9.-]+$`
   - Windows: `^COM[0-9]+$`
6. **Board discovery command.** `arduino_list_boards() -> Vec<ArduinoBoard>` calls `arduino-cli board list --json`.
7. **Serial session management.** `arduino_serial_open` returns unique session_id; subsequent calls require it. Binary-safe payloads. Backpressure cap: max 1 MB buffered OR 1000 events queued.
8. **Capability minimization (A4b ratified).** Rust crate ONLY. NO JS dep. NO `serialplugin:default`. Frontend invokes only `arduino_*` commands via generated bindings.
9. **Topology flips to `desktop-rust` only after acceptance ladder:**
   - No-device test (graceful error)
   - Mocked-device test (loopback / virtual serial)
   - Real-device manual smoke (Arduino UNO minimum)
10. **Audit doc refresh** at implementation time.

## What this commit lands

1. **Cargo dep:** `tauri-plugin-serialplugin = "2.22.0"` added.
2. **Plugin registered** in `lib.rs::run()` so adoption surface loads at runtime (without commands wired, the plugin is effectively no-op but the registration is testable).
3. **This ADR** — binding architecture commitments.

## What this commit does NOT land

- Typed `arduino_*` commands (deferred to UI-feature wave).
- Topology flip to `desktop-rust` (gated on acceptance ladder).
- JS adapter / frontend integration.
- Phase 9.2 acceptance ladder execution.

## Activation gate

When a UI feature requests Arduino compile/upload/serial, the implementing wave references this ADR + the Codex R1 review counters as binding inputs.

## References

- Codex R5 #3 R1 review: `COLLAB_TAURI_ARDUINO_COMMANDS_RESPONSE_R1.md`
- Original proposal: `COLLAB_TAURI_ARDUINO_COMMANDS_HANDOFF_R1.md`
- Hardware audit: `docs/audits/tauri-hardware-plugin-provenance.md`
- Tauri sidecar: https://v2.tauri.app/develop/sidecar/
- Arduino CLI 1.4 compile: https://arduino.github.io/arduino-cli/1.4/commands/arduino-cli_compile/
- Arduino CLI 1.4 upload: https://arduino.github.io/arduino-cli/1.4/commands/arduino-cli_upload/
- Arduino sketch spec: https://arduino.github.io/arduino-cli/1.4/sketch-specification/
- tauri-plugin-serialplugin: https://github.com/s00d/tauri-plugin-serialplugin

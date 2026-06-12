# ADR: Tauri Phase 2 — Native Authority Threat Model and Least-Privilege Boundary

- **Status:** Accepted
- **Date:** 2026-06-12
- **Deciders:** Claude (executing docs/plans/2026-05-10-tauri-v2-desktop-migration.md Phase 2), building on Codex R4/R5 adversarial-review outcomes

## Context

The desktop webview is the highest-risk trust boundary in ProtoPulse: any XSS
or compromised dependency in the React frontend inherits whatever native
authority the IPC surface grants. Tauri v2 allows **every** registered
`#[tauri::command]` by default unless restricted via
`tauri_build::AppManifest::commands(&[...])`
(https://v2.tauri.app/security/capabilities), and plugin permissions are
capability-file driven (https://v2.tauri.app/plugin/file-system).

Pre-Phase-2 state included `spawn_process(command, args)` — a generic process
primitive with no allowlist, timeout, cwd/env control, or output cap: full
remote code execution from the webview. Capabilities granted broad fs/dialog
authority and the CSP allowed dev-origin localhost.

Phase 2 implementation landed incrementally across the R4 retro and R5 waves
(commits `b32c7ef0`…`7d00d050`); this ADR records the resulting threat model
and closes the remaining plan deliverables: the Rust-side regression test
(`src-tauri/tests/command_manifest.rs`) and removal of the stale
`spawnProcess` bridge method plus mismatched raw `invoke()` names in
`client/src/lib/tauri-api.ts`.

### Threat model (assets / adversaries / entry points)

| Asset | Adversary path | Mitigation layer |
|---|---|---|
| Arbitrary native code execution | XSS → `invoke('spawn_process')` | Command removed; `AppManifest::commands` allowlist excludes any process primitive; regression test pins absence |
| Filesystem (secrets, SSH keys, WebView profile) | XSS → fs plugin commands | `fs:default` deny-by-default base + per-command scoped `allow` (Pattern A) + `fs:scope` deny family (`$APPLOCALDATA/EBWebView/**`, secret-name globs) |
| Custom Rust command surface | Renamed/added command drifting past review | build.rs allowlist ⟷ `collect_commands![]` exact-set parity test; tauri-specta generated bindings (pinned `=2.0.0-rc.25`) |
| Remote content injection | CSP relaxation | Production CSP anchored on `default-src 'self'`, no `http://localhost`, no `unsafe-eval`; `withGlobalTauri:false` |
| Path traversal / symlink escape in typed `read_file`/`write_file` | Crafted paths through dialogs | `src-tauri/src/path_validation.rs` (O_NOFOLLOW / reparse-point refusal) |

## Decision

1. **No generic process authority, ever.** `spawn_process` stays deleted from
   Rust registration, the build-manifest allowlist, the specta bindings, and
   the `DesktopAPI` bridge interface. Process-shaped needs ship only as typed,
   argument-validated commands (e.g. the `arduino_*` family per
   `docs/decisions/2026-05-12-adr-arduino-typed-commands.md`).
2. **Build-time command allowlist is the manifest of record.**
   `src-tauri/build.rs` declares `AppManifest::new().commands(&[...])`; it must
   stay in exact-set parity with `collect_commands![]` in `src-tauri/src/lib.rs`.
   Enforced by `src-tauri/tests/command_manifest.rs`.
3. **Capabilities follow the caller graph, Pattern A (per-command scopes).**
   Each `fs:allow-*` grant carries explicit base-dir-rooted paths; a global
   `fs:scope` deny family blocks WebView profile data and secret-name globs.
   No `shell:allow-execute`/`allow-spawn`; shell authority is `shell:allow-open` only.
4. **Frontend custom-command calls go through generated bindings only.**
   `client/src/lib/tauri-api.ts` uses `commands.*` from
   `client/src/lib/bindings.ts` (tauri-specta `=2.0.0-rc.25`); raw `invoke()`
   with hand-typed command names is forbidden for custom commands.

## Rationale

- Tauri's default-allow for registered commands means registration alone is an
  authority grant; the build-time allowlist converts that into explicit
  deny-by-default (source: https://v2.tauri.app/security/capabilities).
- Static contract tests (string/JSON parsing of build.rs, lib.rs,
  capabilities, tauri.conf.json) catch authority regressions in `cargo test`
  without booting a webview, complementing the TypeScript-side
  `ipc-contract-drift.test.ts`.
- Per-command scoped allows (Pattern A from the plan, verified against
  https://v2.tauri.app/plugin/file-system) keep each fs command's blast radius
  independently reviewable, unlike one global scope.

## Revisit when

- Phase 9 lands typed `arduino_*` / serial commands — extend the allowlist and
  the manifest test together, and re-review the serialplugin capability set.
- The `tauri-specta` pin moves off `2.0.0-rc.25` — re-verify bindings shape
  assumptions in the drift tests.
- Express sidecar topology changes (Phase 3+ follow-ups) — any sidecar
  reintroduces process authority and needs its own scoped shell permissions.
- A workflow genuinely needs fs access outside the current scope roots —
  expand via new scoped allow entries, never by broadening to `$HOME/**`.

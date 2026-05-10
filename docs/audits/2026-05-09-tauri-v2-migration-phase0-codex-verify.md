# Tauri v2 Migration Phase 0 - Codex Round 1 Verification

**Review date:** 2026-05-10
**Related handoff:** `CODEX_HANDOFF.md`
**Primary response:** `CODEX_RESPONSE_TAURI.md`
**Scope:** Verify Phase 0 drift claims and critique phase ordering. Planning/audit only. No `src-tauri/` code edits were made.

## Verification Summary

Phase 0 correctly identified the current scaffold as partial, but the two debt notes marked "TBD" can now be resolved:

| Phase 0 item | Codex verification | Evidence |
|---|---|---|
| CSP/global Tauri note is partially stale | Correct | `src-tauri/tauri.conf.json:11` has `withGlobalTauri:false`; `src-tauri/tauri.conf.json:22-24` has a CSP. Remaining issue: CSP still allows `style-src 'unsafe-inline'` and wildcard localhost connections. |
| Express uses global Node | Confirmed true | `src-tauri/src/lib.rs:230-237` calls `std::process::Command::new("node")`; `src-tauri/tauri.conf.json:26-40` has no `bundle.externalBin`. Official sidecar docs require configured `externalBin` and target-triple sidecar binaries: https://v2.tauri.app/develop/sidecar/ |
| `spawn_process` exposed without allowlist | Confirmed true | `src-tauri/src/lib.rs:189-204` accepts arbitrary command and args. Tauri capability files at `src-tauri/capabilities/default.json:20-31` scope plugin permissions, not this custom command. Tauri docs say app-registered commands are allowed by default unless restricted with an app manifest: https://v2.tauri.app/security/capabilities/ |
| Missing serial/HID/updater/window-state plugins | Confirmed | `src-tauri/Cargo.toml:7-18` only has Tauri, shell, dialog, fs, opener, serde, serde_json, and tokio. |
| Missing Vite `base: './'` | Confirmed | `vite.config.ts:8-102` has no `base` property. |
| Missing release profile | Confirmed | `src-tauri/Cargo.toml:1-18` has no `[profile.release]`. |
| Tauri CLI currentness | Minor drift | Local CLI reports `tauri-cli 2.10.1`; npm latest for `@tauri-apps/cli` was `2.11.1` during this review. |

## New Findings Added by Codex

| Finding | Severity | Evidence | Recommended plan response |
|---|---:|---|---|
| Frontend/Rust IPC names do not match | High | `client/src/lib/tauri-api.ts:123-146` invokes `read_file_contents`, `write_file_contents`, and `get_app_version`; Rust registers `read_file`, `write_file`, and `get_version` in `src-tauri/src/lib.rs:375-382`. | Add a Phase 0.5 IPC contract audit and tests before plugin migration. |
| `spawn_process` bypasses plugin permission design | High | The command is custom Rust code, not shell plugin API. Tauri capabilities docs explicitly warn that Rust code and incorrect scope checks are outside the protection model. | Replace with typed allowlisted operations. Do not expose arbitrary command execution to frontend JS. |
| Capability file grants broad shell and FS plugin permissions | Medium-high | `src-tauri/capabilities/default.json:20-31`. | Inventory actual frontend usage, then remove unused permissions and use path/command scopes. |
| Production devtools path is not gated | Medium | `src-tauri/Cargo.toml:8` enables `tauri` feature `devtools`; menu exposes toggle at `src-tauri/src/lib.rs:297-300` and `354-360`. | Decide release behavior before signing/updater. |
| Storage migration is under-scoped | High | `rg -l "localStorage|sessionStorage" client/src | wc -l` returned `271`. | Split storage into project data, secrets, preferences, cache/history, and test-only buckets. |
| Desktop bridge may not be integrated broadly | Medium | Search found `client/src/lib/tauri-api.ts` as the main bridge surface, with no obvious app-wide consumers in the first pass. | Prove actual desktop execution path before adding plugins. |

## Phase Ordering Critique

The Phase 0 ordering is workable as a rough backlog, but it should not become the implementation plan unchanged.

1. **Add Phase 0.5 before Phase 1.** Run a baseline Tauri smoke, create an IPC command contract, inventory plugin permissions, and verify CLI/plugin versions. The current bridge mismatch is proof this is needed.
2. **Move generic process authority removal into the first real phase.** Capability hardening without custom command restriction leaves the biggest attack path open.
3. **Do not assume Node sidecar is the chosen backend.** First decide whether Express is temporary, permanent, or being reduced to non-privileged API compatibility.
4. **Move storage earlier.** The localStorage/sessionStorage footprint is too large and security-sensitive to defer until after updater/signing.
5. **Move lifecycle decisions earlier.** Deep links, file associations, single-instance behavior, window state, tray, global shortcuts, and autostart shape app launch/import behavior.
6. **Move updater after CI/signing design.** Tauri updater configuration depends on artifacts, pubkey, endpoints, and release-channel policy: https://v2.tauri.app/plugin/updater/

## Recommended Round 2 Focus

Round 2 should produce a decision record and revised phase plan around:

- Express sidecar vs Rust-native vs hybrid runtime topology.
- Command threat model and custom-command authorization.
- IPC command-name/payload contract.
- Storage migration matrix from the 271 storage-touching files.
- Plugin provenance and platform support matrix.
- Packaged smoke-test strategy, including no-global-Node verification.
- Context7 retry for Tauri v2 documentation once MCP cancellation is resolved.

## Source Notes

- Official Tauri CSP docs: https://v2.tauri.app/security/csp/
- Official Tauri capabilities docs: https://v2.tauri.app/security/capabilities/
- Official Tauri permissions docs: https://v2.tauri.app/security/permissions/
- Official Tauri sidecar docs: https://v2.tauri.app/develop/sidecar/
- Official Tauri shell plugin docs: https://v2.tauri.app/plugin/shell/
- Official Tauri updater docs: https://v2.tauri.app/plugin/updater/
- Official Tauri Store plugin docs: https://v2.tauri.app/plugin/store/
- Official Tauri Window State plugin docs: https://v2.tauri.app/plugin/window-state/
- Official Tauri Deep Linking plugin docs: https://v2.tauri.app/plugin/deep-linking/
- Official Tauri Single Instance plugin docs: https://v2.tauri.app/plugin/single-instance/
- Official Tauri Autostart plugin docs: https://v2.tauri.app/plugin/autostart/
- Official Tauri GitHub pipeline docs: https://v2.tauri.app/distribute/pipelines/github/
- Official Tauri Windows signing docs: https://v2.tauri.app/distribute/sign/windows/
- Official Tauri macOS signing docs: https://v2.tauri.app/distribute/sign/macos/

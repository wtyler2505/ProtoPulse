# Tauri IPC Contract Table

## Supersession

**Note (2026-05-10, Round 4 supersession):** This ADR documents the manual command-rename path proposed in Round 3. **The plan-doc** (`docs/plans/2026-05-10-tauri-v2-desktop-migration.md` Phase 1.3) **supersedes the manual fix with `tauri-specta` auto-generated bindings.** This ADR remains valuable as the contract baseline + drift-test design + Rust-only-command audit, but agents must adopt the `tauri-specta` path - DO NOT manually rename commands.

**Status:** Proposed contract baseline  
**Date:** 2026-05-10  
**Scope:** `client/src/lib/tauri-api.ts` paired against `src-tauri/src/lib.rs` without editing `src-tauri/`.

## Current Contract

The bridge is currently latent: `client/src/lib/tauri-api.ts` defines `getDesktopAPI()`, but the only live `client/src` references to `getDesktopAPI`, `isTauri`, or `tauri-api` are inside that same file. This table still treats the file as the intended contract because Phase 1 must wire UI callers through it.

| command_name | frontend_caller_file:line | rust_handler_file:line | payload_schema (TS) | rust_arg_schema (Rust) | authority (capability/scope) | timeout | error_model | owning_test |
|---|---|---|---|---|---|---|---|---|
| `openExternal` (plugin-opener, not custom invoke) | `client/src/lib/tauri-api.ts:85` | No matching custom command. Rust uses opener only for Help -> Learn More at `src-tauri/src/lib.rs:350`. | `(url: string) => Promise<void>` | N/A | `opener:default` in `src-tauri/capabilities/default.json:32` | None specified | Plugin rejection bubbles to caller. | Proposed fix: keep plugin path and document allowed URL policy. Test: `tauri-api.contract.test.ts` stubs `openUrl` and asserts bridge behavior. |
| `showSaveDialog` (plugin-dialog path; unused Rust duplicate exists) | `client/src/lib/tauri-api.ts:90` | `show_save_dialog` at `src-tauri/src/lib.rs:38`; registered at `src-tauri/src/lib.rs:376`; not called by frontend. | `{ title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> } -> { canceled: boolean; filePath?: string }` | `title: Option<String>, default_path: Option<String>, filters: Option<Vec<DialogFilter>>` plus `AppHandle` | `dialog:default`, `dialog:allow-save` in `src-tauri/capabilities/default.json:22-24` | None specified | Plugin cancellation returns `canceled: true`; Rust duplicate maps channel errors to string. | Proposed fix: choose plugin JS path and remove/custom-gate unused Rust handler later, or switch frontend to invoke. Test asserts no dead custom dialog command is required by the bridge. |
| `showOpenDialog` (plugin-dialog path; unused Rust duplicate exists) | `client/src/lib/tauri-api.ts:102` | `show_open_dialog` at `src-tauri/src/lib.rs:81`; registered at `src-tauri/src/lib.rs:377`; not called by frontend. | `{ title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }>; properties?: Array<'openFile' \| 'openDirectory' \| 'multiSelections'> } -> { canceled: boolean; filePaths: string[] }` | `title: Option<String>, default_path: Option<String>, filters: Option<Vec<DialogFilter>>, properties: Option<Vec<String>>` plus `AppHandle` | `dialog:default`, `dialog:allow-open` in `src-tauri/capabilities/default.json:22-23` | None specified | Plugin cancellation returns empty paths; Rust duplicate maps channel errors to string. | Proposed fix: choose plugin JS path and remove/custom-gate unused Rust handler later, or switch frontend to invoke. Test asserts directory/multiple options map correctly. |
| `read_file_contents` (**MISMATCH**) | `client/src/lib/tauri-api.ts:125` | Intended handler appears to be `read_file` at `src-tauri/src/lib.rs:175`; registered at `src-tauri/src/lib.rs:378`. | `invoke<string>('read_file_contents', { path: filePath })` | `async fn read_file(file_path: String) -> Result<String, String>` | Duplicates broad `fs:allow-read-file` in `src-tauri/capabilities/default.json:27-29`; custom command is allowed by default unless constrained via app manifest. | None specified | Rust maps read error to string, but current frontend command name and key shape will fail before handler runs. | Proposed fix: rename frontend invoke to `read_file` and send `{ file_path: filePath }`, or rename Rust command and add `#[serde(rename = "path")]`; prefer Rust command `read_project_file` with scoped path. Test fails until frontend invoke name and payload match registered handler. |
| `write_file_contents` (**MISMATCH**) | `client/src/lib/tauri-api.ts:129` | Intended handler appears to be `write_file` at `src-tauri/src/lib.rs:182`; registered at `src-tauri/src/lib.rs:379`. | `invoke<void>('write_file_contents', { path: filePath, data })` | `async fn write_file(file_path: String, data: String) -> Result<(), String>` | Duplicates broad `fs:allow-write-file` in `src-tauri/capabilities/default.json:27-31`; custom command is allowed by default unless constrained via app manifest. | None specified | Rust maps write error to string, but current frontend command name and `path` key mismatch will fail before handler runs. | Proposed fix: rename frontend invoke to `write_file` and send `{ file_path: filePath, data }`, or replace with typed `write_project_file`. Test fails until name and payload match. |
| `spawn_process` (**MATCHES NAME, UNSAFE AUTHORITY**) | `client/src/lib/tauri-api.ts:137` | `spawn_process` at `src-tauri/src/lib.rs:189`; registered at `src-tauri/src/lib.rs:380`. | `invoke<{ stdout: string; stderr: string; exitCode: number \| null }>('spawn_process', { command, args })` | `async fn spawn_process(command: String, args: Vec<String>) -> Result<SpawnResult, String>` | Generic native process authority. No custom command restriction in `src-tauri/build.rs`; shell plugin permissions are broad but do not constrain this app command. | None specified; stdout/stderr captured unbounded. | `Failed to spawn` string on spawn failure; exit codes returned without policy; no timeout/cancel/output cap. | Proposed fix: do not carry this forward. Replace with typed commands or allowlisted sidecar operations, then exclude `spawn_process` via `AppManifest::commands`. Test asserts generic command is absent from production allowlist. |
| `get_app_version` (**MISMATCH**) | `client/src/lib/tauri-api.ts:145` | Intended handler is `get_version` at `src-tauri/src/lib.rs:206`; registered at `src-tauri/src/lib.rs:381`. | `invoke<string>('get_app_version')` | `fn get_version(app: tauri::AppHandle) -> String` | Low-risk app metadata. Custom command is currently globally callable. | None specified | Current command name fails before handler runs. | Proposed fix: rename frontend invoke to `get_version` or Rust command to `get_app_version`; prefer `get_version` to match registered handler. Test asserts bridge version invoke is registered. |
| `get_platform` | `client/src/lib/tauri-api.ts:149` and initial cache at `client/src/lib/tauri-api.ts:214` | `get_platform` at `src-tauri/src/lib.rs:211`; registered at `src-tauri/src/lib.rs:382`. | `invoke<string>('get_platform')` | `fn get_platform() -> String` | Low-risk app metadata. Custom command is currently globally callable. | None specified | Invoke rejection bubbles to caller; initial cache promise is fire-and-forget. | Proposed fix: keep, but include in `AppManifest::commands` allowlist. Test asserts both the direct method and platform cache command are registered. |
| `onMenuAction` (event listener, not invoke) | `client/src/lib/tauri-api.ts:153` | Emits `menu:new-project`, `menu:open-project`, `menu:save` at `src-tauri/src/lib.rs:328-338`. | `(callback: (action: string) => void) => () => void`, channels `menu:new-project \| menu:open-project \| menu:save` | Event payload `()` emitted from Rust menu handler. | Event surface, main window menu authority. | Listener setup promise has no timeout. | Listener registration rejection is not surfaced to caller; unsubscribe handles late registrations. | Proposed fix: keep event names, add listener setup error logging or return async setup in a future breaking contract. Test asserts `MENU_CHANNELS` equals Rust emitted menu events. |
| `show_save_dialog` (**RUST-ONLY CUSTOM COMMAND**) | No frontend invoke in `client/src/lib/tauri-api.ts`; frontend uses plugin dialog. | `src-tauri/src/lib.rs:38`; registered at `src-tauri/src/lib.rs:376`. | N/A | See row above. | Dialog custom authority, redundant with plugin path. | None specified. | Channel error as string. | Proposed fix: delete or gate after choosing plugin-vs-custom dialog path. Test flags registered custom commands with zero frontend callers. |
| `show_open_dialog` (**RUST-ONLY CUSTOM COMMAND**) | No frontend invoke in `client/src/lib/tauri-api.ts`; frontend uses plugin dialog. | `src-tauri/src/lib.rs:81`; registered at `src-tauri/src/lib.rs:377`. | N/A | See row above. | Dialog custom authority, redundant with plugin path. | None specified. | Channel error as string. | Proposed fix: delete or gate after choosing plugin-vs-custom dialog path. Test flags registered custom commands with zero frontend callers. |

## Automated Drift Test Specification

Add a Vitest contract test before any `src-tauri/` edits:

1. Read `client/src/lib/tauri-api.ts`, `src-tauri/src/lib.rs`, and `src-tauri/build.rs`.
2. Extract frontend command names with a conservative regex for `invoke<...>('command_name'` and `invoke('command_name'`.
3. Extract Rust command function names from `#[tauri::command]` followed by `fn` or `async fn`.
4. Extract registered names from `tauri::generate_handler![...]`.
5. Fail if any frontend invoke is absent from both the Rust command function set and the `generate_handler!` registration set.
6. Fail if any Rust command is registered but neither invoked nor deliberately listed in an `allowed_rust_only_commands` fixture.
7. Fail if `spawn_process` is present in the production allowlist fixture; typed sidecar/process commands must replace it.
8. Check payload parity for known commands using a fixture table:
   - `read_file`: TS keys must include `file_path`; Rust args include `file_path`.
   - `write_file`: TS keys must include `file_path` and `data`; Rust args include `file_path` and `data`.
   - zero-arg commands must not pass a payload.
9. Once `src-tauri/build.rs` adopts `tauri_build::AppManifest::new().commands(&[...])`, fail if registered commands and app-manifest commands drift.

Suggested file:

```text
client/src/lib/__tests__/tauri-ipc-contract.test.ts
```

Suggested command:

```bash
npx vitest run client/src/lib/__tests__/tauri-ipc-contract.test.ts
```

The first expected failure should be the current mismatch: `read_file_contents`, `write_file_contents`, and `get_app_version` are invoked by TypeScript but not registered by Rust.

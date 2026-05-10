# Tauri v2 Migration — Claude Context7 Research Feed (for Codex Round 4)

**Date:** 2026-05-10
**Purpose:** Codex's Context7 MCP is broken (server-side, not auth-fixable). Claude's Context7 still works. This document feeds Codex the Tauri v2 upstream-doc evidence Codex couldn't fetch in Rounds 1-3, so Round 4 can integrate it into the plan-doc.

## Critical Finding: tauri-specta Auto-Solves IPC Drift

The Round 3 IPC contract problem (frontend invokes `read_file_contents`, Rust registers `read_file`) is a class of bug that **`tauri-specta` eliminates structurally**. It auto-generates TypeScript bindings from Rust commands at build time so the contract CANNOT drift.

**Library IDs (Context7-verified):**
- `/websites/rs_tauri-specta_2_0_0-rc_21` — official site (2.0.0-rc.21, 243 snippets)
- `/specta-rs/tauri-specta` — official repo (23 snippets)
- `/specta-rs/specta` — base library (115 snippets, score 88.6)

**How it works (verified pattern from Context7):**

```rust
// src-tauri/src/lib.rs
use serde::{Deserialize, Serialize};
use specta::Type;
use specta_typescript::Typescript;
use tauri_specta::{collect_commands, collect_events, Builder, Event};

#[tauri::command]
#[specta::specta]  // <-- this is the only addition
async fn read_file(file_path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&file_path).await.map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize, Type)]  // Type is the specta derive
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

pub fn run() {
    let builder = Builder::<tauri::Wry>::new()
        .commands(collect_commands![read_file, write_file, get_version, /* ... */])
        .events(collect_events![/* events */])
        .typ::<DialogFilter>();

    // Export TypeScript bindings ONLY in debug builds (so prod doesn't ship dev artifacts)
    #[cfg(debug_assertions)]
    builder
        .export(
            Typescript::default()
                .formatter(specta_typescript::formatter::prettier)
                .header("/* eslint-disable */"),
            "../client/src/lib/bindings.ts",
        )
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .invoke_handler(builder.invoke_handler())  // <-- replaces tauri::generate_handler!
        .setup(move |app| {
            builder.mount_events(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Frontend usage replaces all raw `invoke()` calls:**

```typescript
// src/lib/tauri-api.ts (refactored to use generated bindings)
import { commands } from './bindings';  // auto-generated, never edit

// BEFORE (current broken pattern):
// invoke<string>('read_file_contents', { path: filePath })  // names + payload drift
// AFTER:
const content = await commands.readFile(filePath);  // typed, can't drift

// Result<T, E> becomes discriminated union:
const result = await commands.fetchUser(id);
if (result.status === "ok") {
  console.log(result.data);  // typed as User
} else {
  console.error(result.error);  // typed as UserError
}
```

**Why this changes Round 3's plan:**
- Phase 1 IPC Contract Table → still produce the table for the documentation/decision layer, but Phase 1 implementation is "adopt tauri-specta + regenerate bindings" not "rename commands manually."
- The drift-test in Round 3's IPC contract spec is no longer a separate test — `cargo build` is the test. If a Rust command isn't registered or types don't match, TypeScript fails to compile.
- The 3 mismatched commands (`read_file_contents`/`write_file_contents`/`get_app_version`) get FIXED by adopting specta — the generated bindings will have the correct names matching Rust handlers, and the broken frontend file gets regenerated.

**Sources:**
- https://github.com/specta-rs/tauri-specta
- https://github.com/specta-rs/specta

---

## tauri-plugin-fs Scoping Patterns (concrete for Phase 2 capability hardening)

Verified via Context7. These are the production-ready patterns — replace the current loose `fs:allow-read-file` etc. in `src-tauri/capabilities/default.json`.

### Pattern A — Per-command path scope (most flexible)

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "fs:allow-read-file",
      "allow": [{ "path": "$APPDATA/protopulse/projects/**/*" }]
    },
    {
      "identifier": "fs:allow-write-file",
      "allow": [{ "path": "$APPDATA/protopulse/projects/**/*" }],
      "deny": [{ "path": "$APPDATA/protopulse/projects/**/.*" }]
    },
    {
      "identifier": "fs:allow-mkdir",
      "allow": [{ "path": "$APPDATA/protopulse/**" }]
    }
  ]
}
```

### Pattern B — Global `fs:scope` for all FS commands

```json
{
  "permissions": [
    "fs:default",
    {
      "identifier": "fs:scope",
      "allow": [
        "$APPDATA/protopulse/**",
        "$HOME/Documents/ProtoPulse/**",
        "$RESOURCE/**/*"
      ],
      "deny": [
        "$APPLOCALDATA/EBWebView",
        "$APPDATA/protopulse/**/secrets.json"
      ]
    }
  ]
}
```

### Important: `$APPLOCALDATA/EBWebView` MUST be denied on Windows

WebView2 stores user-data and tokens there. Allowing FS access reads cookies/credentials. Per Tauri docs (https://v2.tauri.app/security/scope), this is the canonical example of a sensitive subfolder to deny while allowing the parent.

### Path variable reference

- `$APPDATA` — per-user app data (cross-platform abstraction)
- `$APPLOCALDATA` — per-user local app data (Windows: `%LOCALAPPDATA%/<identifier>/`, includes WebView2)
- `$HOME` — user home dir
- `$RESOURCE` — app resource dir (where bundled assets live)
- `$DOCUMENT` — user Documents folder
- Glob: `*` matches one segment, `**` matches recursive, `**/*` everything below

**Sources:**
- https://v2.tauri.app/plugin/file-system
- https://v2.tauri.app/security/scope
- https://v2.tauri.app/develop/resources

---

## tauri-plugin-log Setup (Phase 10 Observability)

```bash
npm run tauri add log
```

```rust
// src-tauri/src/lib.rs
use tauri_plugin_log::{Target, TargetKind};

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(Target::new(TargetKind::Stdout))
                .target(Target::new(TargetKind::LogDir { file_name: Some("protopulse.log".into()) }))
                .target(Target::new(TargetKind::Webview))  // forwards Rust logs to JS console
                .level(log::LevelFilter::Info)
                .build()
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```typescript
// Frontend: attach Rust logs to webview console
import { attachConsole } from '@tauri-apps/plugin-log';
const detach = await attachConsole();  // call detach() to stop forwarding
```

**Source:** https://v2.tauri.app/plugin/logging

---

## tauri-plugin-process Setup (required for updater Phase 8)

```bash
npm run tauri add process
```

```rust
// src-tauri/src/lib.rs
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())  // adds process::relaunch + process::exit
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```typescript
import { relaunch, exit } from '@tauri-apps/plugin-process';

// After updater installs new version:
await relaunch();

// Clean app exit:
await exit(0);
```

**Source:** https://v2.tauri.app/plugin/process

---

## Updater + Process + Setup Composition (Phase 8 reference)

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build());
                app.manage(app_updates::PendingUpdate(Mutex::new(None)));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            #[cfg(desktop)] app_updates::fetch_update,
            #[cfg(desktop)] app_updates::install_update,
        ])
        .run(tauri::generate_context!())
}
```

**Source:** https://v2.tauri.app/plugin/updater

---

## Round 4 Integration Asks

When Codex Round 4 incorporates this feed into the plan-doc:

1. **Add tauri-specta to Tech Stack section** + amend Phase 1 IPC Contract from "manually align command names" to "adopt tauri-specta, regenerate `bindings.ts`, refactor `tauri-api.ts` to use `commands.X()` instead of `invoke('X', ...)`."
2. **Replace Phase 2's loose capability examples** with the verified Pattern A/B `fs:scope` glob patterns above. Include the `$APPLOCALDATA/EBWebView` deny rule as a hard requirement.
3. **Add tauri-plugin-log + tauri-plugin-process to Tech Stack** with the verified setup snippets above.
4. **Update Phase 8 Updater task** to reference the verified updater+process composition pattern.
5. **In the Existing Infrastructure Summary table**, mark `tauri-specta` and `tauri-plugin-log`/`process`/`updater` as "Required (not yet installed)" and remove any "TBD upstream API" entries — the API is verified above.

## Source URL Index

- tauri-specta repo: https://github.com/specta-rs/tauri-specta
- specta base: https://github.com/specta-rs/specta
- Tauri v2 fs plugin: https://v2.tauri.app/plugin/file-system
- Tauri v2 scope: https://v2.tauri.app/security/scope
- Tauri v2 resources: https://v2.tauri.app/develop/resources
- Tauri v2 log: https://v2.tauri.app/plugin/logging
- Tauri v2 process: https://v2.tauri.app/plugin/process
- Tauri v2 updater: https://v2.tauri.app/plugin/updater

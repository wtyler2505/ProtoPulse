# Tauri v2 Migration — Phase 1 Storage Classification + Runtime Audit (Claude side)

**Date:** 2026-05-09 (concurrent with Codex Round 2)
**Scope:** Classify the 269 client-side `localStorage` touchpoints into migration buckets. Audit current Express+Tauri runtime topology (does the production shell actually start?). Reconcile pp-core source `62a2e851` (which predates the desktop pivot) with the new native-FS direction.

## Storage classification — actual key inventory

`rg -l "localStorage" client/src` returned **269 files** (matches Codex's "271" within rounding for sessionStorage overlap). Top observed key namespaces from `rg "localStorage" client/src | grep -oE "[\"'][a-zA-Z0-9_-]+[\"']"`:

### Bucket 1 — Session / auth (NEVER persist plaintext on desktop)
- `protopulse-session-id` (19 hits)
- `X-Session-Id` (2 hits)

**Migration target:** OS keychain via `tauri-plugin-stronghold` (https://v2.tauri.app/plugin/stronghold/) OR encrypted Tauri Store with OS-bound key derivation. **Must NOT regress audit #60** (which already moved API keys away from localStorage to AES-256-GCM server-encrypted storage). Per pp-core source `62a2e851`, "do not push API keys into app-data JSON."

### Bucket 2 — Project / workspace data (native FS source-of-truth)
- `protopulse-board-settings` (9 hits)
- `protopulse-circuit-selection` (5 hits)
- `protopulse-sim-scenarios` (5 hits)
- `protopulse-sim-compare-snapshots` (2 hits)
- Project-scoped via helpers: `getProjectScopedStorageKey()`, `getHiddenProjectStorageKey()`, `getLastProjectStorageKey()` — encodes per-project namespacing

**Migration target:** native FS as `.protopulse` project files (or `.pp` directory bundle). One file per project, JSON or SQLite. Tauri-plugin-fs scoped to `$APPDATA/protopulse/projects/{projectId}/`. Migration tooling reads existing localStorage on first launch and writes equivalent files.

### Bucket 3 — User preferences (Store plugin)
- `protopulse-beginner-mode` (4 hits)
- `protopulse-gpu-blur-override` (19 hits)
- `protopulse-ai-safety-mode` (3 hits)
- `COMPACT_MODE_STORAGE_KEY` (named constant)
- `PANEL_LAYOUT_KEY` (project-scoped via helper)

**Migration target:** `tauri-plugin-store` (https://v2.tauri.app/plugin/store/) — single `preferences.json` keyed by Store path. Install: `npm run tauri add store`. Rust: `tauri_plugin_store::Builder::new().build()`.

### Bucket 4 — History / cache (Store plugin with bounded retention)
- `protopulse-memory-history` (3 hits)
- `protopulse-import-history` (6 hits)
- `HISTORY_KEY` / `historyKey(projectId)` constants

**Migration target:** `tauri-plugin-store` with explicit max-entry caps. Optionally migrate to local SQLite via `tauri-plugin-sql` if size grows. Cache-class data — clearable, versioned, never load-bearing for correctness.

### Bucket 5 — Catalog / marketplace (server source-of-truth + local cache)
- `protopulse-marketplace` (3 hits)
- `protopulse-rag-documents` (4 hits)
- `protopulse-creator-profiles` (5 hits)
- `protopulse-custom-boards` (3 hits)
- `INSTALLED_KEY` constant

**Migration target:** keep server as source-of-truth (this is shared across users) — local FS or Store as offline cache layer with TTL + ETag/version checks. This is where pp-core source `62a2e851`'s "server with offline cache" recommendation actually applies — but only for genuinely shared content, NOT for project data.

### Bucket 6 — Hardware presets (Store plugin)
- `protopulse-serial-last-preset` (2 hits)
- `protopulse-safe-commands` (2 hits)

**Migration target:** `tauri-plugin-store` — small, static, machine-local.

### Bucket 7 — One-time UX state (Store plugin)
- `DISMISSED_KEY` constant
- `protopulse-ai-safety-dismissed` (3 hits)
- `protopulse-dismissed-reminders` (4 hits)
- `protopulse-milestone-unlocks` (3 hits)
- `LAST_SEEN_KEY` constant

**Migration target:** `tauri-plugin-store` — boolean flags + timestamps, machine-local.

### Bucket 8 — Migration markers (delete after migration)
- `MIGRATION_KEY` constant
- `LEGACY_STORAGE_KEY` constant
- `LEGACY_LAST_PROJECT_KEY` constant
- `legacyKey` references

**Migration target:** these are themselves migration scaffolding from prior audits. Desktop migration script reads them, completes any pending in-flight web-era migrations, then deletes the legacy keys + clears the markers.

### Reconciliation with pp-core source `62a2e851`

The 2026-03-13 source recommends "systematic migration to project-scoped server storage with localStorage as an offline cache layer." This conflicts with the Tauri pivot direction (native FS as primary, server optional/eliminated for project data). Reconciliation:

- For **project data** (Bucket 2): native FS is the new source-of-truth, NOT server. The 2026-03-13 advice is superseded by the desktop pivot ADR.
- For **shared / catalog content** (Bucket 5): server-with-cache pattern still applies.
- For **session/auth** (Bucket 1): must improve on prior audit #60 (server-side encrypted) by moving to OS keychain. Don't regress.

This reconciliation needs to be added back to pp-core as a Round 2/3 source so the notebook's own knowledge stays consistent.

## Runtime topology audit — production shell is broken NOW

### Finding: `dist/index.cjs` doesn't exist

`src-tauri/src/lib.rs:228` resolves the Express server entry as:
```rust
let server_entry = resource_dir.join("dist").join("index.cjs");
```

Then at line 231 spawns:
```rust
std::process::Command::new("node").arg(&server_entry)
```

But `ls /home/wtyler/Projects/ProtoPulse/dist/` returns only `public/`. **There is no `dist/index.cjs`.** The Tauri shell's production code path would crash on `Command::spawn().expect("Failed to start Express server")` at `lib.rs:237`.

Combined with the existing debt:
- No bundled Node sidecar → calls global `node`
- No bundled Express → calls a path that doesn't exist
- IPC contract mismatch → frontend invokes commands Rust doesn't register
- 0 bridge callers → React app doesn't even use the bridge

**The current scaffold cannot ship as-is.** It's not "almost there" — it's an unwired skeleton with broken assumptions at every boundary.

### Implication for the runtime topology decision

Codex Round 1 framed the keystone question as Path A (Express sidecar) / Path B (Native Rust backend) / Path C (Hybrid). My added evidence:

- `server/index.ts` is a heavyweight Express stack (helmet, compression, rate-limit, full middleware, collaboration WebSocket, audit log, Genkit init). Bundling this as a sidecar means bundling Helmet + Compression + all middleware + a node runtime. Realistically a ~50-100 MB sidecar, plus deep dependencies on `dotenv/config`, `crypto`, etc.
- `src-tauri/src/main.rs` is minimal — just `protopulse::run()` with `windows_subsystem = "windows"`.
- No actual Rust business logic exists yet beyond dialog/fs/spawn wrappers.

**My recommendation for the topology decision** (to be debated in Round 3):
- **Path A (Express sidecar)** is fastest path to "it boots" but locks in a 50-100 MB binary baseline + Node runtime requirement.
- **Path B (Native Rust backend)** is the long-term right shape but requires migrating ~20+ Express route modules to Rust commands. 6+ months of work.
- **Path C (Hybrid: Express dev/server, Rust shell + native commands for desktop-only paths)** is practical: keep Express for the cloud/web mode unchanged, write Rust commands for file/process/serial/HID, route through `getDesktopAPI()` only when `isTauri`.

Path C aligns with the "browser app + desktop wrapper" reality. Round 3 should propose Path C as default with explicit migration triggers for moving each Express route to native if needed.

## Cross-finding: source map policy

`vite.config.ts:76`: `sourcemap: 'hidden'`. Per Vite docs (`https://vitejs.dev/config/build-options.html#build-sourcemap`), `'hidden'` means source maps are generated but NOT referenced from the bundle (no `//# sourceMappingURL=` comment). Good for production debugging via separate map upload but bad if maps end up shipped in the Tauri bundle (visible in resource_dir → trivial reverse engineering).

**Round 3 must decide:** ship maps to Tauri bundle (debugging convenience, leaks source) OR upload to Sentry-style map service + exclude from bundle.

## Inputs ready for Round 3

When Codex Round 2 completes, Round 3 directive should incorporate:
1. **Storage classification table** above as the canonical Phase 3 (Storage Architecture) input.
2. **`dist/index.cjs` missing** as a P0 prerequisite — even before runtime topology decision, the Express bundle must exist.
3. **Path C recommendation** as starting position for the runtime topology debate.
4. **`62a2e851` reconciliation note** — needs to be added back to pp-core as a source so notebook knowledge stays consistent with the desktop pivot.
5. **Source map policy** as a Phase 6 (CI / packaging) deliverable.

## Source URLs

- Tauri Stronghold: https://v2.tauri.app/plugin/stronghold/
- Tauri Store: https://v2.tauri.app/plugin/store/
- Tauri SQL: https://v2.tauri.app/plugin/sql/
- Tauri FS scope patterns: https://v2.tauri.app/plugin/file-system/
- Vite sourcemap reference: https://vitejs.dev/config/build-options.html#build-sourcemap

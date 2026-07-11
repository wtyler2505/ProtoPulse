# Round 4 Self-Critique: Tauri v2 Migration Plan

**Date:** 2026-05-10
**Scope:** adversarial review of `docs/plans/2026-05-10-tauri-v2-desktop-migration.md` after integrating Claude's Context7 research feed.
**Review stance:** assume the plan will be handed to multiple agents and look for places it will break, overrun, or create merge collisions.

## Verified Inputs

- Required local feed read: `docs/audits/2026-05-10-tauri-v2-claude-context7-research-feed.md`.
- Current plan/ADRs read: runtime topology ADR, IPC contract table, release trust model ADR, and the Round 4 plan-doc.
- Canonical web checks performed without Context7:
  - `tauri-specta`/Specta upstream: Tauri Specta v2 is the Tauri v2 lane; cargo registry currently reports `tauri-specta = 2.0.0-rc.25`, `specta = 2.0.0-rc.25`, `specta-typescript = 0.0.12`.
  - Tauri filesystem scope docs verify `deny` precedence and the Windows `$APPLOCALDATA/EBWebView/**` sensitive WebView-data deny example.
  - Tauri process docs verify `@tauri-apps/plugin-process` exposes `exit` and `relaunch` and needs `process:default` capability.
  - Tauri updater docs verify the updater+process setup composition with `tauri_plugin_process::init()`, updater plugin setup, managed pending update state, and typed fetch/install commands.
  - Tauri logging docs verify `Stdout`, `LogDir { file_name }`, and `Webview` targets plus frontend `attachConsole()`.
- Registry version checks hit read-only home cache failures for default npm/cargo caches, then npm succeeded with `npm_config_cache=/tmp/npm-cache-codex`. Cargo search succeeded; cargo info confirmed downloads but could not write to the default cargo cache. That is an environment risk, not a plan-doc detail.

## Where The Plan Over-Promises

**Phase 1.3 makes `tauri-specta` sound structurally clean, but adoption is a real Rust refactor.** Every exported Rust command and custom type needs `#[specta::specta]` / `specta::Type` coverage, the builder replaces `tauri::generate_handler!`, and event mounting has to keep the existing menu/event surface intact. This is still better than a handwritten parser, but it is not a drop-in package install.

**Phase 3's 8-bucket storage migration is larger than one normal phase.** It combines classification, migration planning, rollback markers, secret handling, project file/folder decisions, and localStorage cleanup. That could easily split into "dry-run classifier" and "mutating migration" phases.

**Phase 5 CI plus packaged smoke is a cross-platform program, not a single feature.** Windows, macOS x64, macOS arm64, Linux deb, and AppImage each have their own native dependency and packaging failures. A local script can lint the workflow, but only remote CI proves the matrix.

**Phase 7 and Phase 8 are intentionally trust-gated, but the task shape can lure an agent into wiring secrets too early.** The plan says Tyler owns signing and updater key custody; every prompt for those phases should restate "placeholders only" unless Tyler has explicitly provided the signing environment.

**Phase 9 hardware authority is underspecified for physical validation.** It says serial/HID/Arduino plugin provenance and sidecar packaging, but it does not yet define the minimum no-device, mock-device, and real-device acceptance ladder.

**Phase 10 local diagnostics can drift into telemetry.** The current plan now says local logdir/stdout/webview first, which is right. The risk is that a future agent sees Sentry/Bugsnag in research topics and jumps to upload paths before consent/redaction is ratified.

## Where The Plan Still Assumes

**The `tauri-specta` RC API shape still needs compile proof.** The feed and upstream repo support the approach, and registry versions are current, but the exact `Builder`, `collect_commands`, `Typescript`, formatter, and generated `commands.*` names must be proven against `2.0.0-rc.25` in this repo. Do not claim final API correctness until Phase 1.3 compiles.

**`cargo build` alone is not the whole IPC drift test.** Rust build/export can prove command collection and write bindings, but frontend drift is caught by TypeScript import/use of generated `commands`. The real guard should be binding freshness plus `npm run check`, not just a Rust compile.

**Production build expectations are still ambiguous.** Task 1.1 keeps both options open: produce `dist/index.cjs`, or stop the desktop runtime from requiring it. That is correct, but it means Phase 1 can branch. The first implementation prompt should force the agent to record which path it chose.

**The plan assumes cache/toolchain writes will work.** They did not work with default npm/cargo home cache paths in this sandbox. A real Phase 1 run needs an environment validation step or exported cache dirs before dependency installation.

**The plan assumes generated bindings are safe to commit.** That is probably right for a typed client surface, but it should be explicit: generated `client/src/lib/bindings.ts` is committed for review and checked for freshness, while no dev-only generation artifacts are shipped in production bundles.

**The current ADRs still list manual IPC fixes.** The plan-doc now supersedes that with `tauri-specta`, but `docs/decisions/2026-05-10-tauri-ipc-contract.md` still says "rename frontend invoke" as the proposed fix. That is acceptable if treated as historical baseline, but Round 5 should either add a short supersession note or keep agents pointed at the plan-doc.

## TDD Feedback Loop Reality

| Task class | Expected feedback loop | Risk |
|---|---:|---|
| Pure TypeScript unit tests (`npx vitest run ...`) | 3-20 seconds warm, 20-60 seconds cold | Good TDD loop. Use heavily for adapter and policy modules. |
| `npm run check` TypeScript compile | 20-90 seconds depending cache and memory | Good contract gate, but not instant. Run after small IPC batches. |
| `npm run build` plus artifact assertion | 45-180 seconds local | Too slow for every micro-edit; use after build-script changes. |
| `cargo check/build --manifest-path src-tauri/Cargo.toml` | 15-60 seconds warm, 1-4 minutes cold | Necessary for `tauri-specta`; cache setup can dominate. |
| `npm run tauri:build` packaged validation | 2-10 minutes local, longer on cold machines | Not a per-edit loop. Use as phase closeout. |
| Cross-platform GitHub matrix | 10-30 minutes per OS lane, often longer on first pass | CI failures need batching and good artifact logs. |

Practical adjustment: keep TDD inside the fast boundary first (`Vitest`, `tsc`, Rust unit checks), then run packaged Tauri smoke at task or phase closeout. Do not pretend every task can follow a tight red/green/refactor loop if it depends on full Rust/Tauri packaging.

## `/agent-teams` File Ownership Collisions

**`src-tauri/src/lib.rs` collision set:** Phase 1.3 (`tauri-specta` builder), Phase 2.1 (remove generic process authority), Phase 4.2 (lifecycle hooks), Phase 6.1 (devtools gating), Phase 8.2 (updater setup), Phase 10.1 (logging plugin), Phase 11.1 (desktop affordances). These cannot run in parallel without a maintainer merge lane.

**`src-tauri/Cargo.toml` collision set:** Phase 1.3 (`tauri-specta`), Phase 6.1 (profiles/devtools), Phase 8.2 (updater/process), Phase 10.1 (log), likely Phase 4/11 plugins. Dependency edits should be serialized or owned by one "native-deps" agent.

**`src-tauri/tauri.conf.json` collision set:** Phase 2.2 (CSP/capabilities interaction), Phase 4.2 (file associations/deep links/window), Phase 8.2 (updater config), Phase 9.2 (sidecars), Phase 12 (bundle formats). A config steward should own this file across phases.

**`src-tauri/capabilities/default.json` collision set:** Phase 2.2 (least privilege), Phase 9.2 (Arduino sidecar permissions), Phase 11.1 (tray/shortcut/notification/autostart permissions), likely Phase 8 process permission. This is the highest security collision and should not be split between unsynchronized agents.

**`client/src/lib/tauri-api.ts` collision set:** Phase 1.2 bridge routing, Phase 1.3 generated commands refactor, Phase 2.1 process command removal, Phase 3 runtime topology. Phase 1.2 and 1.3 should either be one agent or have a strict order: generate bindings first, then route callers.

## Rollback Story Per Phase

| Phase | Rollback reality |
|---|---|
| 1 | Mostly reversible if the `DesktopAPI` adapter remains the boundary. `tauri-specta` rollback means reverting dependency pins, `lib.rs` builder changes, generated bindings, and `tauri-api.ts` imports together. |
| 2 | Security rollback is dangerous: restoring broad capabilities may unbreak workflows but reopens authority. Keep old capability file as a reviewed fixture, not a casual rollback target. |
| 3 | Dry-run classifier rollback is easy; mutating storage migration rollback is not. Do not mutate user data until export/backup and idempotent markers exist. |
| 4 | Lifecycle rollback can disable file associations/deep links/window-state while keeping Phase 3 storage. Needs platform-specific uninstall or config cleanup notes. |
| 5 | CI workflow rollback is straightforward, but published artifacts from failed CI should be clearly marked non-release. |
| 6 | Devtools/source-map rollback can re-enable debug visibility, but public artifacts must be regenerated. Never patch trust by editing only docs. |
| 7 | Signing placeholder rollback is easy; real signing environment rollback is procedural and Tyler-owned. Do not let agents create or rotate trust anchors. |
| 8 | Updater rollback is hard after users install an updater-capable build. Before public updater rollout, require a tested downgrade/disabled-channel story. |
| 9 | Sidecar rollback must remove packaged binaries, capabilities, and wrappers together. Hardware workflows should fail closed with clear no-device/no-toolchain messaging. |
| 10 | Local logging rollback is easy if log retention/export settings are isolated. Remote telemetry, if later added, requires consent-state rollback and endpoint disablement. |
| 11 | Optional UX affordances should be feature-flagged so rollback is disabling config, not ripping out native plugin code. |
| 12 | Distribution channel rollback is mostly release-policy work, but store/Flatpak/Snap metadata can create public stale packages. Treat each channel as a separate release lane. |

## Round 5 Recommendation From This Critique

Round 5 should not start coding yet. It should produce a pre-implementation validation and execution packet:

- A script or checklist that verifies npm/cargo cache writability, Rust/Tauri toolchain versions, `npm run check`, `cargo check`, `npm run tauri:build` prerequisites, and exact registry pins.
- A Phase 1 prompt pack with one serialized owner for `src-tauri/src/lib.rs`/`Cargo.toml` and one owner for caller wiring, with an explicit merge order.
- A supersession note for the IPC ADR so agents know `tauri-specta` replaces the manual drift parser as the primary contract guard.

# Codex Response: Tauri v2 Migration Round 1 Critique

**Review date:** 2026-05-10
**Scope:** Round 1 adversarial critique of `CODEX_HANDOFF.md` and `docs/audits/2026-05-09-tauri-v2-migration-phase0-findings.md`
**Status:** Round 1 critique complete, with tooling caveats noted below. Planning/audit only. No `src-tauri/` code edits were made.

## Executive Verdict

Phase 0 is directionally right, but it is too gentle on the current scaffold. The two "TBD" debt notes should be closed as **still true**:

- The production Express launch still depends on a global `node` executable. `src-tauri/src/lib.rs:230-237` calls `std::process::Command::new("node")`, while `src-tauri/tauri.conf.json` has no `bundle.externalBin`.
- `spawn_process` is exposed as a generic custom command without an allowlist. `src-tauri/src/lib.rs:189-204` accepts arbitrary `command` and `args`. `src-tauri/capabilities/default.json` scopes plugin permissions, but it does not constrain this custom Rust command.

The more adversarial finding: this is not just "missing sidecar/plugin work." The current desktop boundary has no verified IPC contract, no command threat model, and no architectural decision about whether Express is a temporary compatibility bridge or the long-term desktop backend. If the plan adds sidecars, updater, and native hardware plugins before answering that, it risks hardening the wrong shape.

## Tooling Caveats

- NotebookLM auth eventually verified successfully: `nlm version 0.6.6`; `nlm login --check` returned valid auth for `wtyler2505@gmail.com` with 116 notebooks.
- One live `nlm source content` call for the master pp-core source eventually returned. The rest of the 12 required pp-core sources were read from the local DevLab mirror cache at `~/.cache/pp-nlm/devlab-source-content/pp-core/`.
- Context7 MCP calls were attempted through the lazy-loaded tool surface, but the MCP calls returned `user cancelled MCP tool call`. I used official Tauri v2 web docs instead, and Round 2 should rerun Context7 before finalizing source-backed claims.
- I did not run `tauri dev` or `tauri build` because the user explicitly scoped this as a planning/audit pass and said not to ship `src-tauri/` code edits. Build smoke should be a Round 2/Phase 0.5 gate.

## Adversarial Round 1A: Drift Verification

| Claim / area | Codex verdict | Evidence | Planning impact |
|---|---|---|---|
| CSP disabled | **Stale, but only partially resolved** | `src-tauri/tauri.conf.json:22-24` has a CSP and `withGlobalTauri:false` at line 11. | Do not repeat old "CSP disabled" debt as current truth. Still harden `style-src 'unsafe-inline'` and `connect-src http://localhost:*`. |
| Global Tauri API enabled | **Resolved** | `src-tauri/tauri.conf.json:11` sets `"withGlobalTauri": false`; Tauri config docs confirm this controls `window.__TAURI__` injection: https://v2.tauri.app/reference/config/#withglobaltauri | Keep this as a resolved historical note, not active debt. |
| Express starts through global Node | **Confirmed still true** | `src-tauri/src/lib.rs:230-237` calls `Command::new("node")`; `src-tauri/tauri.conf.json:26-40` has no `bundle.externalBin`. Tauri sidecar docs require `externalBin` plus target-triple binaries: https://v2.tauri.app/develop/sidecar/ | This is P0 for any production bundle. Decide whether to bundle Node as a temporary sidecar or retire Express before investing in sidecar packaging. |
| `spawn_process` lacks allowlist | **Confirmed, and worse than Phase 0 states** | `src-tauri/src/lib.rs:189-204` accepts arbitrary command/args. Tauri capabilities docs say app-registered commands are allowed by default unless restricted via the app manifest: https://v2.tauri.app/security/capabilities/ | Do not "fix" this only in `capabilities/default.json`. Replace it with typed commands or an explicit allowlisted dispatcher, plus validation, cwd/env/output limits, timeouts, and tests. |
| Broad shell/fs plugin authority | **Confirmed** | `src-tauri/capabilities/default.json:20-31` grants `shell:default`, `shell:allow-open`, `fs:default`, `fs:allow-read-file`, `fs:allow-write-file`, etc. | Capability hardening must inventory each frontend call and delete unused plugin authority. Current custom FS commands duplicate FS plugin permissions. |
| Vite relative base missing | **Confirmed** | `vite.config.ts:8-102` has no `base: './'`. The pp-core Tauri source flags this as a Windows/WebView2 blank-screen risk. | Keep as early P0, paired with a packaged smoke test. |
| Release profile missing | **Confirmed** | `src-tauri/Cargo.toml:1-18` has no `[profile.release]`. | Valid, but not first. Add after baseline build and sidecar/release target decisions. |
| Tauri CLI drift | **Confirmed minor drift** | Installed CLI reports `tauri-cli 2.10.1`; npm latest for `@tauri-apps/cli` was `2.11.1` during this review. | Pin/verify versions before implementation. Do not casually mix `^2.x` npm plugin versions with a migration plan that needs reproducible builds. |
| Rust/frontend IPC command contract | **New critical finding** | Frontend invokes `read_file_contents`, `write_file_contents`, and `get_app_version` in `client/src/lib/tauri-api.ts:123-146`; Rust registers `read_file`, `write_file`, and `get_version` in `src-tauri/src/lib.rs:375-382`. | Add an IPC contract audit before security/plugin work. The Tauri bridge is currently not runtime-credible for those calls. |
| Desktop bridge integration | **New gap** | Search found `client/src/lib/tauri-api.ts` mostly self-contained; app-wide usage was not evident in the first pass. | Before adding plugins, prove which UI paths actually call the Tauri bridge and which still assume browser/server behavior. |
| localStorage scope | **Phase 0 under-counts it** | `rg -l "localStorage|sessionStorage" client/src | wc -l` returned `271`. Phase 0 says "6+ localStorage-only features." | Treat storage as a full migration workstream with classification, not a late polish item. |
| Devtools in production surface | **New release-hardening risk** | `src-tauri/Cargo.toml:8` enables `tauri` feature `devtools`; menu exposes "Toggle Developer Tools" in `src-tauri/src/lib.rs:297-300` and `354-360`. | Define dev/release behavior explicitly before signing and updater. |

## Adversarial Round 1B: Phase Ordering Critique

The proposed 12-phase order starts with reasonable chores, but it misses a blocking "is this scaffold actually coherent?" checkpoint.

### Problem 1: It hardens before it understands the command surface

Starting with "CSP + capability hardening" is right in spirit, but incomplete in practice. Tauri's own capabilities docs say custom app commands registered with `invoke_handler` are allowed by default unless constrained through the app manifest. That means the current generic `spawn_process` problem is not solved by trimming `capabilities/default.json` alone.

Recommended adjustment:

1. Inventory every Rust command, plugin permission, frontend `invoke`, and Electron-compat API.
2. Add an IPC contract table: command name, frontend caller, Rust handler, payload schema, authority, timeout, expected errors.
3. Only then harden CSP/capabilities and delete or replace generic authority.

### Problem 2: Node sidecar is treated as inevitable

Phase 0 puts "Node sidecar" before "arduino-cli sidecar" and "native serial migration." That may be the right compatibility move, but it should not be assumed. ADR-0009 says Tauri v2 with a Rust backend is the chosen shell, while also saying complex business logic stays in Express. Those two statements are now in tension.

Round 2 should force this decision:

- **Path A: Compatibility bridge.** Bundle Express/Node as a short-term sidecar. Add random localhost port, auth token, health checks, log capture, graceful shutdown, CSP specificity, and target-triple sidecar packaging.
- **Path B: Native desktop backend.** Move privileged desktop operations to typed Rust commands/plugins and reduce Express to API/dev-server only.
- **Path C: Hybrid.** Keep Express for business/API compatibility but move file, process, serial, HID, updater, and project-open authority to Rust.

Do not build updater/signing around an undecided runtime topology.

### Problem 3: Updater is too early relative to signing and CI

Tauri updater requires updater artifacts and a public key in config, and release endpoints must be planned. Official updater docs describe `createUpdaterArtifacts`, `pubkey`, and endpoint config: https://v2.tauri.app/plugin/updater/

So "Updater plugin" should not be a standalone phase before release infrastructure. It should follow or be bundled with:

- artifact naming/versioning policy,
- signing key custody,
- CI release matrix,
- update channel endpoints,
- rollback and staged rollout policy.

### Problem 4: localStorage migration is too late

Storage is not polish for this app. The current codebase has 271 files touching `localStorage` or `sessionStorage`, including project layout, AI/chat settings, API key scratch flows, firmware snapshots, keyboard shortcuts, interaction history, and workspace state. Tauri's Store plugin is an option for persistent key-value state, but it is only one state-management option: https://v2.tauri.app/plugin/store/

Recommended split:

- **Critical project/workspace data:** app-data/project file/database plan first.
- **Secrets/tokens:** server-side or native secret storage strategy; do not regress audit #60 plaintext-at-rest fixes.
- **UI preferences:** store/window-state plugin or app-data JSON later.
- **Caches/history:** bounded, clearable, versioned storage.

### Problem 5: desktop lifecycle work is late, but it shapes architecture

Window state, file associations, deep links, single instance, autostart, tray, and global shortcuts are not all "UX polish." They define app launch/open behavior. Tauri deep-link docs note Windows/Linux deep links arrive as arguments to a new process and integrate with the single-instance plugin: https://v2.tauri.app/plugin/deep-linking/ The single-instance docs also call out Snap/Flatpak DBus constraints: https://v2.tauri.app/plugin/single-instance/

Recommended move: lifecycle/import-open behavior should be decided before packaging and before final storage migration.

## Revised Phase Shape I Would Use

This is not the final plan, but it is the order I would push into Round 2:

1. **Phase 0.5 - Baseline truth and contract audit:** run current Tauri smoke builds, inventory commands/plugins/frontend invokes, verify CLI/plugin versions, decide test matrix.
2. **Phase 1 - Security boundary repair:** remove/replace generic `spawn_process`, align command names, scope FS/shell/dialog permissions, tighten CSP, keep `withGlobalTauri:false`.
3. **Phase 2 - Runtime topology decision:** choose Express sidecar, Rust-native backend, or hybrid; document port/auth/lifecycle/shutdown/logging implications.
4. **Phase 3 - Storage and app-state architecture:** classify the 271 storage-touching files, choose Store/FS/SQL/native secret strategies, define migration and rollback.
5. **Phase 4 - Hardware authority:** serial, HID, Arduino CLI, sidecars, udev/driver/platform permissions, no-device and unplug/replug tests.
6. **Phase 5 - Desktop lifecycle UX:** single instance, file associations, deep links, window state, tray, global shortcuts, autostart/login item.
7. **Phase 6 - CI and packaged smoke:** Linux/Windows/macOS matrix, tauri-action, sidecar artifact checks, packaged launch tests.
8. **Phase 7 - Signing, updater, release channels:** Windows/macOS signing, updater pubkey/endpoints, stable/beta/nightly policy, rollback.
9. **Phase 8 - Observability and consent:** logs, crash/error reporting, telemetry opt-in UX, redaction, artifact retention.

## Adversarial Round 1C: Missing Gap Analysis

These gaps should be added to Phase 3 / final plan:

1. **IPC contract and generated tests.** The current command-name mismatch proves the plan needs a command contract table and tests that fail when frontend invokes drift from Rust handlers.
2. **Custom command authorization.** Tauri plugin permissions are not enough for app commands. Use Tauri app manifest command restriction or remove generic commands entirely. Source: https://v2.tauri.app/security/capabilities/
3. **Sidecar lifecycle and localhost threat model.** If Express stays, define random port selection, token auth, health check, crash restart policy, log collection, graceful shutdown, and CSP `connect-src` narrowing.
4. **Third-party plugin provenance.** `tauri-plugin-serialplugin` and `tauri-plugin-hid` are not core Tauri plugins. Audit maintenance, licenses, release cadence, platform support, security posture, and fallback path before committing.
5. **Tauri official plugin set.** Add explicit decisions for Store, Window State, Single Instance, Deep Link, Autostart, Global Shortcut, Logging, Process, SQL/FS, Stronghold/secret storage where relevant. Official plugin index is visible through Tauri docs navigation, with individual docs for Store, Window State, Deep Link, Autostart, and Updater.
6. **i18n scope.** Do not assume an official Tauri i18n plugin. Scope frontend i18n, native menu labels, OS dialogs, and update/error messages separately.
7. **WebView2 distribution strategy.** Reframe "WebView2 update channel pinning" as a Windows runtime/installer policy. Decide Evergreen vs fixed/runtime installer behavior through Tauri config/reference docs and Windows distribution requirements.
8. **Linux distribution matrix.** Decide AppImage/deb/rpm/Snap/Flatpak. Snap/Flatpak can affect DBus-based single instance and hardware access. This is not only a packaging choice.
9. **File association and project-open flow.** Define `.protopulse` or project folder open semantics, cold-start and already-running behavior, validation, and path trust boundary.
10. **Autostart/login item.** Tauri has an Autostart plugin for launch-at-login behavior: https://v2.tauri.app/plugin/autostart/ Decide if ProtoPulse needs this at all before adding it.
11. **Telemetry consent UX.** Define opt-in timing, what is collected, local log redaction, "export diagnostics" flow, and offline behavior before adding Sentry or similar.
12. **Secret handling.** Existing audit #60 protections moved secrets away from localStorage. Desktop migration must preserve or improve that, not push API keys into app-data JSON.
13. **Release channel and key custody.** Updater keys, Windows cert, Apple Developer credentials, and GitHub secrets need Tyler-owned custody decisions. Agents can document and wire placeholders, not own trust anchors.
14. **Packaged smoke tests.** CI should verify a packaged app launches, loads assets, can resolve sidecars, and can reach the local backend if one exists. Unit tests alone will not catch WebView path/sidecar failures.
15. **Platform hardware tests.** Serial/HID behavior needs no-device, permission denied, unplug/replug, busy port, large output, cancellation, and multiple device tests.
16. **Devtools/release gating.** Decide whether devtools and the menu entry exist in production. Current config exposes the feature unconditionally.
17. **Database/offline data model.** The current web/server stack uses server-side assumptions. Desktop needs a clear local data strategy: external server, embedded DB, SQLite/Tauri SQL, or hybrid.
18. **Source map and debug artifact policy.** `vite.config.ts:76` uses hidden source maps. Decide whether packaged releases include or upload maps, and how crash reports map to them.
19. **Permission schemas and drift checks.** Tauri generates schemas for available permissions. Add a check that capability files stay valid and unused permissions are flagged.
20. **Rollback plan for the migration itself.** Because this is a large desktop migration, keep the browser/dev flow working until packaged desktop is proven.

## Adversarial Round 1D: Lane Split Critique

The lane split is mostly sane, especially the rule that `src-tauri/**/*` stays frozen until Tyler approves the final plan. The weak spots:

- **Codex owning all NotebookLM infrastructure is brittle.** Live NLM did eventually work, but the initial CLI/MCP latency and Context7 cancellation show that Round 2 needs a fallback path: local cache, Claude query, or explicit "source temporarily unavailable" section.
- **Joint knowledge-note edits need a single writer per file.** "Joint" ownership is good philosophically but dangerous operationally. For each `knowledge/tauri-*.md` note, assign one writer and one reviewer.
- **Deliverable naming is split.** The handoff asks for `docs/audits/...codex-verify.md`; Tyler asked for `CODEX_RESPONSE_TAURI.md`. I wrote both. Future rounds should use one canonical response file plus linked audit appendices.
- **Signing/secrets need human ownership.** Neither Claude nor Codex should be treated as owner of certificates, updater private keys, Apple credentials, or production release secrets.
- **Claude vs Codex role descriptions are too rigid for this task.** The handoff says Claude is stronger on research, but Tyler explicitly requested Codex critique. Use artifact ownership, not abstract tool stereotypes, for this migration.

## Round 2 Recommended Focus

Round 2 should not start by adding more plugin line items. It should answer these in order:

1. **Runtime topology:** Is Express a temporary sidecar, a permanent sidecar, or being retired from privileged desktop paths?
2. **Command threat model:** What can compromised frontend JS cause the native shell to do today, and what should it be allowed to do after Phase 1?
3. **IPC contract:** Which frontend calls should exist, what are their exact command names and payloads, and how do tests enforce parity?
4. **Storage classification:** Turn the 271 storage-touching files into a migration matrix: project data, secret/scratch, preference, cache/history, test-only.
5. **Plugin provenance matrix:** Official vs third-party, Rust crate/npm package versions, platforms, permissions, maintenance risk, test evidence.
6. **Packaged smoke design:** Define the first CI job that proves the desktop app launches from a packaged artifact without relying on global Node or dev server state.
7. **Context7 retry:** Re-run Context7 for Tauri v2, shell, fs, updater, sidecar, capabilities, and @tauri-apps/api once the MCP cancellation issue is clear.

## Source URLs Used

- Tauri CSP: https://v2.tauri.app/security/csp/
- Tauri capabilities and custom command boundary: https://v2.tauri.app/security/capabilities/
- Tauri permissions: https://v2.tauri.app/security/permissions/
- Tauri sidecars / external binaries: https://v2.tauri.app/develop/sidecar/
- Tauri shell plugin command allow examples: https://v2.tauri.app/plugin/shell/
- Tauri updater: https://v2.tauri.app/plugin/updater/
- Tauri window-state: https://v2.tauri.app/plugin/window-state/
- Tauri deep-linking: https://v2.tauri.app/plugin/deep-linking/
- Tauri single-instance: https://v2.tauri.app/plugin/single-instance/
- Tauri autostart: https://v2.tauri.app/plugin/autostart/
- Tauri store: https://v2.tauri.app/plugin/store/
- Tauri GitHub pipeline / tauri-action: https://v2.tauri.app/distribute/pipelines/github/
- Tauri Windows signing: https://v2.tauri.app/distribute/sign/windows/
- Tauri macOS signing: https://v2.tauri.app/distribute/sign/macos/
- Tauri configuration reference: https://v2.tauri.app/reference/config/
- Tauri Vite integration: https://v2.tauri.app/start/frontend/vite/

# Tauri v2 Migration Round 2 Revised Phasing

**Date:** 2026-05-10
**Inputs:** Phase 0 findings, Codex Round 1 verification, Round 2 self-critique, and Round 2 NotebookLM deep research.
**Status:** Planning/audit only. No `src-tauri/` files were edited.

## Revised Drift Table

| Area | Phase 0 state | Round 1 verification | Round 2 research impact | Revised priority |
|---|---|---|---|---|
| CSP/global Tauri | Phase 0 noted stale debt: CSP now set and `withGlobalTauri:false`. | Verified current CSP exists, `withGlobalTauri:false`, but CSP still allows `style-src 'unsafe-inline'` and broad localhost. | Capability/security research confirms CSP should be part of a broader authority inventory, not a standalone first patch. | Phase 2 after IPC/security inventory. |
| Global Node launch | Phase 0 left Express/global Node unconfirmed. | Verified still true: Rust starts production Express with global `node`; no `bundle.externalBin`. | Sidecar research shows target-triple binaries, working directory, signing/notarization, and runtime packaging are hard dependencies. | Phase 3 topology decision, then sidecar prototype if chosen. |
| Generic `spawn_process` | Phase 0 left allowlist status unconfirmed. | Verified arbitrary command/args exposed as custom command. | Capability research confirms plugin permission cleanup alone does not solve custom authority. | Phase 2 blocker. |
| Broad shell/fs plugin permissions | Missing/overbroad authority suspected. | Verified broad shell/fs grants in capability file. | Tauri permission/scope docs support per-plugin and per-command least-privilege tables. | Phase 2. |
| IPC command mismatch | Not in Phase 0. | New high-risk finding: frontend invokes names Rust does not register. | Multi-window/IPC research confirms command/event contracts are central to app correctness. | Phase 1 blocker before security edits. |
| Vite `base: './'` | Missing and P0 in Phase 0. | Verified missing. | CI/release research says packaged smoke must catch WebView asset/path failures. | Phase 1 baseline smoke, then Phase 4 packaging smoke. |
| Cargo release profile | Missing and P1 in Phase 0. | Verified missing. | Release research says profile tuning matters but should follow runtime topology and baseline build credibility. | Phase 6 release hardening. |
| Updater plugin | Missing and P1 in Phase 0. | Confirmed missing; Round 1 argued too early. | Updater research confirms signatures, private key custody, endpoints, artifacts, and CI are prerequisites. | Phase 8 after signing/CI design. |
| Windows signing | Not verified. | Round 1 flagged release trust/key custody. | Windows research confirms EV vs OV/SmartScreen and cloud/HSM signing decisions affect user trust. | Phase 7 before updater. |
| macOS notarization | Not verified. | Round 1 flagged signing/secrets. | macOS research confirms hardened runtime, entitlements, sidecars, Developer ID, and notarization must be tested together. | Phase 7 before updater. |
| Tauri action / CI | Not verified. | Round 1 moved packaged smoke earlier. | CI research confirms OS matrix, WebKit dependencies, artifact names, updater signatures, and runner drift matter. | Phase 5 before updater. |
| File associations | P2/UX polish in Phase 0. | Round 1 moved lifecycle earlier. | File association and deep-link research confirm cold-start/warm-start, single-instance, and project-open semantics affect architecture. | Phase 4 lifecycle design. |
| Deep links | Missing from Phase 0. | Round 1 added as lifecycle gap. | Deep-link research confirms protocol registration and single-instance forwarding need early design. | Phase 4. |
| Multi-window/window state | Window state P2 in Phase 0. | Round 1 moved lifecycle earlier. | Multi-window research ties window state to IPC, capabilities, and project-open behavior. | Phase 4. |
| localStorage/sessionStorage | Phase 0 described 6+ localStorage features. | Verified 271 client files touch local/session storage. | Lifecycle and telemetry research show storage is also trust/privacy/recovery surface. | Phase 3/4, not late polish. |
| Serial/HID/Arduino CLI | Missing plugins/sidecars in Phase 0. | Not deeply verified in Round 1 beyond dependency absence. | Sidecar/signing research raises packaging risk for `arduino-cli`; third-party serial/HID provenance still open. | Phase 9 after topology and authority contract. |
| Linux packaging | Not a full workstream in Phase 0. | Round 1 added Linux matrix concern. | Linux distribution research shows AppImage/deb/Flatpak/Snap alter sandboxing, DBus, updates, hardware, and single-instance behavior. | Phase 5/7 release matrix decision. |
| Telemetry/crash reporting | Missing from Phase 0. | Round 1 added consent/logging gap. | Telemetry research supports a privacy-first diagnostics/export design before Sentry/Bugsnag wiring. | Phase 10 after security/release shape. |
| Supply chain | Missing from Phase 0. | Round 1 added provenance/security gap. | Supply-chain research adds cargo/npm audit, provenance, SBOM, isolated CI, signed artifacts, and release policy. | Phase 5 and Phase 7 gates. |
| Devtools in production | Not in Phase 0. | Verified release-hardening risk. | Release/signing research makes this a distribution trust issue. | Phase 6 release hardening. |

## Revised Phase Ordering

### Phase 1 - Baseline Truth, Build Smoke, And IPC Contract

Goal: prove the current scaffold's actual behavior before changing it.

- Re-run version probes for Tauri CLI, npm packages, Rust, Node, and package manager lock state.
- Run bounded `tauri dev`/build smoke if allowed, plus a packaged asset-path smoke targeted at the missing Vite `base: './'` risk.
- Generate the IPC contract table: frontend caller, command/event name, Rust handler, payload schema, authority, timeout, error model, and owning test.
- Add a drift test that fails when frontend invokes are not registered by Rust.
- Output: no security or sidecar edits until the command-name mismatch and bridge caller graph are documented.

### Phase 2 - Native Authority Threat Model And Least-Privilege Boundary

Goal: remove the highest-risk native authority before expanding the desktop surface.

- Replace or quarantine generic `spawn_process` in the plan with typed operations or an explicit allowlisted dispatcher.
- Inventory shell/fs/dialog/opener permissions against real callers.
- Define custom command restrictions, plugin scopes, path scopes, CSP targets, localhost policy, and dev/prod differences.
- Decide production devtools/menu behavior.
- Sources: Tauri capabilities, permissions, command scopes, CSP, and security advisory/audit sources from Round 2.

### Phase 3 - Runtime Topology And Storage Architecture Decision

Goal: decide what ProtoPulse desktop actually is before sidecar/release work.

- Choose one: temporary Express/Node sidecar, permanent hybrid backend, or Rust-native privileged backend with Express reduced to non-privileged paths.
- If Express remains, specify random port, loopback auth token, health checks, crash policy, log capture, graceful shutdown, CSP `connect-src`, and no-global-Node packaging.
- Classify the 271 storage-touching client files into project data, secrets/scratch, UI preferences, caches/history, test-only, and dead code.
- Decide project file/database/Store/FS/SQL/native secret boundaries and rollback/migration rules.

### Phase 4 - Desktop Lifecycle And Project-Open Semantics

Goal: design app-launch behavior before packaging ossifies it.

- Define `.protopulse` file association or project-folder open semantics.
- Specify cold-start vs already-running behavior, single-instance forwarding, deep-link validation, window focus, pending-open queue, and path trust boundary.
- Decide window-state and multi-window state synchronization before moving data out of browser storage.
- Sources: file association, deep-link, single-instance, IPC, window-state, Store, and platform capability sources.

### Phase 5 - CI Matrix, Supply-Chain Baseline, And Packaged Smoke

Goal: make releases reproducible before signing/updater complexity lands.

- Add a tauri-action/GitHub Actions matrix plan for Windows, macOS Intel, macOS Apple Silicon, and Linux target(s).
- Include Linux system dependency policy, sidecar artifact checks, Vite asset-path checks, packaged launch smoke, and updater-signature artifact outputs when relevant.
- Add `cargo audit`/RustSec, npm audit, lockfile checks, provenance/SBOM plan, and isolated runner assumptions.
- Sources: Tauri GitHub pipeline docs, tauri-action, GitHub runner docs, RustSec, npm audit/provenance, SLSA/GitHub supply-chain docs.

### Phase 6 - Release Hardening Without Public Distribution

Goal: tighten build output after architecture and CI are credible.

- Add/tune Cargo release profile, source-map/debug artifact policy, devtools gating, app icons/resources, and hidden-source-map handling.
- Verify bundle size and startup behavior for the chosen topology.
- Keep browser/dev flow working as rollback.

### Phase 7 - Signing, Notarization, And Key Custody

Goal: create a Tyler-owned trust model before updater.

- Decide Windows EV/OV/Azure Artifact Signing/Key Vault/HSM route and SmartScreen expectations.
- Decide Apple Developer Program identity, Developer ID certificate, notary credentials, hardened runtime, entitlements, and embedded sidecar signing.
- Define who owns credentials, how CI accesses them, how they rotate, and how agents avoid becoming trust-anchor owners.
- Sources: Tauri Windows signing, Tauri macOS signing, Apple hardened runtime/notary docs, Microsoft signing/Artifact Signing docs.

### Phase 8 - Updater And Release Channels

Goal: add updates only after signed artifacts and release channels exist.

- Configure updater only after artifact naming, signatures, pubkey/private-key custody, endpoint strategy, and rollback policy are decided.
- Define stable/beta/nightly channels, critical update behavior, user prompt UX, update logs, and failed-update recovery.
- Sources: Tauri updater docs, CrabNebula updater docs, CI/release pipeline sources.

### Phase 9 - Hardware Authority And Toolchain Packaging

Goal: bring serial/HID/Arduino workflows into the native trust boundary.

- Audit `tauri-plugin-serialplugin`, HID choices, official alternatives, maintenance status, and platform permissions.
- Package `arduino-cli` as a sidecar if still needed, with target triples, signing/notarization, config/data-dir strategy, and no-device/unplug/busy-port tests.
- Keep hardware actions typed and scoped; do not reuse generic `spawn_process`.

### Phase 10 - Observability, Diagnostics, And Consent

Goal: make failure reporting useful without violating trust.

- Decide local logs, crash capture, Sentry/Bugsnag/manual minidump strategy, source-map/symbol upload, diagnostic export, data redaction, retention, and opt-in timing.
- Keep telemetry optional and explainable.
- Sources: Sentry community plugin, Tauri logging/process model, Bugsnag Rust crate, crash-reporting references, Tauri advisories.

### Phase 11 - Optional Desktop UX Integrations

Goal: add polish only after core lifecycle/release behavior is stable.

- System tray, global shortcuts, autostart/login item, notifications, custom menus, and other desktop affordances.
- Each integration must include capability scope, accessibility behavior, platform support, and tests.

### Phase 12 - Linux Distribution Expansion And Store Channels

Goal: expand distribution formats deliberately instead of by default.

- Start with the formats chosen in Phase 5, likely deb/AppImage for direct Linux distribution.
- Evaluate Flatpak/Snap only with explicit sandbox, DBus, filesystem, hardware, update, and store-policy tests.
- Consider Microsoft Store/App Store channels only after signing, updater, and privacy/diagnostics policies are mature.

## Dependency Rules

- Do not implement updater before signing, CI artifacts, and key custody.
- Do not package Express/Node before runtime topology is decided.
- Do not harden only plugin capabilities while generic custom command authority remains.
- Do not migrate storage without project-open lifecycle and data-classification decisions.
- Do not treat Linux package formats as equivalent; package format can change runtime authority and desktop integration.
- Do not call release automation complete until packaged artifacts actually launch and exercise sidecars/native bridge paths.

## Round 3 Focus

Round 3 should close three decisions before code edits:

1. Runtime topology: Express sidecar vs hybrid vs Rust-native privileged backend.
2. IPC/native authority contract: registered commands, frontend callers, payload schemas, permissions, and tests.
3. Release trust model: CI matrix, Windows/macOS signing, updater key custody, and initial Linux distribution target.

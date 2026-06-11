# Codex R1 Discovery Response - Tauri Phases 2-9 Retro

## Inputs Read

- `COLLAB_TAURI_RETRO_HANDOFF_R1.md`
- `src-tauri/src/lib.rs`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`
- `src-tauri/build.rs`
- `client/src/lib/desktop/runtime-topology.ts`
- `client/src/lib/__tests__/runtime-topology.test.ts`
- `client/src/lib/desktop/storage-migration.ts`
- `client/src/lib/__tests__/desktop-storage-migration.test.ts`
- `inbox/tauri-storage-reconciliation-2026-05-10.md`
- `client/src/lib/desktop/project-open-contract.ts`
- `client/src/lib/__tests__/project-open-contract.test.ts`
- `client/src/lib/__tests__/tauri-native-authority.test.ts`
- `.github/workflows/tauri-build.yml`
- `scripts/ci/tauri-packaged-smoke.sh`
- `scripts/ci/supply-chain-check.sh`
- `scripts/ci/verify-signed-artifacts.sh`
- `docs/release/tauri-signing-runbook.md`
- `docs/release/tauri-updater-policy.md`
- `docs/audits/tauri-hardware-plugin-provenance.md`
- `scripts/tauri/prepare-arduino-sidecar.ts`
- Additional targeted probes: `package.json`, `client/src/lib/tauri-api.ts`, `client/src/lib/csv.ts`, `client/src/lib/auth-context.tsx`, `client/src/lib/queryClient.ts`, `client/src/components/views/arduino/JobHistoryPanel.tsx`, `client/src/lib/keyboard-shortcuts.ts`, `client/src/hooks/useApiKeys.ts`, `client/src/hooks/useChatSettings.ts`, `client/src/components/views/ProcurementView.tsx`, `client/src/lib/constants/storage-keys.ts`.

Canonical primary docs checked:

- Tauri capabilities / command allowlist: https://v2.tauri.app/security/capabilities/
- Tauri sidecars / `externalBin`: https://v2.tauri.app/develop/sidecar/
- Tauri updater: https://v2.tauri.app/plugin/updater/
- Tauri deep links / single-instance integration: https://v2.tauri.app/plugin/deep-linking/
- Tauri config / file associations: https://v2.tauri.app/reference/config/
- Tauri debug/devtools behavior: https://v2.tauri.app/develop/debug/
- Microsoft SmartScreen reputation: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- Microsoft code-signing options: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- Apple notarization/signing: https://developer.apple.com/documentation/security/customizing-the-notarization-workflow and https://developer.apple.com/documentation/xcode/creating-distribution-signed-code-for-the-mac
- Arduino CLI releases: https://github.com/arduino/arduino-cli/releases
- GitHub-hosted runners: https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- GitHub runner images: https://github.com/actions/runner-images

## Per-Phase Discovery

### Phase 2 - Native Authority

Working:

- `spawn_process` is removed from the live Specta command list; `collect_commands![]` contains only dialog/file/app-info commands at `src-tauri/src/lib.rs:212-220`.
- `AppManifest::commands` exists and excludes `spawn_process`, matching Tauri's documented recommendation that custom commands are otherwise allowed by default (`src-tauri/build.rs:11-24`, Tauri capabilities docs).
- `withGlobalTauri` stays false and production CSP removed `http://localhost:*` from `connect-src` (`src-tauri/tauri.conf.json:11-24`).

Friction:

- The FS capability allowlists are broad for import/export (`$DESKTOP/**`, `$DOCUMENT/**`, `$DOWNLOAD/**`) across read/write/exists (`src-tauri/capabilities/default.json:29-59`). That may be acceptable for save dialogs, but it is not narrowly tied to `.protopulse` project files.
- Secret denies cover `$APPDATA/protopulse/**` but not `$APPLOCALDATA/protopulse/**`, even though `$APPLOCALDATA/protopulse/**` is allowed for read/write (`src-tauri/capabilities/default.json:31-47`, `src-tauri/capabilities/default.json:70-77`).

Missing:

- High severity: the custom Rust `read_file` and `write_file` commands directly call `tokio::fs::read_to_string` and `tokio::fs::write` on caller-provided paths (`src-tauri/src/lib.rs:171-184`). Those commands are explicitly allowlisted (`src-tauri/build.rs:15-20`) and are what the frontend uses (`client/src/lib/tauri-api.ts:137-144`, `client/src/lib/csv.ts:37-45`). Tauri capability scope is not a wrapper around arbitrary Rust command code; Tauri's own docs say capabilities do not protect against insecure Rust code or incorrect scope checks in command implementations. This needs an R2 proposal before Phase 2 can be ratified.
- The Phase 2 test asserts scoped plugin permissions and `spawn_process` absence, but it does not assert path validation inside `read_file` / `write_file` (`client/src/lib/__tests__/tauri-native-authority.test.ts:38-109`).

Decisions:

- Accept `spawn_process` deletion.
- Dissent-with-reason on "capability scoping is done": scoped plugin permissions are useful, but the current custom file commands bypass them.
- Needs-R2-proposal for path normalization, extension/location validation, and secret deny enforcement inside Rust commands or a switch to the scoped FS plugin.

### Phase 3 - Runtime Topology + Storage

Working:

- The topology registry clearly captures 16 workflow decisions with four target values (`client/src/lib/desktop/runtime-topology.ts:22-64`) and exposes `unresolvedServerDependencies()` (`client/src/lib/desktop/runtime-topology.ts:168-179`).
- The storage planner is dry-run only and returns `mutationsApplied: 0` (`client/src/lib/desktop/storage-migration.ts:181-234`).
- The reconciliation note correctly routes through `inbox/` and preserves the pp-core supersession story (`inbox/tauri-storage-reconciliation-2026-05-10.md:42-57`).

Friction:

- The topology registry is not currently consumed by production code. Repo probe: `rg resolveWorkflowTarget` found only `client/src/lib/desktop/runtime-topology.ts` and `client/src/lib/__tests__/runtime-topology.test.ts`; no adapters import it. The file says adapters consult it (`client/src/lib/desktop/runtime-topology.ts:17-19`), but that has not landed.
- Runtime targets still mark Tauri `ai-chat`, `supplier-quote`, `rag-query`, `knowledge-search`, and `auth-session` as `remote-server` (`client/src/lib/desktop/runtime-topology.ts:90-129`) while the native app only best-effort spawns a local Express process if `dist/index.cjs` exists and global `node` is available (`src-tauri/src/lib.rs:250-278`). If the server is absent, these workflows silently lose their backend.

Missing:

- The 8-bucket classifier is not grounded in the actual key corpus. Real centralized storage keys use underscores and unprefixed asset keys (`client/src/lib/constants/storage-keys.ts:5-23`), but the classifier patterns mostly expect hyphenated `protopulse-*` keys (`client/src/lib/desktop/storage-migration.ts:84-141`). Example false negatives include `protopulse_ai_model`, `protopulse_routing_strategy`, `protopulse_optimization_goal`, and `asset-favorites` (`client/src/hooks/useChatSettings.ts:37-68`, `client/src/components/views/ProcurementView.tsx:120-153`).
- Legacy or stale credential-ish keys are not comprehensively captured. The auth path uses `protopulse-session-id` (`client/src/lib/auth-context.tsx:25-37`, `client/src/lib/queryClient.ts:6-10`), but at least one Arduino panel still reads `sessionId` (`client/src/components/views/arduino/JobHistoryPanel.tsx:97-102`), which the classifier would leave unclassified.
- User preference coverage is too narrow: `protopulse-keyboard-shortcuts` is a persisted user preference (`client/src/lib/keyboard-shortcuts.ts:58`) but does not match `user-prefs` (`client/src/lib/desktop/storage-migration.ts:84-90`).

Decisions:

- Accept the dry-run-only migration shape.
- Dissent-with-reason on the current regex table as migration authority. It should be generated or validated against a harvested key inventory before any mutating migration.
- Needs-R2-proposal to make topology executable: adapters should import `resolveWorkflowTarget`, and unresolved remote/server routes need a runtime health contract.

### Phase 4 - Lifecycle

Working:

- The pure TS contract has useful outcome states and tests cold-start, warm-start, same-project focus, deep-link extraction, and invalid-path rejection (`client/src/lib/desktop/project-open-contract.ts:31-130`, `client/src/lib/__tests__/project-open-contract.test.ts:30-129`).
- `single-instance` is registered before `deep-link`, matching Tauri's documented ordering guidance (`src-tauri/src/lib.rs:441-457`, Tauri deep-link docs).
- The file association `role: "Editor"` is valid as a default role per Tauri config docs (`src-tauri/tauri.conf.json:36-43`, Tauri config docs).

Friction:

- The project-open validator is slash-centric. `PATH_TRAVERSAL_RE` only checks `/../`, and `SHELL_META_RE` omits Windows-specific `^` and `%` (`client/src/lib/desktop/project-open-contract.ts:54-58`). Tests cover POSIX traversal and `;`, not Windows backslash traversal (`client/src/lib/__tests__/project-open-contract.test.ts:62-73`).
- The custom `.protopulse` file type does not define `exportedType`; Tauri config docs say custom file types should define one for macOS (`src-tauri/tauri.conf.json:36-43`, Tauri config docs).

Missing:

- High severity: the lifecycle contract is not wired. Native `single-instance` only prints argv (`src-tauri/src/lib.rs:448-452`), and no code emits the request to the frontend or calls the TS validator. The TS file says native side "will hand requests to this validator" (`client/src/lib/desktop/project-open-contract.ts:8-10`), but that bridge is missing.
- Tauri's deep-link docs require the `deep-link` feature on `tauri-plugin-single-instance` for integration on Linux/Windows. Cargo currently declares `tauri-plugin-single-instance = "2"` without features (`src-tauri/Cargo.toml:19-25`).

Decisions:

- Accept the TS contract as a starting point.
- Dissent-with-reason on claiming lifecycle wired: plugins are registered, but open events do not reach the contract.
- Needs-R2-proposal for native-to-frontend event flow, Windows path normalization, `single-instance` feature flags, and file-type export metadata.

### Phase 5 - CI + Supply Chain

Working:

- The workflow builds Linux, macOS x64, macOS arm64, and Windows x64 with Node/Rust setup before `tauri-action` (`.github/workflows/tauri-build.yml:23-104`).
- Tauri's current Linux prerequisite docs still list `libwebkit2gtk-4.1-dev`, so that dependency line is not stale on its face (`.github/workflows/tauri-build.yml:41-55`, Tauri prerequisites docs).

Friction:

- `ubuntu-latest` is floating (`.github/workflows/tauri-build.yml:28`, `.github/workflows/tauri-build.yml:41-42`). GitHub's current runner docs list `ubuntu-latest` beside `ubuntu-24.04` and `ubuntu-22.04`, and the runner-images repo maps `ubuntu-latest` to Ubuntu 24.04. This is manageable, but the workflow comment should stop assuming a fixed Ubuntu generation.
- `cargo-audit` is optional in the script (`scripts/ci/supply-chain-check.sh:40-50`), and the CI step does not install it (`.github/workflows/tauri-build.yml:113-116`).

Missing:

- The Arduino sidecar prep script says it must run before `tauri build` (`scripts/tauri/prepare-arduino-sidecar.ts:8-15`), but the workflow goes from frontend build directly to `tauri-action` (`.github/workflows/tauri-build.yml:85-104`), and `package.json` has no prebuild hook (`package.json:27-29`). Because `tauri.conf.json` now declares `externalBin` (`src-tauri/tauri.conf.json:26-30`), packaged builds can fail or ship without the expected sidecar.
- SBOM/SLSA remains a placeholder (`scripts/ci/supply-chain-check.sh:64-76`) while `id-token: write` is already granted (`.github/workflows/tauri-build.yml:18-20`).

Decisions:

- Accept the matrix shape as a baseline.
- Needs-R2-proposal to install and enforce supply-chain tools, wire sidecar prep into every relevant target, and decide which checks remain advisory versus blocking.

### Phase 6 - Release Hardening

Working:

- Release profile values are explicit (`src-tauri/Cargo.toml:41-49`).
- The unconditional Tauri `devtools` feature is absent (`src-tauri/Cargo.toml:7-18`), and both menu item and handler are debug-gated (`src-tauri/src/lib.rs:339-355`, `src-tauri/src/lib.rs:406-416`). Tauri docs confirm the inspector is debug-only unless the `devtools` feature is enabled.
- Source-map leak detection exists in the packaged smoke script (`scripts/ci/tauri-packaged-smoke.sh:64-77`).

Friction:

- The smoke script builds with `--debug` (`scripts/ci/tauri-packaged-smoke.sh:38-40`), so it does not validate the release profile or release devtools absence.
- The `.map` check only scans `src-tauri/target/debug/bundle` (`scripts/ci/tauri-packaged-smoke.sh:41-77`), while the workflow's release packaging path is produced by `tauri-action` (`.github/workflows/tauri-build.yml:88-112`).

Missing:

- The smoke check is nonblocking in CI (`.github/workflows/tauri-build.yml:118-121`), so a sourcemap leak or missing bundle artifact currently cannot fail the workflow.
- There is no release-mode artifact check for devtools absence or source-map absence.

Decisions:

- Accept `cfg(debug_assertions)` gating.
- Needs-R2-proposal to add a release-bundle verification path and make the leak check blocking when release hardening is claimed.

### Phase 7 - Signing Placeholder

Working:

- The runbook's Windows recommendation is directionally correct against current Microsoft docs: Microsoft says EV no longer bypasses SmartScreen and Azure Artifact Signing is typically the cost-effective non-Store path (`docs/release/tauri-signing-runbook.md:11-20`, Microsoft SmartScreen docs, Microsoft code-signing options docs).
- The macOS section correctly calls out Developer ID plus notarization and embedded sidecar gotchas (`docs/release/tauri-signing-runbook.md:52-85`). Apple docs also emphasize distribution signing and notarization for Developer ID software.

Friction:

- The runbook references Azure Artifact Signing eligibility and says an Azure signing step is absent and must be added later (`docs/release/tauri-signing-runbook.md:17-36`). That is fine for placeholder status, but it is not an activation-ready CI design.
- The local signed-artifact verifier uses Bash `mapfile` (`scripts/ci/verify-signed-artifacts.sh:38-43`), which is fine on GitHub-hosted Bash but fragile for local macOS users with Bash 3.2.

Missing:

- The signed-artifact CI step is dry-run and nonblocking (`.github/workflows/tauri-build.yml:123-127`), and the script exits 0 in dry-run (`scripts/ci/verify-signed-artifacts.sh:103-107`). Dropping `--dry-run` later is not enough if `continue-on-error: true` remains.
- The verifier checks signatures after artifacts exist but does not assert "all expected artifacts exist and are signed" per target; it only loops over whatever `find` discovers (`scripts/ci/verify-signed-artifacts.sh:38-49`).

Decisions:

- Accept Azure Artifact Signing as the target Windows default for ProtoPulse unless Tyler has a Store/MSIX strategy.
- Needs-R2-proposal to define activation diffs: add actual signing steps, remove dry-run/nonblocking status at the right gate, and verify expected artifact inventory.

### Phase 8 - Updater Deferred

Working:

- Deferring updater wiring is prudent because signing and key custody are not ready (`docs/release/tauri-updater-policy.md:9-15`).
- The doc correctly names `createUpdaterArtifacts`, `pubkey`, and endpoints as future activation pieces (`docs/release/tauri-updater-policy.md:42-43`, `docs/release/tauri-updater-policy.md:70-84`, Tauri updater docs).

Friction:

- The endpoint examples mix Tauri's double-brace variables with a prose `{channel}` placeholder (`docs/release/tauri-updater-policy.md:21-29`, `docs/release/tauri-updater-policy.md:62-66`). Tauri updater supports `{{current_version}}`, `{{target}}`, and `{{arch}}`; custom variables are not supported. Channel must be selected by choosing a concrete endpoint string, not by relying on `{channel}` interpolation.
- The policy says going backwards from nightly to stable requires manual reinstall (`docs/release/tauri-updater-policy.md:27-30`) but does not cite or prove that as Tauri updater behavior.

Missing:

- Prompt UX calls `tauri-plugin-process::relaunch()` (`docs/release/tauri-updater-policy.md:46-54`), but the activation checklist does not explicitly add `tauri-plugin-process` capability/config verification beyond "plugin deps" (`docs/release/tauri-updater-policy.md:82-84`).
- The aspirational domain `releases.protopulse.app` is not called out as unprovisioned infrastructure (`docs/release/tauri-updater-policy.md:21-25`, `docs/release/tauri-updater-policy.md:62-66`).

Decisions:

- Accept deferral.
- Needs-R2-proposal to tighten the policy language so future implementers cannot paste invalid endpoint templates or assume rollback semantics.

### Phase 9 - Hardware Authority

Working:

- The audit correctly treats `arduino-cli` as first-party Arduino tooling and separates serial/HID plugin adoption risk (`docs/audits/tauri-hardware-plugin-provenance.md:10-90`).
- `externalBin` follows Tauri's base-name convention, where target-specific binaries must exist with `-$TARGET_TRIPLE` suffixes (`src-tauri/tauri.conf.json:26-30`, `scripts/tauri/prepare-arduino-sidecar.ts:123-138`, Tauri sidecar docs).

Friction:

- The hardware audit claims `tauri-plugin-serialplugin` is latest `2.0.x` and active but still leaves commit/date verification as a TODO (`docs/audits/tauri-hardware-plugin-provenance.md:14-35`). That is not adoption-grade provenance yet.
- The topology says Tauri `arduino-compile`, `arduino-upload`, and `arduino-serial` are `desktop-rust` (`client/src/lib/desktop/runtime-topology.ts:100-114`), but Phase 9 only prepared a binary. There are no typed Rust commands in `specta_builder()` or `AppManifest::commands` for Arduino yet (`src-tauri/src/lib.rs:212-220`, `src-tauri/build.rs:14-21`).

Missing:

- High severity: `ARDUINO_CLI_VERSION` is pinned to `1.4.0` (`scripts/tauri/prepare-arduino-sidecar.ts:27-32`), but GitHub currently marks `v1.4.1` as Latest and provides `1.4.1-checksums.txt` plus per-asset SHA256 hashes (Arduino CLI releases). The handoff's "guess" concern is confirmed.
- High severity: the script comments say it verifies SHA256 (`scripts/tauri/prepare-arduino-sidecar.ts:12-15`), but the implementation only downloads and extracts (`scripts/tauri/prepare-arduino-sidecar.ts:76-87`, `scripts/tauri/prepare-arduino-sidecar.ts:105-113`). That is a supply-chain hole.
- The script is not wired into CI or npm scripts before the `externalBin` build path, as noted in Phase 5 (`.github/workflows/tauri-build.yml:85-104`, `package.json:27-29`).

Decisions:

- Accept "arduino-cli sidecar" as the likely right hardware authority direction.
- Dissent-with-reason on Phase 9 readiness: no checksum verification, stale version pin, no CI invocation, and no typed Rust authority command yet.
- Needs-R2-proposal for version refresh, checksums, CI wiring, and typed `arduino_compile` / `arduino_upload` command contracts.

## Cross-Phase Concerns

- Capability scope and Rust commands are conflated. Phase 2 hardens plugin FS scope, but the active DesktopAPI file path uses custom Rust commands that do not enforce those scopes (`src-tauri/src/lib.rs:171-184`, `client/src/lib/tauri-api.ts:137-144`, Tauri capabilities docs).
- Several registries/policies are declarative but unused: runtime topology has no production callers, project-open contract has no native event bridge, updater policy is deferred, and hardware authority lacks commands (`client/src/lib/desktop/runtime-topology.ts:17-19`, `client/src/lib/desktop/project-open-contract.ts:8-10`, `docs/release/tauri-updater-policy.md:82-84`, `src-tauri/build.rs:14-21`).
- CI contains important checks in advisory mode (`.github/workflows/tauri-build.yml:113-127`). That is okay for dev preview, but it does not substantiate release-hardening or signing-hardening claims.
- Phase 5 and Phase 9 are currently inconsistent: Tauri config requires an external Arduino binary (`src-tauri/tauri.conf.json:26-30`), the prep script documents that it must run before build (`scripts/tauri/prepare-arduino-sidecar.ts:8-15`), but CI/package scripts do not run it (`.github/workflows/tauri-build.yml:85-104`, `package.json:27-29`).

## Highest-Risk Items

1. Custom `read_file` / `write_file` bypass the intended FS capability boundary (`src-tauri/src/lib.rs:171-184`, `src-tauri/build.rs:15-20`, Tauri capabilities docs). This outranks Claude's 5-item list because it is immediate arbitrary filesystem authority.
2. Arduino sidecar supply chain and packaging are incomplete: stale `1.4.0` pin, no checksum verification, no CI invocation before `externalBin` packaging (`scripts/tauri/prepare-arduino-sidecar.ts:27-32`, `scripts/tauri/prepare-arduino-sidecar.ts:76-113`, `.github/workflows/tauri-build.yml:85-104`, Arduino CLI releases).
3. Storage classifier regexes miss real persisted key families and legacy/session variants (`client/src/lib/constants/storage-keys.ts:5-23`, `client/src/lib/desktop/storage-migration.ts:55-141`, `client/src/components/views/arduino/JobHistoryPanel.tsx:97-102`).
4. Lifecycle project-open flow is not wired: native argv/deep-link events are printed but not routed to the validator (`src-tauri/src/lib.rs:448-452`, `client/src/lib/desktop/project-open-contract.ts:8-10`).
5. Runtime topology is aspirational and unconsumed while multiple Tauri workflows remain `remote-server` and Express is optional/best-effort (`client/src/lib/desktop/runtime-topology.ts:90-129`, `src-tauri/src/lib.rs:250-278`).
6. Signing and release verification gates are dry-run/nonblocking (`.github/workflows/tauri-build.yml:113-127`, `scripts/ci/verify-signed-artifacts.sh:103-107`).
7. Updater endpoint policy can mislead future implementation because `{channel}` is not a Tauri updater variable (`docs/release/tauri-updater-policy.md:21-29`, `docs/release/tauri-updater-policy.md:62-66`, Tauri updater docs).

## Adversarial Pushback

- Phase 2 probe: Does scoped `fs:allow-*` protect the actual DesktopAPI file path? No. DesktopAPI calls custom Rust commands (`client/src/lib/tauri-api.ts:137-144`), and those Rust commands directly use `tokio::fs` on arbitrary paths (`src-tauri/src/lib.rs:171-184`).
- Phase 3 probe: Do classifier regexes cover real localStorage keys? No. Central keys include underscore names and unprefixed asset keys (`client/src/lib/constants/storage-keys.ts:5-23`) that do not match the current bucket regexes (`client/src/lib/desktop/storage-migration.ts:55-141`).
- Phase 4 probe: Does a `.protopulse` open event reach the TS contract? No evidence. The only native single-instance handler action is `println!` (`src-tauri/src/lib.rs:448-452`).
- Phase 5 probe: Will CI prepare declared `externalBin` binaries? No visible step. The sidecar script says run before Tauri build (`scripts/tauri/prepare-arduino-sidecar.ts:8-15`), but workflow Tauri build has no such invocation (`.github/workflows/tauri-build.yml:85-104`).
- Phase 6 probe: Does the source-map leak check gate release artifacts? Not yet. The check scans debug bundle output (`scripts/ci/tauri-packaged-smoke.sh:38-77`) and is `continue-on-error` in CI (`.github/workflows/tauri-build.yml:118-121`).
- Phase 7 probe: Would signing verification fail the workflow after credentials land? Not while the workflow keeps `continue-on-error: true` on the verifier (`.github/workflows/tauri-build.yml:123-127`).
- Phase 8 probe: Can `{channel}` be pasted into `plugins.updater.endpoints` as a runtime variable? Tauri docs only list `{{current_version}}`, `{{target}}`, and `{{arch}}`; current doc wording risks an invalid config (`docs/release/tauri-updater-policy.md:62-66`).
- Phase 9 probe: Does the sidecar script do what its header promises? No. It claims SHA256 verification (`scripts/tauri/prepare-arduino-sidecar.ts:12-15`) but has no checksum fetch/compare implementation (`scripts/tauri/prepare-arduino-sidecar.ts:76-113`).

---
ROUND_STATUS: discovery-complete
OPEN_CRITIQUES: [P2 custom read_file/write_file bypass scoped FS policy; P2 APPLOCALDATA secret deny gap; P3 storage regex false negatives against actual key corpus; P3 runtime topology unconsumed/remote-server health undefined; P4 project-open/deep-link events not wired and single-instance lacks deep-link feature; P4 Windows path traversal normalization missing; P5 arduino sidecar prep absent from CI/build path; P5 cargo-audit/SBOM/SLSA advisory only; P6 release hardening checks debug-only/nonblocking; P7 signing verifier dry-run/nonblocking and does not assert expected artifact inventory; P8 updater endpoint/channel template ambiguity; P9 arduino-cli stale pin/no SHA256/no typed Rust command]
SIGNOFF: Codex
OWNERSHIP: Claude leads R2 synthesis after Codex R1 lands
NEXT_ROUND: R2 - diff-shaped proposals on the open critiques
---

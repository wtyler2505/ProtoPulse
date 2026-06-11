# Codex R3 Adversarial Review - Tauri Phases 2-9 Retro

## 1. Inputs Read

- Current Tyler R3 instruction in this turn - exact output shape, review-only constraint, no Context7, primary-doc citation rules.
- `COLLAB_TAURI_RETRO_HANDOFF_R2.md` - Claude R2 proposals, lane reservation, C1-C12 probe invitations.
- `COLLAB_TAURI_RETRO_RESPONSE_R1.md` - Codex R1 discovery and 12 open critiques.
- `COLLAB_TAURI_RETRO_HANDOFF_R1.md` - original R1 retro prompt and scope.
- Re-verified target files, read-only: `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json`, `client/src/lib/desktop/storage-migration.ts`, `client/src/lib/desktop/runtime-topology.ts`, `client/src/lib/desktop/project-open-contract.ts`, `client/src/lib/constants/storage-keys.ts`, `client/src/lib/tauri-api.ts`, `client/src/lib/queryClient.ts`, `client/src/lib/auth-context.tsx`, `client/src/App.tsx`, `.github/workflows/tauri-build.yml`, `package.json`, `scripts/ci/tauri-packaged-smoke.sh`, `scripts/ci/supply-chain-check.sh`, `scripts/ci/verify-signed-artifacts.sh`, `scripts/tauri/prepare-arduino-sidecar.ts`, `docs/release/tauri-signing-runbook.md`, `docs/release/tauri-updater-policy.md`, `docs/audits/tauri-hardware-plugin-provenance.md`, and the current tests named in R2.
- Local probes: `rg resolveWorkflowTarget` still finds no production consumer; current `src-tauri/target` has only `src-tauri/target/debug/bundle/deb/ProtoPulse_1.0.0_amd64.deb`; the workflow uploads both `src-tauri/target/${{ matrix.target }}/release/bundle/**` and `src-tauri/target/release/bundle/**`.
- Storage-key corpus probe: `rg "localStorage|sessionStorage|STORAGE_KEY|protopulse[:_-]"` found many literal key families outside `STORAGE_KEYS`, including `protopulse:public-api:keys`, `protopulse:design-variables`, `protopulse:macros`, `protopulse-google-workspace-token`, `protopulse-ai-api-key`, `protopulse:serial:profiles`, and `protopulse-panel-layout:*`.
- Primary docs / canonical URLs checked, no Context7:
  - Tauri capabilities / command permissions: https://v2.tauri.app/security/capabilities/
  - Tauri sidecars / `externalBin`: https://v2.tauri.app/develop/sidecar/
  - Tauri deep-linking and single-instance integration: https://v2.tauri.app/plugin/deep-linking/
  - Tauri config / file associations / `exportedType`: https://v2.tauri.app/reference/config/
  - Tauri updater: https://v2.tauri.app/plugin/updater/
  - Tauri process plugin: https://v2.tauri.app/plugin/process/
  - Tauri macOS signing/notarization: https://v2.tauri.app/distribute/sign/macos/
  - Microsoft SignTool: https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool
  - Microsoft code-signing options / Trusted Signing: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options and https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations
  - Apple notarization docs: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
  - Arduino CLI release API/checksums: https://api.github.com/repos/arduino/arduino-cli/releases/latest and https://github.com/arduino/arduino-cli/releases/download/v1.4.1/1.4.1-checksums.txt
  - Rust `std::fs::canonicalize`: https://doc.rust-lang.org/std/fs/fn.canonicalize.html

## 2. Per-Critique C1-C12

### C1 - Custom `read_file` / `write_file` bypass scoped FS policy

**Verdict:** accept-with-changes.

**Pushback (probe + finding):** I probed the canonicalize-based allow-scope design against the actual live command path at `src-tauri/src/lib.rs:171-185` and the broad allowed scopes at `src-tauri/capabilities/default.json:29-67`. The proposal improves the current arbitrary filesystem access, but mirroring the plugin FS allow list into custom Rust commands still grants a compromised webview generic read/write access to `$DESKTOP/**`, `$DOCUMENT/**`, and `$DOWNLOAD/**` without proving a dialog produced that path. Tauri capabilities docs are about permissions/scopes for command/plugin access, not a magic wrapper around custom Rust command logic; the custom command remains its own policy surface.

The write path has a real TOCTOU: `canonicalize(parent)` then `tokio::fs::write(canonical_parent.join(name))` can be raced by replacing the leaf or parent path after validation. The proposed predictable scope also misses case-insensitive secret names (`Secrets.json`) and common secrets (`.env`, `.npmrc`, `id_rsa`, `*.p12`, `*.pfx`). `read_to_string` also turns any allowed large UTF-8-ish file into a memory/latency hazard and rejects binary files with a generic UTF-8 error, so the command needs size and file-kind constraints.

**Counter-proposal:** keep `src-tauri/src/path_validation.rs`, but split the API:

- `validate_existing_read_path(app, path, intent)` canonicalizes the file itself, checks metadata size, rejects symlink leafs, and requires an intent enum such as `ProjectImport`, `CsvImport`, or `TextExport`.
- `validate_new_write_path(app, path, intent)` canonicalizes the parent, rejects symlink leafs via `symlink_metadata` if the leaf exists, writes through an opened handle with no-follow semantics where available, and enforces extension/content intent.
- Generic Desktop/Document/Download paths must be extension/intent constrained, not simply scope constrained. AppData/AppLocalData project state may be broader, but public user folders should be `.protopulse`, `.csv`, `.json`, `.svg`, or another explicit export/import format.
- Add a later session-token path for dialog-returned arbitrary destinations if true arbitrary export is needed. R2 rejected this too quickly; the security property is stronger because it binds broad user-folder authority to a recent user gesture.

**Probe-invitation results:** canonicalize follows symlinks per Rust std docs, so `$DESKTOP/sneaky-link -> /etc/passwd` should resolve out of scope if the file exists. Nonexistent-leaf writes remain raceable. Windows short-name/8.3 comparison is still unresolved by `Path::starts_with`; use canonical existing paths where possible and add Windows tests for short/long aliases. Deny list must be suffix/glob and case-insensitive. `read_file` should enforce size and intended text format.

### C2 - `$APPLOCALDATA` secret deny gap

**Verdict:** reject.

**Pushback (probe + finding):** I probed the "user-picked = user-consented" premise against the live capability and custom-command surface. It does not hold. The current grants include `$DESKTOP/**`, `$DOCUMENT/**`, and `$DOWNLOAD/**` for read/write/exists in `default.json:29-59`, and C1's custom validator would mirror those directories. Nothing in the proposed deny list proves a path came from a dialog. A compromised webview that can call the FS plugin or custom file commands could still read `$DOWNLOAD/id_rsa`, `$DESKTOP/.env`, or `$DOCUMENT/client.p12` if only app-data and `Documents/ProtoPulse` get secret denies.

**Counter-proposal:** either narrow public-folder allow scopes to extension-specific patterns or apply the same deny family to every public-folder allow scope:

- `$APPDATA/protopulse/**`, `$APPLOCALDATA/protopulse/**`, `$HOME/Documents/ProtoPulse/**`, `$DESKTOP/**`, `$DOCUMENT/**`, `$DOWNLOAD/**`.
- deny names/extensions: `secrets.json`, `credentials.json`, `.env`, `.env.*`, `.npmrc`, `.pypirc`, `id_rsa*`, `id_ed25519*`, `*.key`, `*.pem`, `*.p12`, `*.pfx`, `*.kdbx`.
- mirror this exact set in `path_validation.rs`, with a drift test that compares parsed `default.json` deny patterns to Rust deny constants.

**Probe-invitation results:** yes, R2 missed other allowed scopes. I did not find a Tauri "scope-deny-secrets" meta-capability in the capability docs; explicit path entries are the realistic config shape. The deny list should include `.env`, private-key names, and PKCS#12 containers.

### C3 - Storage classifier regex false negatives

**Verdict:** reject.

**Pushback (probe + finding):** The hybrid map fixes the small set of keys R1 named, but it is still not grounded in the actual corpus. `STORAGE_KEYS` is not the single source of truth; it only covers 13 constants at `client/src/lib/constants/storage-keys.ts:5-23`. The repo has many literal keys outside it. Examples that the proposed map/patterns still miss or misclassify:

- `protopulse:public-api:keys` at `client/src/lib/public-api.ts:199-201` is key material and should not fall through unclassified; the proposed `api[-_]key` regex does not match colon-delimited plural `:keys`.
- `protopulse:design-variables` and `protopulse:design-variables:project:*` in design variable tests/components do not match the `[-_]design[-_]...` pattern.
- `protopulse:serial:profiles`, `protopulse:serial:preferences`, `protopulse:baud:selected`, and `protopulse:baud:lastUsed` do not hit the hardware presets patterns.
- `protopulse:macros`, `protopulse:quick-jump-recents`, `protopulse:sidebar-group-collapsed`, and `protopulse:custom-keybindings` are literal UI/user data, not covered by the explicit map.
- `X-Session-Id` is mostly a header name in current code, not a proven persisted localStorage key; mapping it is harmless, but it is not evidence of corpus coverage.

Also, the proposed "every entry references `STORAGE_KEYS` directly OR is literal legacy string" test cannot be implemented from the runtime `Map` value. Once transpiled, the map only contains strings. That drift test needs an AST/source-level check or a separate exported manifest with metadata.

**Counter-proposal:** before R4 changes classification, add a generated `storage-key-inventory.json` or test fixture built from a conservative AST/rg pass over `localStorage.*`, `sessionStorage.*`, `STORAGE_KEY*`, and scoped-key helper calls. R4 should classify every current key family explicitly, including colon-delimited keys. Keep regex fallback only for parameterized keys, but prove the current inventory has zero accidental unclassified secrets. Add a "sensitive-key detector" test using `/api.?key|token|secret|oauth|bearer|credential|public-api:keys/i` that fails if such keys classify outside `session-auth`.

**Probe-invitation results:** found multiple missed key families above. Pattern order can still misclassify because colon-delimited user prefs skip explicit map and never reach user-prefs. `sessionId` should be migrated/deleted into `session-auth`; deleting without a reviewed migration risks breaking current Arduino job history behavior at `JobHistoryPanel.tsx:101`. Test plan misses colon keys, source inventory, and sensitive-key oracle coverage.

### C4 - Runtime topology unconsumed + remote-server health undefined

**Verdict:** reject.

**Pushback (probe + finding):** The proposed sample does not typecheck against the live API. `resolveWorkflowTarget` takes `(key: WorkflowKey, env: { isTauri: boolean })` and returns a `RuntimeTarget` string at `runtime-topology.ts:155-166`. R2 calls `resolveWorkflowTarget(workflowId, /*isTauri*/ true)` and then reads `decision.target`, which does not exist. It also puts a literal `false` in the server-health branch, so the two production callers are documentation-shaped no-ops. That is worse than dead code because it creates the appearance of enforcement.

**Counter-proposal:** choose one of two honest R4 shapes:

- Real wiring: add a small `desktop-api-routing.ts` / `desktop-fetch.ts` adapter that maps known API paths or workflow IDs to `resolveWorkflowTarget`, and make `apiRequest` or a representative feature call it in a behavior-affecting way. Include a real `checkRemoteServerHealth()` probe for `remote-server` workflows and surface a typed unavailable state.
- Contract-only: do not add no-op production imports. Add typed `resolutionWave` metadata to `RoutingDecision`, export `REMOTE_SERVER_WORKFLOWS`, and add a test that fails if any `desktop-rust` workflow lacks a registered Rust command or any `remote-server` workflow lacks a resolution/health plan.

**Probe-invitation results:** "wire 2 callers" is lipstick unless behavior changes or a failing contract protects it. `resolutionWave` should be a typed union such as `"r4" | "r4.5" | "r5-hardware" | "external-service"` rather than a free string. The smoke test should derive expectations from metadata, not hard-code `['ai-chat', 'rag-query']` only.

### C5 - Lifecycle events not wired + single-instance lacks `deep-link` feature

**Verdict:** reject.

**Pushback (probe + finding):** This proposal has several compile/API mismatches against the live files and Tauri docs:

- It declares a new `interface ProjectOpenRequest` in `project-open-contract.ts`, but that name already exists at `project-open-contract.ts:21-29`. Same file, same identifier, incompatible shape.
- It calls `classifyProjectOpenRequest`, but the actual exported function is `classifyProjectOpenEvent` at `project-open-contract.ts:108-130`.
- It emits `trigger: "single-instance"`, but the existing source union is `"cold-start" | "warm-start" | "deep-link" | "menu" | "drop"` at `project-open-contract.ts:13-19`.
- It listens to raw `"deep-link://new-url"`. Tauri's deep-link docs show the plugin APIs (`getCurrent`, `onOpenUrl`, and Rust `DeepLinkExt` patterns), not a stable public raw event string. A raw internal event-name dependency is brittle.
- It does not handle cold-start argv at all. The current Rust handler only covers additional instances at `src-tauri/src/lib.rs:448-452`; initial launch with a file association can arrive before the frontend listener exists.
- It adds `exportedType: "com.protopulse.project"`, but the Tauri config reference defines `exportedType` as a structured exported file association object, not a bare string. The R2 shape is likely config-invalid.
- The proposal's manual test uses `protopulse://open?path=foo.protopulse`, while the actual validator only accepts `project=` at `project-open-contract.ts:57`.

**Counter-proposal:** R4 should rework the contract before wiring:

- Rename the native event payload to `NativeProjectOpenRequest` and translate it into the existing `ProjectOpenRequest` shape.
- Use official deep-link APIs: in JS, use `@tauri-apps/plugin-deep-link` `getCurrent()` for cold/current URLs and `onOpenUrl()` for future URLs, or in Rust use `tauri_plugin_deep_link::DeepLinkExt` documented callbacks. Do not depend on `"deep-link://new-url"`.
- Add a Rust startup capture path for `std::env::args_os()` or plugin current URL, store pending requests in managed state, and let the frontend request/replay pending opens after mount.
- Add `tauri-plugin-single-instance = { version = "2", features = ["deep-link"] }`, but pair it with tests that prove warm-start file and URL paths reach the listener.
- Fix `exportedType` to the config-doc object form, or drop it until the correct UTI shape is validated.

**Probe-invitation results:** `argv.slice(1)` is an assumption and still needs Windows/macOS launch tests. The raw deep-link event string is not acceptable as a public API dependency. The UTI field is malformed as proposed. Absence of Rust-side/pending validation loses events before the frontend listener is installed, which is the actual TOCTOU here.

### C6 - Windows path traversal normalization missing

**Verdict:** accept-with-changes.

**Pushback (probe + finding):** The regex direction is useful, but it still treats path validation as string filtering. It misses or mishandles Windows special forms: `\\?\C:\...`, `\\?\UNC\server\share\...`, `\\.\COM1`, `\??\C:\...`, alternate data streams such as `file.protopulse:stream`, and control characters including NUL. It also only decodes once; double-encoded traversal can survive if another layer decodes later. Finally, the existing extension regex at `project-open-contract.ts:54` only permits slash children under `.protopulse`, not backslash children.

**Counter-proposal:** keep a TS prefilter, but make it explicit defense-in-depth:

- Parse deep links with `new URL()` and `searchParams.get("project")` instead of regex.
- Decode at most twice, rejecting if a second decode changes into a traversal/control/scheme pattern.
- Normalize separators before checks, then reject `..` segments, control chars, `\\?\`, `\\.\`, `\??\`, UNC, and ADS colon suffixes on Windows path inputs.
- Keep Rust C1 validation as the final authority before any filesystem read/write; the TS validator decides UX, not security.

**Probe-invitation results:** missed Windows encodings include long-path, NT object, device namespace, UNC long-path, and ADS. `WINDOWS_UNC_RE` should block IPv6 SMB paths implicitly by blocking all UNC; if UNC support is ever allowed, it needs a separate threat model. Normalize/decode before extension check so encoded traversal cannot hide behind a valid suffix. Reject controls.

### C7 - Arduino sidecar prep absent from CI/build path

**Verdict:** accept-with-changes.

**Pushback (probe + finding):** Wiring prep before Tauri build is correct, but R2's CI snippet does not pass the matrix target to the prep script. The workflow builds with `args: --target ${{ matrix.target }}` at `.github/workflows/tauri-build.yml:103-104`, while the prep script falls back to `rustc --print host-tuple` when `--target` is omitted at `prepare-arduino-sidecar.ts:66-73`. That can produce the host sidecar instead of `x86_64-apple-darwin` or `aarch64-apple-darwin`.

`package.json` also has no `tauri:build:debug` today (`package.json:27-29`), so the proposed script replacement is not merely additive. It changes local packaging to always run frontend build and download Arduino CLI. That may be acceptable for packaging, but it needs an explicit opt-out for dev-only/no-hardware runs and a clear `.gitignore` story for `src-tauri/binaries/arduino-cli-*` (currently not ignored except broad `src-tauri/target/`).

**Counter-proposal:** in CI:

```yaml
- name: Prepare Arduino CLI sidecar
  run: npm run tauri:prepare-sidecars -- --target ${{ matrix.target }}
```

In `package.json`, add `tauri:prepare-sidecars`, `tauri:build`, and `tauri:build:debug`, but also document `SKIP_ARDUINO_SIDECAR=1` as dev-only and make packaging fail if skip is used with `bundle.externalBin`. Add `src-tauri/binaries/arduino-cli-*` to `.gitignore` unless the repo intentionally commits fetched binaries.

**Probe-invitation results:** local builds can be surprised by network downloads; add explicit script names and docs. Cross-build target detection is wrong unless `--target` is forwarded. The `--target` flag is fine but must be required in CI. Prep can succeed and Tauri can still fail if output goes to `src-tauri/binaries/arduino-cli-<host>` while Tauri expects `arduino-cli-<matrix.target>`.

### C8 - cargo-audit / SBOM / SLSA advisory only

**Verdict:** accept-with-changes.

**Pushback (probe + finding):** Making `cargo-audit` blocking is good, but the proposed script regresses npm audit scope. The current script intentionally uses `npm audit --omit=dev --audit-level=high` at `scripts/ci/supply-chain-check.sh:55-61`; R2 switches to `npm audit --audit-level=high`, which will block on dev-only toolchain advisories that do not ship in the desktop app. That may be a separate dev-surface gate, but it should not silently become the release gate.

Deferring all SBOM/SLSA work is too broad. The workflow already grants `id-token: write` at `.github/workflows/tauri-build.yml:18-20` specifically for attestations. At minimum, R4 can add a non-signing SBOM generation artifact or a provenance placeholder job that actually uploads a file, while deferring key-custody decisions.

**Counter-proposal:** keep `cargo-audit` required, add an advisory ignore policy file if needed, retain `npm audit --omit=dev --audit-level=high` for the shipped surface, and optionally add a separate advisory dev audit that does not block release. Land one minimal machine artifact in R4: either CycloneDX JSON for npm + Cargo locks or GitHub artifact attestation if the action fits the current release flow. Defer only the format/key-custody expansion.

**Probe-invitation results:** `cargo audit --deny warnings` may be too strict without an ignore/expiry policy; use `--deny warnings` only with documented temporary ignores. npm audit should keep production omission unless the team wants a separate dev gate. Missing checks include `cargo-deny` for license/bans, `cargo-vet` for review provenance, and OSV scanning across ecosystems.

### C9 - Release hardening checks debug-only / nonblocking

**Verdict:** accept-with-changes.

**Pushback (probe + finding):** R2 says it avoids two builds, but the workflow already runs `tauri-action` release build at `.github/workflows/tauri-build.yml:88-112`, then the proposed smoke script would run `npm run tauri:build` again. That is still a second release build, and with C7's proposed `tauri:build` it also reruns frontend build and sidecar prep. If the goal is to gate the produced release artifact, the smoke should inspect the artifacts created by `tauri-action` or be the build path, not both.

The bundle path is also too naive for matrix target builds. The workflow uploads both `src-tauri/target/${{ matrix.target }}/release/bundle/**` and `src-tauri/target/release/bundle/**` at lines 133-136 because target-specific outputs are possible. The proposed script hardcodes `src-tauri/target/release/bundle`.

The devtools heuristic is fragile: searching for `"toggle-devtools"` can false-positive on source strings if resources are bundled, and false-negative if symbols are stripped or renamed. Source-map scanning should check all `*.map`, not just `.js.map` and `.css.map`, and AppImage/dmg contents may need unpack/staple-specific inspection.

**Counter-proposal:** make the smoke script accept `BUNDLE_DIR` or discover both `target/release/bundle` and `target/*/release/bundle`. In CI, either run the script after tauri-action in verify-only mode against existing artifacts, or replace tauri-action's build with a script-owned build that then uploads artifacts. Add explicit checks for `Cargo.toml` release profile values, no `tauri` `devtools` feature in `Cargo.toml`, no `*.map` in bundle resources, and no debug info where platform tools can inspect it.

**Probe-invitation results:** `strings` is a smoke heuristic only. R2 does not validate release profile application. Bundle-dir path varies with `--target`. Missing hardening checks include DWARF/debug info presence, unstripped symbols on Linux, and resource unpack scans for AppImage/dmg where feasible.

### C10 - Signing verifier dry-run / nonblocking / no inventory check

**Verdict:** reject.

**Pushback (probe + finding):** The inventory idea is right, but the proposed implementation is not a reliable verifier:

- It hardcodes `bundle_dir="src-tauri/target/release/bundle"`, while the workflow target builds can land under `src-tauri/target/${{ matrix.target }}/release/bundle/**`.
- The Windows verification `find "$bundle_dir" -name '*.exe' -o -name '*.msi' -type f` has precedence trouble; `-type f` applies only to the MSI branch unless grouped.
- `signtool verify /pa` does not enforce trusted timestamp semantics. Microsoft SignTool docs expose timestamp-related verify flags; the activation verifier should assert a timestamp when public distribution depends on long-term validity.
- macOS `codesign` plus `spctl` is not the same as a direct notarization-ticket check for every artifact. R2 drops the existing `xcrun stapler validate` path from the current script at `verify-signed-artifacts.sh:93-98`, then relies on Gatekeeper assessment. Keep staple validation for `.app` and `.dmg` where notarization is required.
- Dry-run inventory still exits 0 under workflow `continue-on-error: true`, so CI will not actually enforce missing artifacts in the default lane.

**Counter-proposal:** make `verify-signed-artifacts.sh` accept `--bundle-dir` and `--target`, discover both target-specific and default bundle dirs, group all `find` predicates, and keep dry-run nonblocking only for signature checks. Add an explicit separate `artifact-inventory` step with `continue-on-error: false` even in dev preview. Activation mode should use `signtool verify /pa /tw` or an equivalent timestamp-enforcing policy, plus `codesign --verify --deep --strict`, `spctl --assess`, and `xcrun stapler validate` for notarized macOS artifacts.

**Probe-invitation results:** yes, inventory globs are wrong/incomplete for target-specific output. Windows timestamp validation should be enforced once signing is active. macOS notarization should not rely on `spctl` alone; staple validation is the clearer check. Linux flow is missing package signing policy for `.deb` repo metadata, AppImage signing, and future rpm/flatpak/snap if targets expand.

### C11 - Updater `{channel}` template ambiguity

**Verdict:** accept-with-changes.

**Pushback (probe + finding):** Removing `{channel}` is correct, and Tauri updater docs confirm only the documented variables interpolate. The proposed replacement still has API and policy errors:

- The docs example for programmatic endpoints uses URL parsing types; R2's `.endpoints(vec![match channel { ... }.to_string()])` is likely not the right Rust type shape for the builder.
- The checklist says `tauri-plugin-process` is required for `tauri_plugin_process::relaunch()`, but the actual policy doc currently names `tauri-plugin-process::relaunch()` at `docs/release/tauri-updater-policy.md:53` without specifying JS vs Rust. Tauri process docs are JS-plugin oriented; updater docs also show Rust-side restart patterns. The activation checklist must distinguish "frontend calls process plugin relaunch" from "Rust calls app restart".
- Rollback language is too absolute. Tauri updater exposes version comparison behavior; a downgrade may be policy-disallowed by default, but the doc should not claim the platform can never install a lower version if the manifest/comparator path is intentionally configured.
- `createUpdaterArtifacts: true` belongs in Tauri config/build configuration, not as a vague "CI workflow updates" item.

**Counter-proposal:** replace endpoint docs with hardcoded per-channel endpoint strings and an explicit compile-time or persisted-channel selection design. Use `url::Url::parse(...)` in Rust examples if using builder endpoints. Add checklist items: Cargo plugin, npm plugin if JS is used, plugin init, capabilities (`updater` and `process` if frontend APIs are called), public key in `tauri.conf.json`, `createUpdaterArtifacts`, manifest signing, endpoint hosting, downgrade policy and tests.

**Probe-invitation results:** runtime endpoint selection can work at app init, but channel must come from a concrete source available before updater setup; user preference switching after init needs relaunch or a dedicated updater manager. Process relaunch capability is required for frontend plugin use, not necessarily for a Rust-only restart path. Missing checklist items are capabilities, npm package, plugin init, `Url` parsing, and `createUpdaterArtifacts` location. Rollback should be written as ProtoPulse policy plus Tauri comparator behavior, not a blanket platform impossibility.

### C12 - arduino-cli stale pin / no SHA256 / no typed Rust command

**Verdict:** accept-with-changes.

**Pushback (probe + finding):** The v1.4.1 bump and baked hashes match the GitHub release/checksum probe for the five current matrix targets. But the proposed temp-file strategy is still weak: current script uses predictable `/tmp/${spec.asset}` and `/tmp/arduino-cli-${version}-${target}` at `prepare-arduino-sidecar.ts:109-110`, and R2 only adds hash verification before extraction. A same-user local attacker or concurrent job can swap predictable temp files between download, hash, and extraction.

The target story is also inconsistent. The hardware audit says Arduino CLI platforms include Linux armv7 at `docs/audits/tauri-hardware-plugin-provenance.md:72`, and the v1.4.1 release includes Linux 32bit, ARMv7, ARMv6, and Windows 32bit assets. R2 maps only the current CI matrix. That is okay only if the audit and script say "current supported packaging targets", not "all Arduino CLI platforms".

The typed-command deferral leaves a contradiction: `runtime-topology.ts:100-114` already declares Arduino compile/upload/serial as `desktop-rust`, but `specta_builder()` and `AppManifest::commands` still have no Arduino commands at `src-tauri/src/lib.rs:212-220` and `src-tauri/build.rs:14-21`.

**Counter-proposal:** use `mkdtempSync(path.join(tmpdir(), "protopulse-arduino-"))` with `0700` perms, unique archive path, and cleanup. Verify SHA256 immediately before extraction, extract only into that private dir, and verify the extracted executable's existence/permissions. Keep baked hashes as the trust root, but add a CI check that fetches `1.4.1-checksums.txt` and confirms the baked hashes still match the release record. For typed commands, either land the minimal compile/upload command contracts in R4 or change topology to `compat-local` / `pending-desktop-rust` with `resolutionWave` so the registry no longer claims implemented Rust authority.

**Probe-invitation results:** yes, predictable `/tmp` gives a TOCTOU weakness. Baked hashes are preferable to install-time fetched checksums for reproducibility, but the root of trust is code review plus GitHub release integrity at version-bump time. Missing target triples include at least Linux ARMv7 and Linux 32bit assets; Windows ARM64 was not present in the v1.4.1 release API output I fetched. The weak link is leaving the topology claiming desktop Rust commands that do not exist.

## 3. Cross-Cutting Attacks

**D1 vs C2 conflict:** D1 says custom validation should mirror broad FS capability scopes, while C2 says public-folder secret denies can be skipped because dialog selection implies consent. Those cannot both be true. If custom commands are callable with arbitrary strings, Desktop/Document/Download must not be treated as consented just because they are in the scope list.

**D2 overclaims `STORAGE_KEYS`:** The explicit-key-first idea is good, but R2 treats `STORAGE_KEYS` as the single source of truth. The actual repo has many literal and helper-generated keys outside that file. D2 needs an inventory generator, not just a map.

**D3 extraction is fine, but API needs intent types:** I do not object to `path_validation.rs`; extraction is justified by the security surface. The extracted helper must not be a generic "allowed dirs" function, though. It needs read/write/intent variants or it will become the next broad bypass.

**R5 deferrals:**

- SBOM/SLSA: full policy can defer, but R4 should land at least one real machine artifact or attestation step because CI already grants `id-token: write`.
- Server health: if C4 claims topology becomes executable in R4, a minimal real health probe cannot be fully deferred. Otherwise keep C4 contract-only and do not wire no-op callers.
- Typed Arduino commands: defer is justified only if R4 also changes topology away from "desktop-rust implemented". Current registry makes the deferral misleading.
- Plugin-FS migration: deferral is acceptable if C1 hardens custom commands with intent constraints. If C1 only mirrors broad scopes, plugin-fs or dialog-token gating should come back into R4.
- Signing activation: cert-dependent signing can defer, but artifact inventory should be blocking now and activation verifier should be correct now.
- Updater domain provisioning: infrastructure can defer; the activation doc must still use valid config/API examples.

## 4. Missing Critiques

Claude's R2 covers all 12 R1 `OPEN_CRITIQUES`, but it skips one R1 Phase 9 friction item that should not disappear: `docs/audits/tauri-hardware-plugin-provenance.md:14-35` still claims `tauri-plugin-serialplugin` is "active" while leaving last-commit/version verification as TODO. Since C12 already edits that audit doc, R4 should either update the serialplugin provenance with concrete commit/date/version evidence or explicitly add a follow-up critique for plugin adoption readiness.

R2 also partially covers the file-association `exportedType` issue under C5, but the proposed config shape is wrong. That remains open, not resolved.

## 5. Test Plan Critique Per C-Item

- **C1 coverage hole:** tests do not cover symlink leaf replacement, uppercase secret filenames, `.env`/PKCS#12 names, large-file read rejection, or Windows short/long path aliases. **Counter-test:** Rust unit/integration tests with temp dirs, symlinks, case variants, max-size fixtures, and Windows-only alias/path-prefix cases.
- **C2 coverage hole:** snapshot only checks three app-ish scopes, not Desktop/Document/Download. **Counter-test:** parse `default.json` and assert every write/read allow scope has the secret-deny family or an explicit extension-only narrowing.
- **C3 coverage hole:** tests only add seven handpicked examples. **Counter-test:** generated inventory fixture from current codebase plus a sensitive-key oracle; fail if any current sensitive key is unclassified or non-`session-auth`.
- **C4 coverage hole:** proposed caller test only verifies a no-op does not throw. **Counter-test:** grep/AST test for at least one real production import plus behavior test that a missing remote server produces a typed unavailable state, or contract-only tests that no production no-op import exists.
- **C5 coverage hole:** mocked `listen` tests would pass while the Rust deep-link API/event name is wrong. **Counter-test:** TypeScript compile test for the listener, Rust compile check for deep-link callback API, and manual/automated smoke for cold-start argv, warm-start second instance, and deep-link current URL replay.
- **C6 coverage hole:** tests do not include long-path, device namespace, NT object, ADS, control chars, double-encoding, or backslash folder children under `.protopulse`. **Counter-test:** add each as invalid, plus one valid Windows normal path.
- **C7 coverage hole:** sidecar existence test does not prove the filename matches the matrix target. **Counter-test:** run prep with `--target x86_64-apple-darwin` on a non-matching host and assert `arduino-cli-x86_64-apple-darwin` exists.
- **C8 coverage hole:** "known-bad crate fixture; revert after" is not durable. **Counter-test:** unit-test script behavior by stubbing `cargo-audit`/`npm` on PATH, plus workflow lint that supply-chain step lacks `continue-on-error`.
- **C9 coverage hole:** fixture branch manual sourcemap injection is not a real automated test. **Counter-test:** create a temp fake bundle dir with `.map`, debug symbol fixture, and expected artifacts; run script in verify-only mode.
- **C10 coverage hole:** dry-run removed-artifact test is neutralized by workflow `continue-on-error`. **Counter-test:** separate blocking inventory step test, target-specific bundle-dir fixture, grouped `find` predicate test, timestamp-required Windows verifier command assertion, and macOS staple-validation assertion.
- **C11 coverage hole:** docs-lint for braces does not compile the Rust endpoint example or validate capabilities. **Counter-test:** markdown code snippet compile/doctest where feasible, config JSON validation for updater keys, and grep/lint for forbidden `{channel}` single braces.
- **C12 coverage hole:** tamper test by editing the expected hash is manual and does not test TOCTOU/temp isolation. **Counter-test:** unit-test `verifySha256`, use a temp private download dir, assert baked hashes match fetched checksum file for the pinned version, and test missing target mapping against the CI matrix.

## 6. Convergence Block

---
ROUND_STATUS: needs-revision
OPEN_CRITIQUES: [C1 must split read/write/intent validation and address public-folder scope plus TOCTOU; C2 must deny or narrow secrets across all broad allowed scopes; C3 must use a real storage-key inventory and classify colon-delimited/sensitive keys; C4 no-op wiring is compile-wrong and must become real wiring or contract-only; C5 deep-link/event/config proposal uses wrong APIs/names and misses cold-start replay; C6 must cover Windows long/device/UNC/ADS/control/double-encoded paths; C7 must pass matrix target to sidecar prep and handle local-download/gitignore policy; C8 must keep shipped-surface npm audit scope and land at least minimal SBOM/provenance artifact; C9 must avoid double-build ambiguity and discover target-specific bundles; C10 verifier must handle target bundle dirs, timestamp checks, stapler validation, and blocking inventory; C11 updater docs need valid builder types, capabilities, and downgrade policy wording; C12 must use private temp dirs, clarify target matrix, and resolve Arduino topology/typed-command contradiction; serialplugin provenance TODO remains unresolved]
SIGNOFF: Codex
OWNERSHIP: Codex if R3.5 revision needed
NEXT_ROUND: R3.5 revision
---

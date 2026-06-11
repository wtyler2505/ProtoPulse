# Codex R4 Verification - Tauri Phases 2-9 Retro R3.5

## 1. Inputs Read

- `COLLAB_TAURI_RETRO_HANDOFF_R3.5.md` - Claude's R3.5 revision, lane reservation, C1-C13 proposals, D1/C2 resolution, and R4 verification demands.
- `COLLAB_TAURI_RETRO_RESPONSE_R2.md` - Codex R3 critique and open critiques C1-C12 plus serialplugin missing critique.
- Live code re-verification, read-only:
  - `src-tauri/src/lib.rs:171-185`, `src-tauri/src/lib.rs:212-220`, `src-tauri/src/lib.rs:441-457`
  - `src-tauri/build.rs:11-24`, `src-tauri/Cargo.toml:13-24`, `src-tauri/tauri.conf.json:26-57`, `src-tauri/capabilities/default.json:29-77`
  - `client/src/lib/desktop/project-open-contract.ts:14-130`, `client/src/lib/desktop/runtime-topology.ts:22-179`, `client/src/lib/desktop/storage-migration.ts:15-170`, `client/src/lib/bindings.ts:9-16`, `client/src/lib/csv.ts:32-45`, `client/src/App.tsx:1-154`
  - `package.json:27-29`, `.github/workflows/tauri-build.yml:88-127`, `scripts/tauri/prepare-arduino-sidecar.ts:31-113`, `scripts/ci/supply-chain-check.sh:40-76`, `scripts/ci/tauri-packaged-smoke.sh:38-77`, `scripts/ci/verify-signed-artifacts.sh:38-99`
  - `docs/release/tauri-updater-policy.md:19-84`, `docs/audits/tauri-hardware-plugin-provenance.md:10-35`
- Local probes:
  - `package.json` has no `@tauri-apps/plugin-deep-link` dependency.
  - `src-tauri/src/**` has no `mod native_project_open` declaration today.
  - `App.tsx` has no `activeProjectPath`, `handleProjectOpenOutcome`, or `installProjectOpenListener` wiring.
  - `downloadBlob()` from `client/src/lib/csv.ts` is called for non-CSV exports including `.md`, `.cir`, `.kicad_sch`, Gerber/drill filenames, and other text-like formats.
  - `arduino-cli` v1.4.1 checksums confirm R3.5's Linux ARMv7 and Linux 32-bit hashes, and also show Linux ARMv6 plus Windows 32-bit assets.
  - GitHub/crates probe for `s00d/tauri-plugin-serialplugin`: latest GitHub release is `2.16.0` published `2025-07-01`, default-branch `Cargo.toml` and crates.io report `2.22.0`, last HEAD commit is `a64c3d24...` at `2026-03-22T06:51:13Z`, license is `Apache-2.0 OR MIT`.
- Docs re-pulled, no Context7:
  - Tauri capabilities: https://v2.tauri.app/security/capabilities/ - capabilities do not protect against incorrect Rust command scope checks; registered custom commands are allowed by default unless app manifest narrows them.
  - Tauri deep-linking: https://v2.tauri.app/plugin/deep-linking/ - `getCurrent`, `onOpenUrl`, Rust `get_current`, `on_open_url`, and single-instance `deep-link` feature ordering.
  - Tauri config: https://v2.tauri.app/reference/config/ and schema raw - `fileAssociations[].exportedType` is `ExportedFileAssociation` with `identifier` and optional `conformsTo`.
  - Tauri sidecars: https://v2.tauri.app/develop/sidecar/ - target-triple naming and `shell().sidecar()` expectations.
  - Tauri updater: https://v2.tauri.app/plugin/updater/ - `createUpdaterArtifacts`, runtime `app.updater_builder().endpoints(...)`, `version_comparator`, and updater permissions.
  - Microsoft SignTool: https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool - `/tw` warns if a signature lacks a timestamp.
  - Rust `std::fs::canonicalize`: https://doc.rust-lang.org/std/fs/fn.canonicalize.html - symlink resolution, existing-path requirement, and Windows extended-length behavior.
  - Arduino CLI GitHub release/checksums: https://github.com/arduino/arduino-cli/releases/download/v1.4.1/1.4.1-checksums.txt

## 2. Per-Critique Verification C1-C13

### C1 - Custom file commands path validation

**Probe:** Compared R3.5's validator and command snippets against live `read_file` / `write_file` at `src-tauri/src/lib.rs:171-185`, current `DesktopAPI.writeFile` call sites at `client/src/lib/tauri-api.ts:137-144`, and generic `downloadBlob()` at `client/src/lib/csv.ts:32-45`.

**Finding:** The split read/write/intent direction is correct, but the R3.5 command body defaults all writes to `WriteIntent::CsvExport`. That is not compatible with the live desktop bridge: `csv.ts` is generic and is used for `.md`, `.cir`, `.kicad_sch`, Gerber/drill, JSON-ish, and other exports, not just CSV. R4 would close the broad bypass by breaking legitimate exports. The snippet also has a Windows compile issue: `use std::os::unix::fs::OpenOptionsExt` is shown unconditionally, so the Windows matrix would fail unless it is `#[cfg(unix)]`-guarded. Finally, `validate_existing_read_path()` calls `reject_symlink_leaf(&canonical)` after canonicalization, which no longer points at the original symlink leaf; the symlink-leaf rejection is mostly ineffective for in-scope symlink targets.

**Verdict:** needs-further-revision.

### C2 - Secret deny family across allowed scopes

**Probe:** Checked R3.5's top-level claim at `COLLAB_TAURI_RETRO_HANDOFF_R3.5.md:83-89` against its concrete capability JSON proposal in §C2 and live broad scopes at `src-tauri/capabilities/default.json:29-77`.

**Finding:** The contradiction is not closed. R3.5 says the deny family applies to all allowed scopes, then explicitly omits `$DESKTOP`, `$DOCUMENT`, and `$DOWNLOAD` denies because extension narrowing is "technically redundant." It is not redundant: public scopes still allow `.json` and `.txt`, so `$DESKTOP/project/secrets.json`, `$DOWNLOAD/credentials.json`, or `$DOCUMENT/id_rsa.txt` remain within the proposed allow family unless public-folder deny patterns are also added. This is the exact R3 attack in a narrower costume.

**Verdict:** needs-further-revision.

### C3 - Storage classifier grounded in corpus

**Probe:** Re-ran key-family search and compared the R3.5 generator shape to `client/src/lib/desktop/storage-migration.ts:15-170`.

**Finding:** Inventory-first is the right architecture, but R3.5 is not yet a full rewrite. `gatherKeys()` is omitted, the "remaining 100+ keys" are omitted, and the handoff itself admits current key families are not curated: `protopulse-incident-bundles`, `protopulse-deployment-profiles`, `protopulse-flex-zones`, `protopulse-dfm-checker`, `protopulse-healing-config`, and `protopulse-healing-history`. Those are live keys. The proposed drift test also appears to regenerate the committed JSON in-place, which is risky inside tests; it should generate to a temp path and compare. The sensitive oracle still needs `private[-_:]?key`, `jwt`, `access[-_:]?key`, and similar variants.

**Verdict:** needs-further-revision.

### C4 - Runtime topology contract-only rewrite

**Probe:** Checked R3.5's contract-only shape against live topology at `client/src/lib/desktop/runtime-topology.ts:64-145` and registered commands at `src-tauri/src/lib.rs:212-220`.

**Finding:** Deleting fake production wiring closes the R3 compile-wrong `decision.target` attack, and `resolutionWave` is the right direction. But the contract test as proposed exposes another live contradiction: `user-settings`, `kanban-state`, and `design-variables` remain `desktop-rust` in the live topology, while `Cargo.toml` has no store plugin and the registered command set only has dialogs, `read_file`, `write_file`, `get_version`, and `get_platform`. R3.5 only moves Arduino workflows to `compat-local`; it does not resolve these storage workflows. A strict "every desktop-rust workflow has registered Rust command" test either fails or forces fake hand mappings.

**Verdict:** needs-further-revision.

### C5 - Lifecycle native-to-frontend wiring

**Probe:** Verified names/types against `project-open-contract.ts`, `bindings.ts`, `Cargo.toml`, `lib.rs`, `App.tsx`, package dependencies, and Tauri deep-link docs.

**Finding:** R3.5 fixed the obvious R2 API names (`ProjectOpenRequest`, `classifyProjectOpenEvent`, `project=`), and the `exportedType` object matches the schema. But the rewrite still does not typecheck or preserve cold-start delivery:

- `@tauri-apps/plugin-deep-link` is imported in TS, but `package.json` has no dependency for it.
- `App.tsx` has no `useEffect` import, no `activeProjectPath`, and no `handleProjectOpenOutcome`; the proposed mount snippet cannot compile against the live app.
- The new Rust module needs `mod native_project_open;` and `use tauri::Emitter;`; neither is stated in the R3.5 lib.rs patch.
- `enqueue_or_emit()` treats `app.get_webview_window("main")` as proof the frontend is mounted. In this app the main window exists before React listeners are installed (`tauri.conf.json:19` and `lib.rs:471-473`), so cold-start setup can emit and drop the event before the JS listener exists. The R3 cold-start replay attack is still open; the state machine needs an explicit frontend-ready/registered flag or queue-until-drained policy.
- Tauri docs say `getCurrent` / `get_current` detects start URLs; R3.5 uses Rust `on_open_url` plus raw `std::env::args()` capture but does not reconcile duplicate current URLs across single-instance, deep-link, and argv paths.

**Verdict:** needs-further-revision.

### C6 - Windows path traversal normalization

**Probe:** Tested the proposed regex logic mentally against Windows ADS and device forms; checked live validator at `project-open-contract.ts:54-58`.

**Finding:** Most R3 path families were added, but ADS is still not closed. The proposed `driveLetterRoot` guard disables the ADS check for any normal absolute Windows path, so `C:\safe\board.protopulse:evil` passes the ADS branch because the path starts with `C:\`. The check should allow only the drive colon at index 1 and reject any later colon in the leaf/path. R3 specifically called out ADS; this remains a blocker.

**Verdict:** needs-further-revision.

### C7 - Sidecar prep wired with target

**Probe:** Compared R3.5's package script claims to live `package.json:27-29`, workflow target passing at `.github/workflows/tauri-build.yml:88-104`, and sidecar target parsing at `scripts/tauri/prepare-arduino-sidecar.ts:66-73`.

**Finding:** Passing `--target ${{ matrix.target }}` is the right fix. But R3.5 says the scripts are additive because current `package.json` lacks `tauri:build`; live `package.json` already has `"tauri:build": "tauri build"`. R4 would replace an existing script, not add one. That is manageable, but the revision must say so honestly and preserve the tauri-action lane, which currently calls `npm run tauri --` rather than `tauri:build`.

**Verdict:** needs-further-revision.

### C8 - Supply-chain audit and SBOM

**Probe:** Compared R3.5 to live `supply-chain-check.sh:40-76` and workflow `continue-on-error` baseline.

**Finding:** It preserves `npm audit --omit=dev`, which closes one R3 delta. The SBOM part is still too soft: both SBOM generators are allowed to fail with warnings, and `upload-artifact` has no explicit `if-no-files-found: error`. That means R4 can still finish without the minimal machine artifact R3 required. If "minimal SBOM lands in R4" is the convergence claim, absence of SBOM output must fail at least the SBOM upload/generation step.

**Verdict:** needs-further-revision.

### C9 - Release hardening checks

**Probe:** Compared R3.5 verify-only script shape to tauri-action build/upload paths at `.github/workflows/tauri-build.yml:88-136`.

**Finding:** R3.5 closes the R3 double-build attack by making verify-only the default, and bundle-dir discovery addresses target-specific paths. Remaining issue is lower severity: blindly scanning every `src-tauri/target/**/release/bundle` can validate stale cached bundles for a different target/previous run. The CI step should pass the current matrix target or artifact path explicitly, but this is an R5/R4-land hardening detail, not a reason to reject C9.

**Verdict:** ratified.

### C10 - Signing verifier full rewrite

**Probe:** Checked R3.5 shell logic against live bundle targets and Microsoft SignTool docs.

**Finding:** Target-specific bundle discovery, grouped `find`, and restored stapler checks address several R3 attacks. Two blockers remain:

- Inventory for macOS `.app` uses `assert_glob_present ... "$bundle_dir/macos/*.app"` with `-type f`. `.app` bundles are directories, so a correct macOS bundle fails inventory before signing.
- `/tw` is documented by Microsoft as generating a warning when the signature is not timestamped, not as a strict failure. Activation mode still needs a fail-hard timestamp check, for example parsing SignTool output or verifying timestamp metadata with a stricter policy.

**Verdict:** needs-further-revision.

### C11 - Updater `{channel}` and activation docs

**Probe:** Checked R3.5 endpoint examples against Tauri updater docs and live updater policy doc.

**Finding:** The rollback wording and `createUpdaterArtifacts` placement are fixed. The endpoint example still has a likely API-shape error: Tauri docs show runtime endpoints via `app.updater_builder().endpoints(vec![url])?`, while plugin `Builder::new()` examples are shown for plugin registration, public key, and custom target. R3.5 uses `.plugin(tauri_plugin_updater::Builder::new().endpoints(...).build())`, which is not the documented runtime endpoint API and may not compile. The checklist also names `tauri-apps/plugin-updater` and `tauri-apps/plugin-process`; npm package names are `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process`.

**Verdict:** needs-further-revision.

### C12 - Arduino sidecar temp dir and topology fix

**Probe:** Verified R3.5 hashes against Arduino CLI v1.4.1 checksums and compared claimed edits to the lane reservation.

**Finding:** `mkdtempSync` plus pinned SHA256 closes the predictable `/tmp` issue, and changing Arduino topology to `compat-local` closes the immediate desktop-rust contradiction. Two revisions are still needed: R3.5 adds `scripts/dev/verify-arduino-checksums.ts` but the lane reservation did not claim that file, and the target story remains ambiguous because v1.4.1 includes Linux ARMv6 and Windows 32-bit assets while R3.5 adds only Linux ARMv7 and Linux 32-bit beyond the existing matrix. If the policy is "current packaging targets plus Linux ARMv7/32-bit only," the audit doc should say that explicitly.

**Verdict:** needs-further-revision.

### C13 - serialplugin provenance

**Probe:** Fetched GitHub repo/release data and raw `Cargo.toml` from `s00d/tauri-plugin-serialplugin`, plus crates.io metadata.

**Finding:** The shape is useful but incomplete and some expected values are wrong. GitHub `releases/latest` returns `2.16.0` from `2025-07-01`, while the default branch and crates.io report `2.22.0` from `2026-03-22`. A provenance audit that only uses GitHub releases will under-report the current crate. The license is not just MIT; current repo/crate metadata is `Apache-2.0 OR MIT`. The README also says the JS dependency is `tauri-plugin-serialplugin-api`, which should be captured because adoption is a Rust + JS surface. C13 needs to cross-check GitHub release, crates.io latest, default-branch `Cargo.toml`, JS package name/version, license files, and `cargo audit` probe before calling the adoption record adequate.

**Verdict:** needs-further-revision.

## 3. D1/C2 Contradiction Resolution Check

The resolution is not internally consistent yet.

**Probe:** Tested the policy claim "narrow scopes by extension + apply deny family" against the concrete C2 JSON proposal.

**Finding:** Extension narrowing is a real improvement, but the deny family is not applied universally. Because `.json` and `.txt` remain allowed in public folders, sensitive names can still match legitimate extensions. `secrets.json` is the simplest example. Dialog consent is correctly demoted to UX, but the actual security layers are incomplete until public-folder allow scopes either get the same deny family or are split into narrower command-specific capabilities that cannot read/write arbitrary `.json` / `.txt` names.

Required R3.6 fix: make the public-folder denies explicit too, or remove `.json` / `.txt` from public scopes until dialog-token gating exists.

## 4. Cross-Cutting Symmetry Check

**C1 DENIED_NAMES / DENIED_EXTS vs C2 capability deny list:** not symmetric. R3.5 says Rust constants are authoritative, but the proposed capability JSON is a manually duplicated subset and intentionally omits public-folder denies. It also omits `id_dsa` and `.asc` from the C2 JSON even though C1 includes them.

**C2 capability deny list vs C5 lifecycle:** not connected. C5 routes native project-open strings through TypeScript classification but does not bind the resulting path to C1's Rust filesystem validator or the capability deny policy. A lifecycle event can produce a path that the frontend treats as valid before any Rust-side canonical scope/deny check is proven.

**C5 lifecycle handlers vs authoritative policy:** not ready. `project-open-contract.ts` remains a UX/type contract; Rust path validation is the authority for filesystem access. R3.6 should explicitly state that lifecycle open only classifies/queues, and any actual file load must call the C1 `ReadIntent::ProjectImport` path.

## 5. Test Plan Coverage Re-Review Per C-Item

- **C1:** Add non-CSV `downloadBlob()` fixtures, Windows compile check for cfg-gated imports, and symlink-leaf tests that inspect the original path before canonicalization.
- **C2:** Add fixture cases for `$DESKTOP/foo/secrets.json`, `$DOWNLOAD/credentials.json`, case variants, and `id_rsa.txt`; the current proposed drift test would miss the public-scope omission.
- **C3:** Generator test must write to a temp file and compare; inventory must include the live missing families R3.5 names; sensitive oracle needs private-key/JWT/access-key coverage.
- **C4:** Contract test must cover all live `desktop-rust` workflows, especially user-settings/kanban/design-variables, and should parse registered commands or plugin registrations instead of hard-maintaining a list.
- **C5:** Mocked JS listener tests are insufficient. Add compile tests for package deps/imports, Rust module registration, and a readiness-state test proving cold-start events stay queued until frontend registration.
- **C6:** Add ADS fixtures with normal drive roots, e.g. `C:\safe\foo.protopulse:bar`, plus legacy DOS device names without `\\.\`.
- **C7:** Add a package-script test or snapshot proving existing `tauri:build` is intentionally replaced/extended, and a workflow test proving the prep step runs before tauri-action for each matrix target.
- **C8:** Add assertions that SBOM files exist and upload with `if-no-files-found: error`; warning-only SBOM generation does not satisfy the R3 artifact requirement.
- **C9:** Add target-specific `BUNDLE_DIR`/matrix fixture to avoid stale bundle discovery.
- **C10:** Add macOS `.app` directory fixture, SignTool timestamp-warning fixture, and test that inventory is blocking while signing is advisory only in dry-run.
- **C11:** Add docs/code-snippet lint that rejects plugin-builder endpoint examples and package names missing the `@tauri-apps/` scope.
- **C12:** Add lane-reservation check for new helper scripts, plus explicit target-policy tests for Linux ARMv6/Windows32 inclusion or documented exclusion.
- **C13:** Add provenance test that compares GitHub release latest, crates.io latest, default-branch `Cargo.toml`, JS package name, and license metadata; GitHub release-only is not enough.

## 6. Missing Critiques Surfaced as C14+

### C14 - Frontend readiness is a lifecycle state, not window existence

C5's state machine still conflates `get_webview_window("main")` with "React listener installed." This is the central lifecycle bug that R3 wanted fixed. R3.6 should queue until the frontend explicitly registers/drains, then switch to emit mode only after an acknowledged ready command/event.

### C15 - Public-folder extension narrowing does not neutralize sensitive `.json` / `.txt`

This is separate from C2's missing pattern list: `.json` and `.txt` are both legitimate export extensions and common secret/config extensions. The policy needs either command-specific capabilities or dialog-token gating before those extensions are broad public-folder scopes.

### C16 - Update examples must use documented runtime updater API

The updater docs show runtime channel endpoints through `app.updater_builder().endpoints(...)`, not plugin-builder endpoints. Because C11's whole purpose is preventing invalid activation docs, the example itself must align with the documented API.

### C17 - serialplugin provenance must treat crates.io as a release source

For `tauri-plugin-serialplugin`, GitHub releases lag crates.io/default-branch versions. A provenance process that records only `gh api releases/latest` can mark the dependency stale or current incorrectly.

## 7. Convergence Block

---
ROUND_STATUS: needs-revision
OPEN_CRITIQUES: [C1 default CsvExport breaks non-CSV desktop exports and Windows snippet has unguarded unix import; C2 public-folder deny family still omitted so secrets.json remains allowed via json scope; C3 inventory rewrite omits implementation and live key families; C4 storage workflows still claim desktop-rust without commands/plugins; C5 missing npm dependency/module wiring/App.tsx symbols and still drops cold-start events before frontend readiness; C6 ADS check fails for normal drive-letter paths; C7 package script change is not additive against live package.json; C8 SBOM generation/upload remains warning-only; C10 macOS .app inventory uses -type f and SignTool timestamp is warning-only; C11 endpoint example uses undocumented plugin-builder shape and wrong npm package names; C12 adds unclaimed checksum helper and target policy remains ambiguous; C13 GitHub-release-only serialplugin provenance misses crates.io 2.22.0 and dual license; D1/C2 contradiction unresolved for public json/txt scopes]
SIGNOFF: Codex
OWNERSHIP: Claude leads R3.6 revision
NEXT_ROUND: R3.6 revision
---

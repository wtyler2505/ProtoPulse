# Codex R4 Land Review - Tauri Retro Waves 1-8

## 1. Inputs Read

- `/tmp/r4-land-cumulative.diff` - 4,922-line cumulative diff for commits `0efbb08f`, `5cffb9a1`, `c15d7cd9`, `64692866`, `185dd08e`, `91d34eaa`, `08ad7179`, `49d98f33`.
- `COLLAB_TAURI_RETRO_HANDOFF_R3.7.md` - land plan, wave order, and R5 carry-forward requirements.
- `COLLAB_TAURI_RETRO_RESPONSE_R3.7.md` - prior Codex R6 land-plan ratification and four explicit acceptance guards.
- `COLLAB_TAURI_RETRO_RESPONSE_R3.6.md` - R5 `OPEN_CRITIQUES` baseline.
- HEAD/live files: `src-tauri/src/lib.rs`, `src-tauri/src/path_validation.rs`, `client/src/lib/desktop/runtime-topology.ts`, `package.json`, `package-lock.json`, `scripts/ci/supply-chain-check.sh`, `.github/workflows/tauri-build.yml`, `client/src/lib/desktop/project-open-contract.ts`, `client/src/lib/desktop/handle-project-open-outcome.ts`, `client/src/App.tsx`, `src-tauri/tauri.conf.json`, `scripts/tauri/prepare-arduino-sidecar.ts`, storage inventory scripts/files.
- External doc check via WebSearch/WebFetch only, per instruction: Tauri deep-link docs at `https://v2.tauri.app/plugin/deep-linking/` and JS reference at `https://v2.tauri.app/reference/javascript/deep-link/`.

Important repo-state note: the working tree is dirty. `src-tauri/tauri.conf.json` contains uncommitted lifecycle/build config changes, but those changes are NOT in the eight R4 commits or `/tmp/r4-land-cumulative.diff`. I reviewed the committed R4 land as the source of truth, and I call out where local tests only pass because of dirty working-tree state.

## 2. Acceptance Guard Verification

| Guard | Verdict | Probe + finding |
|---|---|---|
| C1 - `read_file` must read through opened no-follow handle | pass | `src-tauri/src/lib.rs:191-224` validates, opens with `path_validation::open_no_follow_read(&canonical)`, then reads from `std_file` inside `spawn_blocking`. No `tokio::fs::read_to_string` path read remains. `src-tauri/src/path_validation.rs:359-378` sets `O_NOFOLLOW` / `FILE_FLAG_OPEN_REPARSE_POINT`. |
| C4 - `ResolutionWave` applied to live key `arduino-serial` | pass | `client/src/lib/desktop/runtime-topology.ts:69-85` defines the live key as `arduino-serial`; `client/src/lib/desktop/runtime-topology.ts:142-147` sets it to `compat-local` with `resolutionWave: "r5-hardware"`. The prose alias `serial-monitor` is not the landed key. |
| C18 - `package-lock.json` updated with `package.json` for `@tauri-apps/plugin-deep-link` | pass | `package.json:79-80` includes `@tauri-apps/plugin-deep-link`; `package-lock.json:60` and `package-lock.json:8703-8710` include the dependency and resolved package. |
| C21 - supply-chain check actually generates SBOMs | pass | `scripts/ci/supply-chain-check.sh:58-86` creates `artifacts/sbom`, runs `cargo cyclonedx --format json`, copies `src-tauri/bom.json`, and runs `npx --yes @cyclonedx/cyclonedx-npm --output-file artifacts/sbom/protopulse-npm.cdx.json`. `.github/workflows/tauri-build.yml:122-134` hard-fails the step/upload. |

Guard-level summary: the four explicit R6 acceptance guards pass. That is not enough to ratify the land because several R5 critiques remain open and multiple cross-wave regressions landed.

## 3. Per-Wave Correctness Verdict

| Wave | Verdict | Review result |
|---|---|---|
| Wave 1 - C1+C22 scoped path validation | ratified | C1 read-side no-follow guard is satisfied, and `src-tauri/Cargo.toml:30-33` adds `libc` under Unix. Local `cargo check` did not complete cleanly, but it failed in pinned `specta`, not in Wave 1 code. |
| Wave 2 - C2+C15 capability deny family | needs-revision | The broader secret-name family from R3.7 did not land. Probe `rg -n "oauth|api-key|private-key|access-key|token|secret"` shows only `secrets.json`, `credentials.json`, `.env*`, `id_*`, and sensitive extensions in Rust/capability rules. R3.7 examples like `oauth-token.protopulse`, `private-key.svg`, and `access-key.csv` remain allowed by name. |
| Wave 3 - C3+C20 storage inventory | needs-revision | `STORAGE_INVENTORY_OUT` is wired, but the landed system is already drifted: `npx tsx scripts/dev/check-storage-key-inventory.ts` fails on `protopulse:project-open-prompt-replace`, introduced by Wave 5. Also, `classifyStorageKey("protopulse-order-history:1")` returns `null`, so the R5/R3.7 `protopulse-order-history:` parameterized prefix is still missed. |
| Wave 4 - C4 topology | ratified | `ResolutionWave` type, topology exports, and `arduino-serial` live-key update are correct. `client/src/lib/__tests__/runtime-topology.test.ts` passes in the selected test slice. |
| Wave 5 - C5+C14+C19+C18 lifecycle bridge | needs-revision | App-level bridge is mounted at `client/src/App.tsx:137-144`, and C18 package-lock is closed. But committed HEAD lacks the required `tauri.conf.json` deep-link/file-association config, no startup `getCurrent`/`get_current` deep-link drain is present, and `handleProjectOpenOutcome` routes filesystem paths into `/projects/:projectId` even though `ProjectWorkspace` requires a positive numeric ID. |
| Wave 6 - C6+C24 Windows path rejection | new-critique | The Windows validation behavior/tests pass (`client/src/lib/__tests__/project-open-contract.test.ts` passed 22 tests). However `client/src/lib/desktop/project-open-contract.ts:73` contains a literal NUL in the regex, so Git treats the source as binary; `/tmp/r4-land-cumulative.diff:338` is only `Binary files ... differ`. Source code in a review campaign must stay textual and diffable. |
| Wave 7 - C8+C21 SBOM hard-fail | ratified | Workflow no longer soft-fails the supply-chain step, and the script generates real CycloneDX files. The old test wording still says "placeholders," but the code path itself is correct for R4. |
| Wave 8 - C12+C23 Arduino sidecar | needs-revision | The helper script has v1.4.1 hashes, SHA256 enforcement, and `mkdtempSync`. But the landed commits do not wire it into `package.json` or `.github/workflows/tauri-build.yml`, and committed HEAD `src-tauri/tauri.conf.json` has no `bundle.externalBin`. The script is not part of the actual build. |

## 4. Bug Findings

1. Blocker - C2/C15 secret-name deny family is incomplete.
   Evidence: `src-tauri/src/path_validation.rs:103-124` and `src-tauri/capabilities/default.json:92-192` deny exact/prefix/ext subsets, but not the R3.7 required broad basename/suffix family (`api-key`, `oauth`, `private-key`, `access-key`, `token`, `secret`) across public `.csv`/`.svg`/`.protopulse` scopes.

2. Blocker - storage inventory cannot pass after the full land.
   Evidence: `npx tsx scripts/dev/check-storage-key-inventory.ts` failed with `UNCLASSIFIED KEYS: protopulse:project-open-prompt-replace`. That key is introduced at `client/src/lib/desktop/handle-project-open-outcome.ts:49`. Probe also showed `classifyStorageKey("protopulse-order-history:1") === null`, despite R3.7 naming `protopulse-order-history:` as a required parameterized prefix.

3. Blocker - committed R4 land omits lifecycle/build config that local dirty tests depend on.
   Evidence: `git show HEAD:src-tauri/tauri.conf.json | rg "externalBin|fileAssociations|deep-link"` returns no matches; the only matches are `devUrl` and a production CSP containing `http://localhost:*`. The dirty working tree adds `externalBin`, `fileAssociations`, `plugins.deep-link.desktop.schemes`, and CSP cleanup, but those are not in the eight commits or cumulative diff.

4. Blocker - project-open "load-new" does not load a `.protopulse` file.
   Evidence: `client/src/lib/desktop/handle-project-open-outcome.ts:25-35` navigates to `/projects/${encodeURIComponent(outcome.projectPath)}`. `client/src/pages/ProjectWorkspace.tsx:851-857` converts `params.projectId` to `Number` and redirects non-positive/non-integer IDs to `/projects/1`. A path like `/home/user/MyProject.protopulse` becomes an encoded non-numeric route and is not opened.

5. Should-fix - startup deep-links are not drained through the documented plugin API.
   Evidence: official Tauri docs say use `getCurrent` / `get_current` on app start to detect whether the app was opened via a deep link. Landed code registers `onOpenUrl`/`on_open_url` (`client/src/lib/desktop/project-open-contract.ts:245-254`, `src-tauri/src/lib.rs:558-570`) but `rg "getCurrent|get_current"` finds no implementation in the landed lifecycle code.

6. Should-fix - Wave 6 made a TypeScript source file binary.
   Evidence: `client/src/lib/desktop/project-open-contract.ts:73` contains a literal NUL range; `/tmp/r4-land-cumulative.diff:338` reports the entire file as binary. Use escaped text (`/[\x00-\x1F\x7F]/`) so future reviews can see the diff.

7. Should-fix - local Rust check fails under current local toolchain.
   Evidence: `rustc 1.90.0`; `cargo check --manifest-path src-tauri/Cargo.toml` failed in `specta-2.0.0-rc.25` with `E0658: use of unstable library feature debug_closure_helpers` at `attributes.rs:178`. The workflow pins Rust `1.93.0`, so this may be local-toolchain skew, but the current local checkout does not pass the advertised local check.

## 5. Missed Critiques From R5 `OPEN_CRITIQUES`

- C2/C15 not closed: public plugin-fs/custom path rules still lack the symmetric secret basename/suffix family. The exact `.json`/`.txt` gap is gone, but the broader `oauth-token.protopulse` / `private-key.svg` class remains.
- C3/C20 not closed: generator override support is present, but the inventory does not stay green after Wave 5 and still misses `protopulse-order-history:` runtime suffixes.
- C5/C14/C19 not closed: the bridge is mounted high enough, but the committed app lacks deep-link/file-association config and startup `getCurrent` handling, and the dispatcher does not actually open a `.protopulse` file.
- C12/C23 not closed: Linux ARM64 is documented as reserved, and hashes/mkdtemp landed, but the build path never invokes sidecar prep and committed `tauri.conf.json` does not declare the sidecar.
- C8/C21 closed.
- C18 closed.
- C1/C22 closed at the specific no-follow/read-handle guard level.
- C4 closed.
- C6/C24 behavior closed, but Wave 6 introduced the separate binary-source reviewability critique.

## 6. Convergence

---
ROUND_STATUS: needs-revision
OPEN_CRITIQUES: [C2/C15 broad secret-name deny family is still incomplete; C3/C20 storage inventory check fails after Wave 5 and misses protopulse-order-history runtime suffixes; C5/C14/C19 lifecycle land lacks committed tauri.conf deep-link/file-association config, startup getCurrent/get_current drain, and a real file-open dispatcher; Wave 6 project-open-contract source is binary because of a literal NUL and must be made text-diffable; C12/C23 Arduino sidecar prep is not wired into package/workflow/committed tauri.conf; local cargo check fails under rustc 1.90.0 in pinned specta]
SIGNOFF: Codex
OWNERSHIP: Claude leads R4.5 fixes
NEXT_ROUND: R4.5 fixes
---

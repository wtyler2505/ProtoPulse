# Tauri v2 Phase 1 Prompt Pack

**Status:** Round 5 execution packet
**Date:** 2026-05-10
**Scope:** Five ready-to-paste `/agent-teams` prompts for Phase 1 only.

Use these prompts after `scripts/tauri-preflight.sh` has been run and its failure report has been captured. If the default home caches are read-only, run Phase 1 commands with:

```bash
export npm_config_cache=/tmp/npm-cache-protopulse
export CARGO_HOME=/tmp/cargo-home-protopulse
```

## Canonical Source URLs

- Tauri commands and frontend invoke model: https://v2.tauri.app/develop/calling-rust/
- Tauri capabilities and command authority: https://v2.tauri.app/security/capabilities/
- Tauri external binaries and sidecar packaging: https://v2.tauri.app/develop/sidecar/
- `tauri-specta` repository: https://github.com/specta-rs/tauri-specta
- Specta base repository: https://github.com/specta-rs/specta
- Tauri file-system plugin and scope context: https://v2.tauri.app/plugin/file-system and https://v2.tauri.app/security/scope
- Tauri logging plugin: https://v2.tauri.app/plugin/logging
- Tauri process plugin: https://v2.tauri.app/plugin/process
- Tauri updater plugin: https://v2.tauri.app/plugin/updater

## Preflight Success Criteria To Preserve

Each Phase 1 task must keep these `scripts/tauri-preflight.sh` gates green or document the intentional red gate:

- Toolchain: `node`, `npm`, `rustc`, `cargo`, and Tauri CLI v2 detected.
- Cache: npm cache and Cargo home writable, using the `/tmp` exports above if home caches are read-only.
- Registry: pinned npm and Cargo packages resolve, including `tauri-specta = 2.0.0-rc.25`, `specta = 2.0.0-rc.25`, `specta-typescript = 0.0.12`, `@tauri-apps/plugin-log = 2.8.0`, `@tauri-apps/plugin-process = 2.3.1`, and `@tauri-apps/plugin-updater = 2.10.1`.
- TypeScript: `npm run check` passes.
- Rust: `cargo check --manifest-path src-tauri/Cargo.toml` passes.
- Packaged smoke: `npm run tauri:build -- --debug` succeeds and prints an executable artifact path.
- Static reports: `dist/index.cjs`, `app.withGlobalTauri:false`, CSP presence, and `vite.config.ts` `base:'./'` status are explicit.

## Merge Order For Phase 1

The collision rule is strict: **specta build setup -> bindings export -> frontend refactor**. Do not run `src-tauri/src/lib.rs` / `src-tauri/Cargo.toml` edits in parallel with `client/src/lib/tauri-api.ts` refactors. Tests may be authored in parallel only when their file owner is explicit and they do not rewrite source files owned by another agent.

## Prompt 1.1: Baseline Smoke

```text
/agent-teams

Phase 1.1 baseline smoke: prove production build inputs exist before any IPC/security change.

Environment exports for every teammate terminal:
export npm_config_cache=/tmp/npm-cache-protopulse
export CARGO_HOME=/tmp/cargo-home-protopulse

Canonical sources to read first:
- Tauri external binaries and sidecar packaging: https://v2.tauri.app/develop/sidecar/
- Tauri configuration reference for frontendDist/build behavior: https://v2.tauri.app/reference/config/
- Current plan: docs/plans/2026-05-10-tauri-v2-desktop-migration.md Task 1.1

File ownership:
- build-contract owns scripts/build.ts and package.json.
- test-author owns scripts/__tests__/build-output.test.ts, or client/src/lib/__tests__/tauri-build-inputs.test.ts if that path fits the existing test layout better.
- No teammate may edit src-tauri/ in this task.

Failing-test-first requirement:
1. test-author writes the failing artifact contract test first. It must fail if npm run build does not produce dist/public/index.html and either dist/index.cjs or a ratified replacement contract that removes the desktop Node sidecar expectation.
2. test-author runs npm run build and the focused test, captures the red failure, and posts it to the team before implementation.
3. build-contract implements the smallest build/package change that satisfies the selected contract, or updates the Phase 1 note if the team explicitly chooses "no dist/index.cjs desktop sidecar" as the path.
4. test-author reruns the focused test and npm run check.

Strict merge order:
- This task must complete before Phase 1.3 and 1.4 are merged.
- Do not start frontend refactor work from Prompt 1.4 until the build contract is no longer ambiguous.

Preflight criteria that must still pass or be explicitly red:
- npm cache and Cargo home writable using the exports above.
- npm run check passes.
- scripts/tauri-preflight.sh reports dist/index.cjs status and vite base status explicitly.
- If npm run tauri:build -- --debug remains red because the known build contract is unresolved, record that exact gate as the Phase 1.1 output rather than hiding it.

Deliverable:
- A concise team report naming the selected desktop build contract, the failing test that proved the old state, and the command output summary after the fix.
```

## Prompt 1.2: Bridge Wiring Audit

```text
/agent-teams

Phase 1.2 bridge wiring audit: identify real frontend workflows that must route through DesktopAPI, then write the first failing routing tests.

Environment exports for every teammate terminal:
export npm_config_cache=/tmp/npm-cache-protopulse
export CARGO_HOME=/tmp/cargo-home-protopulse

Canonical sources to read first:
- Tauri commands and frontend invoke model: https://v2.tauri.app/develop/calling-rust/
- Tauri capabilities and command authority: https://v2.tauri.app/security/capabilities/
- Current IPC ADR: docs/decisions/2026-05-10-tauri-ipc-contract.md
- Current plan: docs/plans/2026-05-10-tauri-v2-desktop-migration.md Task 1.2

File ownership:
- bridge owns client/src/lib/tauri-api.ts and the selected workflow caller files for file open/save/export/import.
- test-author owns client/src/lib/__tests__/desktop-api-routing.test.ts.
- native-deps owns no file in this task.
- No teammate may edit src-tauri/ in this task.

Failing-test-first requirement:
1. bridge audits client/src for open/save/export/import/menu workflows and posts the smallest first caller set.
2. test-author writes tests that force isTauri true and false, proving selected workflows call getDesktopAPI() only in desktop mode and keep browser fallback behavior.
3. test-author runs npx vitest run client/src/lib/__tests__/desktop-api-routing.test.ts and posts the red failure before bridge edits source.
4. bridge implements the narrow adapter boundary and no unrelated UX/copy changes.

Strict merge order:
- Audit and tests can happen before Prompt 1.3.
- Source edits to client/src/lib/tauri-api.ts must not conflict with Prompt 1.3. If Prompt 1.3 is active, pause source edits until specta build setup and bindings export are merged.
- Frontend refactor to generated commands belongs to Prompt 1.4, not this audit prompt.

Preflight criteria that must still pass or be explicitly red:
- npm run check passes after the bridge tests are green.
- cargo check --manifest-path src-tauri/Cargo.toml remains unchanged from baseline.
- scripts/tauri-preflight.sh cache and registry gates remain usable with the exports above.

Deliverable:
- A team report with the audited caller list, the new failing-first test, the browser fallback proof, and any deferred callers.
```

## Prompt 1.3: `tauri-specta` Adoption And Binding Export

```text
/agent-teams

Phase 1.3 native IPC foundation: adopt tauri-specta generated bindings and export client/src/lib/bindings.ts.

Environment exports for every teammate terminal:
export npm_config_cache=/tmp/npm-cache-protopulse
export CARGO_HOME=/tmp/cargo-home-protopulse

Canonical sources to read first:
- tauri-specta repository: https://github.com/specta-rs/tauri-specta
- Specta base repository: https://github.com/specta-rs/specta
- Tauri commands and frontend invoke model: https://v2.tauri.app/develop/calling-rust/
- Claude research feed: docs/audits/2026-05-10-tauri-v2-claude-context7-research-feed.md
- Current plan: docs/plans/2026-05-10-tauri-v2-desktop-migration.md Task 1.3

File ownership:
- native-deps owns src-tauri/Cargo.toml and src-tauri/src/lib.rs.
- bridge owns client/src/lib/bindings.ts and only reviews/regenerates it through the Rust export path; it must not hand-edit generated bindings.
- test-author owns the binding freshness test file selected by the team.
- bridge does not edit client/src/lib/tauri-api.ts in this prompt except for compile-only import scaffolding approved after bindings export.

Failing-test-first requirement:
1. test-author writes a freshness test that fails while client/src/lib/bindings.ts is missing or differs after the Rust export path.
2. test-author runs the focused freshness check plus npm run check or cargo check as appropriate and posts the red failure.
3. native-deps adds exact Cargo pins from the plan: tauri-specta = "=2.0.0-rc.25", specta = "=2.0.0-rc.25", specta-typescript = "=0.0.12".
4. native-deps adds #[specta::specta] coverage, a tauri_specta Builder, command collection, debug/test TypeScript export, builder.invoke_handler(), and event mounting without dropping existing menu events.
5. bridge regenerates client/src/lib/bindings.ts through the Rust export path and verifies it is treated as generated but committed/reviewable.

Strict merge order:
- Step A: native-deps lands Cargo.toml and lib.rs specta build setup.
- Step B: bridge lands generated bindings.ts from that setup.
- Step C: Prompt 1.4 may refactor tauri-api.ts to commands.X().
- Do not run Prompt 1.4 in parallel with native-deps edits.

Preflight criteria that must still pass or be explicitly red:
- Registry gates resolve tauri-specta, specta, and specta-typescript exact pins.
- cargo check --manifest-path src-tauri/Cargo.toml passes after native-deps work.
- npm run check is expected to stay red until Prompt 1.4 if tauri-api.ts still uses raw mismatched invokes; record that as the known next gate, not as hidden failure.

Deliverable:
- A team report with the exact generated binding command/path, the cargo check result, and the remaining frontend compile status.
```

## Prompt 1.4: Frontend Refactor To Typed `commands.X()`

```text
/agent-teams

Phase 1.4 frontend IPC refactor: replace raw custom app invoke calls with generated commands.X() calls.

Environment exports for every teammate terminal:
export npm_config_cache=/tmp/npm-cache-protopulse
export CARGO_HOME=/tmp/cargo-home-protopulse

Canonical sources to read first:
- tauri-specta repository: https://github.com/specta-rs/tauri-specta
- Tauri commands and frontend invoke model: https://v2.tauri.app/develop/calling-rust/
- Current IPC ADR supersession note: docs/decisions/2026-05-10-tauri-ipc-contract.md
- Current plan: docs/plans/2026-05-10-tauri-v2-desktop-migration.md Task 1.3

File ownership:
- bridge owns client/src/lib/tauri-api.ts and any selected frontend caller files.
- bridge owns client/src/lib/bindings.ts only as generated output; no manual edits.
- test-author owns client/src/lib/__tests__/desktop-api-routing.test.ts and any focused IPC compile/freshness tests.
- native-deps owns no new edits unless Prompt 1.3 exported bindings are wrong; in that case, stop and hand back to native-deps.

Failing-test-first requirement:
1. test-author writes or extends a compile/focused test that fails while tauri-api.ts calls read_file_contents, write_file_contents, or get_app_version via raw invoke.
2. test-author runs the focused test and npm run check, then posts the red failure.
3. bridge imports generated commands from client/src/lib/bindings.ts and replaces custom app commands with commands.readFile(filePath), commands.writeFile(filePath, data), commands.getVersion(), and any generated equivalent for getPlatform.
4. bridge keeps official JS plugin calls for dialog/opener/fs where the bridge deliberately uses plugin APIs.

Strict merge order:
- Start only after Prompt 1.3 has landed specta build setup and generated bindings.ts.
- Do not edit src-tauri/Cargo.toml or src-tauri/src/lib.rs from this prompt.
- If generated names differ from the plan expectation, stop and ask native-deps to fix the export rather than inventing a local wrapper.

Preflight criteria that must still pass or be explicitly red:
- npm run check passes.
- cargo check --manifest-path src-tauri/Cargo.toml passes.
- scripts/tauri-preflight.sh registry gates remain green with the cache exports.

Deliverable:
- A team report showing the raw invoke calls removed, generated command names used, and TypeScript/Rust check summaries.
```

## Prompt 1.5: IPC Contract And Drift Test

```text
/agent-teams

Phase 1.5 IPC contract guard: convert the Round 3 manual drift idea into generated-binding freshness and compile-time enforcement.

Environment exports for every teammate terminal:
export npm_config_cache=/tmp/npm-cache-protopulse
export CARGO_HOME=/tmp/cargo-home-protopulse

Canonical sources to read first:
- tauri-specta repository: https://github.com/specta-rs/tauri-specta
- Specta base repository: https://github.com/specta-rs/specta
- Tauri commands and frontend invoke model: https://v2.tauri.app/develop/calling-rust/
- Current IPC ADR: docs/decisions/2026-05-10-tauri-ipc-contract.md
- Current plan: docs/plans/2026-05-10-tauri-v2-desktop-migration.md Phase 1

File ownership:
- test-author owns the generated-binding freshness test and any IPC contract test fixture.
- bridge owns client/src/lib/tauri-api.ts only if a compile failure proves a frontend mismatch.
- native-deps owns src-tauri/Cargo.toml and src-tauri/src/lib.rs only if a compile failure proves a Rust command/export mismatch.
- No teammate may reintroduce a handwritten parser as the primary IPC drift guard.

Failing-test-first requirement:
1. test-author writes the freshness check first: regenerate bindings through the Rust export path, fail if client/src/lib/bindings.ts changes, then fail npm run check if tauri-api.ts cannot consume the generated surface.
2. test-author runs the freshness check before any source repair and posts the red or green baseline.
3. bridge or native-deps fixes only the side proven wrong by the test.
4. test-author reruns freshness, npm run check, and cargo check.

Strict merge order:
- This prompt starts after Prompt 1.3 and 1.4.
- If both Rust export and frontend consumption fail, native-deps fixes export first, bridge refactors second.
- Tests may be merged last, after they prove the generated file and frontend compile agree.

Preflight criteria that must still pass or be explicitly red:
- cargo check --manifest-path src-tauri/Cargo.toml passes.
- npm run check passes.
- npm run tauri:build -- --debug is the phase closeout gate, not a per-edit loop.
- scripts/tauri-preflight.sh prints an executable artifact path or records the exact remaining build gate.

Deliverable:
- A team report with the freshness command, the final binding diff status, and confirmation that manual command-name parsing is superseded by tauri-specta plus TypeScript compilation.
```

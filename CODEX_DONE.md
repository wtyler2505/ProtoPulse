# Codex Completion Report

**Task:** Stabilize Tauri preflight + IPC contract workflow and prepare Phase 1.4 execution lane.
**Status:** partial (core workflow landed; local app launch path and next-10 follow-up sprint verified)

## What Landed

1. Preflight + CI hardening
   - Added local preflight wrapper: `scripts/ci/tauri-preflight-local.sh`
   - Added Linux bounded preflight step to `.github/workflows/tauri-build.yml`
   - Added rust-toolchain hard gate + mismatch checks in `scripts/tauri-preflight.sh`
   - Added toolchain-aware preflight regression test:
     - `scripts/__tests__/tauri-preflight-toolchain.test.ts`

2. Packaged-smoke artifact contract
   - Tightened `scripts/ci/tauri-packaged-smoke.sh` to assert exact expected `.deb` path:
     - `src-tauri/target/debug/bundle/deb/protopulse_${APP_VERSION}_${DEB_ARCH}.deb`
   - Added test coverage in:
     - `scripts/__tests__/tauri-phase5-ci-supply-chain.test.ts`

3. IPC contract guardrails
   - Added npm aliases:
     - `tauri:bindings:export`
     - `tauri:bindings:verify`
     - `tauri:bindings:sync-check`
   - Added legacy invoke guard:
     - `scripts/ci/guard-legacy-ipc-names.sh`
     - `npm run lint:ipc-contract`
   - Wired guard into preflight required gates.
   - Added tests:
     - `client/src/lib/__tests__/tauri-api-bindings-consumption.test.ts`
     - `scripts/__tests__/tauri-ipc-contract-guard.test.ts`

4. Docs + lane operations
   - Added `docs/DEVELOPER.md` section:
     - “IPC Contract Workflow”
   - Added schema drift policy:
     - `docs/collab/2026-05-16-schema-drift-policy.md`
   - Added NotebookLM dirty-tree triage:
     - `docs/collab/2026-05-16-notebooklm-dirty-tree-triage.md`
   - Added safe commit slicing checklist:
     - `docs/collab/2026-05-16-safe-commit-slicing-checklist.md`
   - Added Phase 1.4 lane scope doc:
     - `docs/collab/2026-05-16-phase-1.4-lane-scope.md`

5. Regeneration workflow
   - Added combined regeneration script with deterministic diff report:
     - `scripts/ci/regen-tauri-contract-artifacts.sh`
     - npm alias: `npm run tauri:contracts:regen`

6. Lifecycle/store test progress
   - Added focused cold-start queue drain lifecycle test in:
     - `src-tauri/src/native_project_open.rs`
   - Added narrow desktop-store error-contract unit tests in:
     - `src-tauri/src/desktop_store.rs`

## Verification Run

Passed:

```bash
npm run lint:ipc-contract
npm run test -- scripts/__tests__/tauri-ipc-contract-guard.test.ts scripts/__tests__/tauri-preflight-toolchain.test.ts scripts/__tests__/tauri-phase5-ci-supply-chain.test.ts
npm run test -- scripts/__tests__/tauri-ipc-contract-guard.test.ts scripts/__tests__/tauri-preflight-toolchain.test.ts scripts/__tests__/tauri-phase5-ci-supply-chain.test.ts scripts/__tests__/tauri-phase6-release-hardening.test.ts
```

## Known Warnings / Blockers

1. `scripts/tauri-preflight.sh` now warns when bundle identifier remains `com.protopulse.app` and suggests an owned reverse-DNS identifier (`io.github.wtyler2505.protopulse` example).
2. Rust build/test/export commands fail when run on the shell-default Rust/Cargo (`1.90.0`) with:
   - `E0658: use of unstable library feature 'debug_closure_helpers'`
   - observed while compiling `specta 2.0.0-rc.25`
3. Verified fix path: run Rust-side tests with the pinned project toolchain (`rustup run 1.93.0 ...`). Both targeted Rust validations now pass with 1.93.0.
4. `tauri dev` previously failed due Cargo binary ambiguity (`export_bindings` + `protopulse`). Fixed by setting `default-run = "protopulse"` in `src-tauri/Cargo.toml`; local `tauri:dev` now builds and launches.
5. Bundle identifier now fixed in `src-tauri/tauri.conf.json`:
   - `io.github.wtyler2505.protopulse`
   - preflight now reports `status: passed` with `bundle-identifier-report` as pass.
6. Follow-up "next 10 tasks" completion ledger:
   - `docs/collab/2026-05-17-next-10-tasks-completion.md`
7. `scripts/ci/regen-tauri-contract-artifacts.sh` now enforces pinned toolchain via:
   - `RUST_TOOLCHAIN` (default `1.93.0`)
   - `rustup run "${RUST_TOOLCHAIN}" ...`

## Exact Resume Command Set

```bash
# 1) Fast contract checks
npm run lint:ipc-contract
npm run test -- scripts/__tests__/tauri-ipc-contract-guard.test.ts scripts/__tests__/tauri-preflight-toolchain.test.ts scripts/__tests__/tauri-phase5-ci-supply-chain.test.ts scripts/__tests__/tauri-phase6-release-hardening.test.ts

# 2) Re-run preflight baseline + archive report
timeout 10m bash scripts/ci/tauri-preflight-local.sh | tee docs/collab/$(date -u +%Y-%m-%dT%H-%M-%SZ)-tauri-preflight-report.md

# 3) Regenerate contract artifacts + diff report
npm run tauri:contracts:regen

# 4) Rust-focused validation on pinned toolchain (required in this environment)
rustup run 1.93.0 cargo test --manifest-path src-tauri/Cargo.toml native_project_open::tests::cold_start_requests_queue_then_drain_once_frontend_is_ready
rustup run 1.93.0 cargo test --manifest-path src-tauri/Cargo.toml desktop_store::tests

# 5) Finish slice documentation audit + commit slicing
git status --short
```

# ProtoPulse Development Status Report

Date: 2026-05-17 (UTC)
Branch: `main`
Scope: Tauri stabilization lane + IPC contract hardening + Phase 1.4 readiness

## Executive Summary

ProtoPulse is now in a **working local-app state** for the Tauri lane. The app builds, launches, and passes the focused verification suite. Core stabilization work is complete, with one known non-blocking warning (bundle identifier naming on macOS best-practice check).

## What Is Working Now

1. Full preflight baseline completed and archived:
   - `docs/collab/2026-05-17T00-40-54Z-tauri-preflight-report.md`
   - Result: `status: warning` (only bundle identifier warning)

2. Local Tauri launch path works:
   - `npm run dev` starts frontend/backend at `http://localhost:5000`
   - `rustup run 1.93.0 npm run tauri:dev` builds and runs `target/debug/protopulse`

3. Focused test suite passes:
   - 9 files / 42 tests passed for Tauri preflight, packaged-smoke contract, IPC drift/consumption, lifecycle/store contract guard tests

4. Rust-side targeted tests pass on pinned toolchain:
   - `native_project_open::tests::cold_start_requests_queue_then_drain_once_frontend_is_ready`
   - `desktop_store::tests` (12 tests)

## Key Changes Landed

### A) Preflight and CI hardening
- Added stable local preflight wrapper:
  - `scripts/ci/tauri-preflight-local.sh`
- Added Linux bounded preflight gate in CI:
  - `.github/workflows/tauri-build.yml`
- Added hard rust-toolchain checks:
  - `scripts/tauri-preflight.sh`
  - requires `src-tauri/rust-toolchain.toml`
  - fails on mismatched `CARGO_TOOLCHAIN`

### B) Artifact contract hardening
- Tightened packaged-smoke assertion to exact expected `.deb` path:
  - `scripts/ci/tauri-packaged-smoke.sh`
  - validated by `scripts/__tests__/tauri-phase5-ci-supply-chain.test.ts`

### C) IPC contract safety
- Added npm task aliases:
  - `tauri:bindings:export`
  - `tauri:bindings:verify`
  - `tauri:bindings:sync-check`
  - `tauri:contracts:regen`
- Added legacy invoke guard:
  - `scripts/ci/guard-legacy-ipc-names.sh`
  - `npm run lint:ipc-contract`
- Wired IPC guard into preflight required gates
- Added/updated tests:
  - `client/src/lib/__tests__/tauri-api-bindings-consumption.test.ts`
  - `client/src/lib/__tests__/tauri-bindings-freshness.test.ts`
  - `client/src/lib/__tests__/ipc-contract-drift.test.ts`
  - `scripts/__tests__/tauri-ipc-contract-guard.test.ts`

### D) Lifecycle/store focused validation
- Added cold-start queue drain lifecycle test in Rust:
  - `src-tauri/src/native_project_open.rs`
- Added narrow desktop-store error contract tests:
  - `src-tauri/src/desktop_store.rs`

### E) Launch fix
- Resolved `tauri dev` binary ambiguity by setting:
  - `src-tauri/Cargo.toml` → `default-run = "protopulse"`

## Policy/Operations Artifacts Added

- `docs/collab/2026-05-16-schema-drift-policy.md`
- `docs/collab/2026-05-16-notebooklm-dirty-tree-triage.md`
- `docs/collab/2026-05-16-safe-commit-slicing-checklist.md`
- `docs/collab/2026-05-16-phase-1.4-lane-scope.md`

## Known Warnings / Risks

1. Bundle identifier warning (non-blocking):
   - current: `com.protopulse.app`
   - recommendation: owned reverse-DNS identifier (example: `io.github.wtyler2505.protopulse`)

2. Toolchain mismatch trap:
   - shell default Rust/Cargo is `1.90.0`
   - project lane expects `1.93.0` for reliable `specta` compilation in this environment
   - use `rustup run 1.93.0 ...` for Rust-side commands

3. Dirty-tree integration risk:
   - repo currently contains multiple concurrent lanes (Tauri + NotebookLM + collab docs)
   - commit slicing is mandatory before clean merge/release workflow

## Recommended Immediate Next Actions

1. Slice commits by lane (Tauri stabilization first).
2. Decide final bundle identifier value and apply.
3. Run `npm run tauri:contracts:regen` and capture deterministic diff report.
4. Re-run focused suite + preflight after commit slicing.
5. Generate release-readiness checkpoint report.

## Reliable Runbook (Current)

```bash
cd /home/wtyler/Projects/ProtoPulse

# Terminal A
npm run dev

# Terminal B
export npm_config_cache=/tmp/npm-cache-protopulse
export CARGO_HOME=/tmp/cargo-home-protopulse
rustup run 1.93.0 npm run tauri:dev
```

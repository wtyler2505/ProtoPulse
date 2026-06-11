# Tauri Schema Drift Policy (2026-05-16)

## Decision

Use an **explicit regeneration workflow** with CI/test guards, not an always-on pre-commit generator.

## Why

1. This repo’s Tauri artifact regeneration can be heavy (Rust + bundling), and on this machine that increases commit friction significantly.
2. We already have focused gates that detect contract drift (`ipc-contract` tests/guards).
3. Always-on pre-commit regeneration would fail “small commit” ergonomics during unrelated changes.

## Policy

1. Regenerate on demand with:
   - `npm run tauri:bindings:sync-check`
   - `bash scripts/ci/regen-tauri-contract-artifacts.sh`
2. Commit regenerated artifacts when they change:
   - `client/src/lib/bindings.ts`
   - `src-tauri/gen/schemas/*`
3. Keep CI/static tests enforcing drift detection.
4. Optional local pre-commit hook is allowed, but not required by default repo policy.

## Enforcement Surface

- Scripted regen + deterministic report:
  - `scripts/ci/regen-tauri-contract-artifacts.sh`
- IPC guards/tests:
  - `scripts/ci/guard-legacy-ipc-names.sh`
  - `client/src/lib/__tests__/tauri-bindings-freshness.test.ts`
  - `client/src/lib/__tests__/tauri-api-bindings-consumption.test.ts`
  - `client/src/lib/__tests__/ipc-contract-drift.test.ts`

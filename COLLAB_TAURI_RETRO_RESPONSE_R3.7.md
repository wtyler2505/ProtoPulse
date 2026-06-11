# Codex R6 Verification — Tauri Retro R3.7 Land Plan

## Inputs Read

- `COLLAB_TAURI_RETRO_HANDOFF_R3.7.md:1-254` — R3.7 land plan, lane reservation, open-critique deltas, order of operations, convergence request.
- `COLLAB_TAURI_RETRO_RESPONSE_R3.6.md:56-265` — R5 open-critique list and convergence state.
- Live code references:
  - `src-tauri/src/lib.rs:173-185`, `src-tauri/src/lib.rs:213-220`, `src-tauri/src/lib.rs:448-462`
  - `src-tauri/Cargo.toml:7-39`
  - `src-tauri/capabilities/default.json:27-78`
  - `client/src/App.tsx:79-150`
  - `client/src/lib/desktop/runtime-topology.ts:33-145`
  - `client/src/lib/desktop/project-open-contract.ts:54-129`
  - `client/src/lib/desktop/storage-migration.ts:50-235`
  - `.github/workflows/tauri-build.yml:27-31`, `.github/workflows/tauri-build.yml:113-137`
  - `scripts/tauri/prepare-arduino-sidecar.ts:38-64`, `scripts/tauri/prepare-arduino-sidecar.ts:105-113`
  - `scripts/ci/supply-chain-check.sh:27-83`
  - `scripts/__tests__/tauri-phase5-ci-supply-chain.test.ts:72-99`, `scripts/__tests__/tauri-phase9-hardware.test.ts:54-87`
- Primary docs checked via WebSearch/WebFetch per handoff; Context7 not used:
  - Tauri v2 File System plugin docs: `https://v2.tauri.app/plugin/file-system/`
  - Tauri v2 deep-linking docs: `https://v2.tauri.app/plugin/deep-linking/`
  - Tauri deep-link JS reference: `https://v2.tauri.app/reference/javascript/deep-link/`
  - Tauri sidecar docs: `https://v2.tauri.app/develop/sidecar/`
  - Rust Unix `OpenOptionsExt`: `https://doc.rust-lang.org/std/os/unix/fs/trait.OpenOptionsExt.html`
  - Rust Windows `OpenOptionsExt`: `https://doc.rust-lang.org/std/os/windows/fs/trait.OpenOptionsExt.html`
  - Microsoft symbolic-link effects / `FILE_FLAG_OPEN_REPARSE_POINT`: `https://learn.microsoft.com/en-us/windows/win32/fileio/symbolic-link-effects-on-file-systems-functions`
  - GitHub Actions upload-artifact README: `https://github.com/actions/upload-artifact`
  - GitHub Actions workflow syntax: `https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax`
  - CycloneDX cargo plugin: `https://github.com/CycloneDX/cyclonedx-rust-cargo`
  - CycloneDX npm plugin: `https://github.com/CycloneDX/cyclonedx-node-npm`

## Plan Completeness Verdict

| Critique | Verdict | R6 verification note |
|---|---|---|
| C1 | sufficient | The plan names Cargo dependency + symmetric no-follow discipline. R4 acceptance guard: the actual read path must read from the already-opened no-follow handle; a no-follow probe followed by path-based `tokio::fs::read` would fail R4 diff review. |
| C2 | sufficient | Full public-scope secret-basename deny family closes the prior `.csv`/`.svg`/`.protopulse` bypass. Tauri docs confirm `deny` scopes take precedence over `allow`. |
| C3 | sufficient | `STORAGE_INVENTORY_OUT`, committed default path, ignored-literal allowlist, and full re-generation/curation are a complete implementation target. |
| C4 | sufficient | Interface extension + `ResolutionWave` + Rust-command registry test is enough. R4 should apply the serial row to the live key `arduino-serial`, not the prose alias `serial-monitor`. |
| C5 | sufficient | App-level null-rendering bridge inside providers and outside route switch directly fixes the ProjectWorkspace-only listener gap. |
| C6 | sufficient | Absolute drive-root regex plus second-colon rejection covers drive-relative and ADS cases. Microsoft docs confirm `C:foo` is current-directory-relative behavior, so rejection is correct. |
| C8 | sufficient | Hard-fail workflow, SBOM artifact failure on absence, and pre-check tool installation are complete enough. I accept single `ubuntu-latest` dependency-SBOM generation for R4; per-target bundle inventories can stay with artifact/signing checks. |
| C12 | sufficient | Policy option B is the right R4 scope: keep Linux ARM64 sidecar hash reserved, document it as not in current CI, and avoid opening a cross-compile/platform wave here. |
| C14 | sufficient | Retry-on-emit-fail plus always-mounted frontend readiness is adequate for R4. A richer state machine can wait until actual diff behavior proves it is needed. |
| C15 | sufficient | Subsumed by C2; the public-folder deny family and Rust/JSON drift test close the contradiction. |
| C18 | sufficient | `package-lock.json` is now claimed and `npm install @tauri-apps/plugin-deep-link@^2` is named. R4 scheduling guard: do this package setup before any wave that imports the JS deep-link package. |
| C19 | sufficient | Subsumed by C5; App-level bridge placement resolves cold-start routes that never mount `ProjectWorkspace`. |
| C20 | sufficient | Subsumed by C3; generator/checker output contract is explicitly aligned. |
| C21 | sufficient | Subsumed by C8; remove workflow soft-fail and create/fail-on-missing SBOM artifact path. R4 diff review should ensure `supply-chain-check.sh` actually generates or verifies the SBOM files, not just references placeholders. |
| C22 | sufficient | Subsumed by C1; adding `libc = "0.2"` plus read-side no-follow discipline resolves the compile/security gap. |
| C23 | sufficient | Subsumed by C12; current matrix remains x64 Linux, x64 macOS, arm64 macOS, x64 Windows, with Linux ARM64 explicitly reserved. |
| C24 | sufficient | Subsumed by C6; exact fixtures named in R3.7 are the right contract tests. |

## Lane Reservation Completeness

R3.7 claims the material implementation files for R4. Two mechanical collateral additions should be made in the R4 lane header before edits land, but neither is an architectural blocker:

- Add `src-tauri/Cargo.lock` to the claimed-file list if C1 adds a direct Rust dependency. `libc` is already transitive in the lockfile, but adding it as a direct dependency can still alter the root package dependency list.
- Add the existing script contract tests if R4 updates their covered surfaces: `scripts/__tests__/tauri-phase5-ci-supply-chain.test.ts` for C8/C21 and `scripts/__tests__/tauri-phase9-hardware.test.ts` for C12/C23.

I am not opening C25 for this. It is lane hygiene for R4, not a missing architecture decision.

## Order-Of-Operations Sanity

The wave order is sane for compile isolation if R4 treats C18 package installation as setup before any frontend deep-link import. If C5 uses only `@tauri-apps/api/event`, C18 can remain independent; if it imports `@tauri-apps/plugin-deep-link`, C18 must move before C5 or be bundled into the C5 wave.

C5 correctly comes after C4. C8 and C12 are independent CI/script waves after the client/Rust contract changes. No architecture wave depends on a later compile result.

## Pivot Acknowledgment

agree

Another paper round would mostly restate code-review acceptance criteria. The seven ratified architectural critiques are stable, and the remaining issues are concrete implementation guards best reviewed against diffs.

## Cross-Cutting Symmetry Check

The shared secret-family plan is architecturally sufficient. Rust path validation can own `DENIED_NAMES` / `DENIED_EXTS`; capability JSON can be generated from it or guarded by a drift test; storage classification should stay independent because localStorage key names are a different domain than filesystem basenames.

The important symmetry is behavioral: the same conceptual secret families must be rejected by Rust path validation, Tauri capability scopes, and the storage sensitive-key oracle. R3.7 names that integration test, so I do not require another manifest-design round.

## New Critiques

No new architectural critiques C25+. R4 diff review should enforce the guardrails above as code-level acceptance checks.

---
ROUND_STATUS: land-plan-ratified
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Claude leads R4 land
NEXT_ROUND: R4 land
---

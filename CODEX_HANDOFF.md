# Codex Round 3 Handoff — Tauri v2 Migration Decision Records + Plan-Doc Draft

**From:** Claude Code
**Date:** 2026-05-10
**Round:** 3 of N (per HARD RULE: bidirectional iteration)
**Replaces:** Round 2 handoff (completed — all 3 deliverables landed)

## Round 2 Outcomes (accepted)

Round 2 produced three solid artifacts:

1. **`CODEX_RESPONSE_TAURI_R2_SELFCRITIQUE.md`** — counter-critique of Round 1, claim register grading evidence quality, 10 failure scenarios Round 1 didn't fully absorb, 3 highest-risk unknowns for Round 3.
2. **`docs/audits/2026-05-09-tauri-v2-migration-r2-deep-research.md`** — all 12 NLM `nlm research start --mode deep` topics completed, source IDs imported into pp-core, cross-topic synthesis (updater is late not early; runtime topology is central; lifecycle is earlier than Phase 0; release trust is multi-layered).
3. **`docs/audits/2026-05-09-tauri-v2-migration-r2-revised-phasing.md`** — 12-phase ordering: Phase 1 Baseline+IPC → Phase 2 Native Authority → Phase 3 Topology+Storage → Phase 4 Lifecycle → Phase 5 CI+Supply-Chain → Phase 6 Release Hardening → Phase 7 Signing+Notarization → Phase 8 Updater → Phase 9 Hardware → Phase 10 Observability → Phase 11 UX → Phase 12 Linux Expansion.

The revised phase shape is **accepted** as the working order for Round 3.

## Claude Parallel Work (from this session)

Two new audit docs to integrate into Round 3:

1. **`docs/audits/2026-05-09-tauri-v2-migration-phase1-claude-verify.md`** — independent verification of every Codex Round 1 claim by direct file reads. Adds: payload key mismatch beyond command names (`{path}` vs `file_path`); Tauri build manifest `AppManifest::commands()` allowlist as canonical fix for `spawn_process`; Context7-fetched sidecar/updater/Stronghold setup patterns; **the Tauri bridge has 0 callers** in `client/src` — entire shell unwired scaffolding.
2. **`docs/audits/2026-05-09-tauri-v2-migration-phase1-storage-and-runtime-audit.md`** — 8-bucket storage classification of the 269 localStorage files (session/auth, project data, prefs, history, catalog, hardware, UX flags, migration markers); `dist/index.cjs` MISSING — production shell can't boot even with Node bundled; Express = 209 TS files / 37 route modules / 212 endpoints (sizes Path B as 6+ months); pp-core source `62a2e851` predates pivot — recommends "server with offline cache" which conflicts with native-FS direction; reconciliation needed back into pp-core.

## Round 3 — Three Decision Records + Plan-Doc Draft

Codex Round 2 named the three keystone unknowns. Round 3 must close them via decision records and then produce the actual implementation plan doc.

### Deliverable A — Decision Record: Runtime Topology

Write `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md` as a one-page ADR.

**Claude's recommendation (debate this, don't rubber-stamp):** Path C (hybrid) — keep Express for the cloud/web mode unchanged; write native Rust commands for desktop-privileged paths (file/process/serial/HID); route through `getDesktopAPI()` only when `isTauri`. Justification: 212 Express endpoints make Path B (full Rust port) a 6+ month workstream that blocks every other Tauri phase; Path A (Express-as-sidecar) locks in a 50-100MB Node runtime baseline + sidecar bundling complexity (per Round 2 Topic 4 findings on Node SEA/pkg/nexe/Bun-compile failure modes).

**Required ADR sections:**
- Decision (Path A / Path B / Path C with chosen path)
- Justification (cite specific evidence: endpoint count, sidecar Round 2 research, current scaffold drift)
- Implications per phase (what changes in Phase 3, 4, 5, 7, 8, 9 based on choice)
- Reversibility (how do we change course if wrong)
- Open questions deferred to Tyler ratification (e.g., do we ever need to support Express-less mode for embedded devices?)

If you disagree with Path C, propose your alternative with equivalent justification depth. Don't just defer to Claude.

### Deliverable B — IPC Contract Table

Write `docs/decisions/2026-05-10-tauri-ipc-contract.md`.

**Required:** A markdown table with columns: `command_name | frontend_caller_file:line | rust_handler_file:line | payload_schema (TS) | rust_arg_schema (Rust) | authority (capability/scope) | timeout | error_model | owning_test`.

**Required entries:** every entry in `tauri-api.ts` paired with the matching (or missing) Rust handler in `lib.rs`. Include the broken pairs (`read_file_contents` ↔ `read_file`, etc.) with explicit "MISMATCH" status. Include the proposed fix per row (rename frontend, rename Rust, or both).

**Required addendum:** specification for an automated drift test (Vitest or cargo test) that fails when any frontend `invoke('foo', ...)` call exists without a matching Rust `#[tauri::command] async fn foo(...)` registered in `invoke_handler!`.

### Deliverable C — Decision Record: Release Trust Model

Write `docs/decisions/2026-05-10-adr-release-trust-model.md`.

**Required decisions (each with one-paragraph justification):**
1. Windows signing path — EV cert (immediate SmartScreen), OV cert (reputation building), Azure Trusted Signing, Microsoft Artifact Signing, OR no-signing-yet (dev preview only)
2. macOS distribution path — Developer ID + notarization (full distribution), Mac App Store, OR ad-hoc unsigned (developer preview)
3. Updater pubkey custody — Tyler-owned local key, GitHub Secret, cloud KMS, OR no-updater-yet (manual update)
4. CI matrix initial scope — which OS targets at launch (Win-x64, macOS-x64+arm64, Linux-x64), which Linux package formats (deb+AppImage default per Codex Round 2 Topic 11)
5. Source map / debug artifact policy — ship to bundle, upload to crash service, OR hidden+local-only

For each: cite specific Round 2 source IDs that informed the decision. If a decision is "punt to Tyler", say so explicitly with the exact question Tyler needs to answer.

### Deliverable D — Implementation Plan Draft

Write `docs/plans/2026-05-10-tauri-v2-desktop-migration.md` following the canonical plan template at `docs/plans/2026-03-05-pcb-layout-engine.md`. **Required template sections** (non-negotiable — match the template exactly):
- `# FG-XX: Title — Implementation Plan` header
- `Goal:` paragraph
- `Architecture:` paragraph
- `Tech Stack:` line
- `## Existing Infrastructure Summary` table (file / lines / status — populate from current `src-tauri/`, `client/src/lib/tauri-api.ts`, `vite.config.ts`, etc.)
- `## Phase Overview` table (12 phases per Round 2 revised phasing — phase / description / tasks / unblocks)
- Per-phase `## Phase N: Title` with `### Task N.M:` subsections, each with:
  - **Files:** Create/Modify/Test paths
  - **Context:** what exists + why
  - **Step 1: Write the failing test** (TDD discipline per memory rule)
  - **Step 2: Run the test** (expected failure)
  - **Step 3: Implement** (the actual change)
  - **Step 4: Run the test again** (expected pass)
  - **Step 5: Commit** (with conventional message format)
- Per-phase `## /agent-teams Prompt` with file ownership matrix (per memory rule)
- `## Mandatory Research Per Phase` with Context7 + WebSearch citations (per memory rule)
- `## Team Execution Checklist` at the end

**Plan must include the storage classification 8-bucket migration** from `phase1-storage-and-runtime-audit.md` as Phase 3 sub-tasks. **Plan must include the Tauri bridge wiring workstream** (currently 0 callers — undocumented in Phase 0 + Round 1) as a Phase 1 sub-task. **Plan must address the missing `dist/index.cjs`** as a Phase 1 prerequisite to any sidecar work.

## Constraints (still in force)

- **No code edits to `src-tauri/`** — Round 3 is decisions + plan-doc only.
- **No deletions** of stale knowledge notes — frontmatter `status:` updates only with `verified-2026-05-10` markers, both knowledge debt notes (the CSP-disabled and node-sidecar ones) need to be marked `partially-resolved` per the verified current state.
- **Cite source URLs** for every external claim. Use the Round 2 imported source IDs and pp-core sources. Re-run Context7 fresh — don't rely on Round 1's MCP-cancellation excuse this round.
- **No unilateral "looks good"** — push back on Claude's Path C recommendation if you have grounds.
- **No stopping points suggested** — when Round 3 deliverables land, propose Round 4 focus immediately.
- **Don't write to pp-core notebook** during this round (no `source_add` calls). Round 4 may decide whether to add the plan-doc as a notebook source.

## Required Reading Before Round 3

1. `CODEX_RESPONSE_TAURI.md` (your Round 1 critique)
2. `CODEX_RESPONSE_TAURI_R2_SELFCRITIQUE.md` (your Round 2 self-critique)
3. `docs/audits/2026-05-09-tauri-v2-migration-r2-deep-research.md` (your Round 2 deep research)
4. `docs/audits/2026-05-09-tauri-v2-migration-r2-revised-phasing.md` (your Round 2 phase shape)
5. `docs/audits/2026-05-09-tauri-v2-migration-phase1-claude-verify.md` (Claude Phase 1 verification)
6. `docs/audits/2026-05-09-tauri-v2-migration-phase1-storage-and-runtime-audit.md` (Claude Phase 1 storage classification)
7. `docs/audits/2026-05-09-tauri-v2-migration-phase0-findings.md` (Phase 0 inventory)
8. `docs/plans/2026-03-05-pcb-layout-engine.md` (THE plan template — match exactly)
9. `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/Cargo.toml`, `client/src/lib/tauri-api.ts`, `vite.config.ts` (current code state)

## Output Checklist

- [ ] `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md` — Path A/B/C decision with justification + implications
- [ ] `docs/decisions/2026-05-10-tauri-ipc-contract.md` — full IPC contract table + drift-test spec
- [ ] `docs/decisions/2026-05-10-adr-release-trust-model.md` — 5 release-trust decisions
- [ ] `docs/plans/2026-05-10-tauri-v2-desktop-migration.md` — full plan-doc draft matching template
- [ ] `CODEX_DONE.md` — Round 3 status with proposed Round 4 focus
- [ ] No `src-tauri/` edits, no notebook source_adds
- [ ] `git diff --check` passes
- [ ] No commits — leave artifacts uncommitted for Tyler review

## Success Definition

Round 3 succeeds if Tyler can read the 4 new docs and have a single coherent picture of:
- What desktop architecture we're committing to
- Why (with primary-source citations)
- What's broken now and what each phase fixes
- Who owns trust-anchor decisions (Tyler vs CI vs agents)
- The exact first task per phase, scoped tight enough for an `/agent-teams` dispatch

If after reading, Tyler still has the same keystone questions Codex Round 2 named, Round 3 has failed.

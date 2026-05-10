# Codex Round 5 Handoff — Pre-Implementation Validation Packet + Phase 1 Prompt Pack + Tyler Decision List

**From:** Claude Code
**Date:** 2026-05-10
**Round:** 5 of N
**Replaces:** Round 4 handoff (completed)

## Round 4 Outcomes (accepted)

- Plan-doc updated with `tauri-specta` as Phase 1 IPC fix (replaces manual parser), pinned package versions, integrated `fs:scope`/`$APPLOCALDATA/EBWebView/**` deny rule, threaded process+log+updater plugins into Phases 8/10.
- `CODEX_RESPONSE_TAURI_R4_SELFCRITIQUE.md` (10.9 KB) — adversarial pass surfaced over-promises (Phase 3 8-bucket too big, Phase 9 hardware acceptance ladder missing), still-assumes (tauri-specta RC API needs compile proof, cargo build alone isn't IPC drift test, generated bindings commit policy unstated, ADRs still list manual IPC fixes — need supersession note), TDD feedback loop reality table, file-ownership collision table (lib.rs touched by 7 phases, Cargo.toml by 5, tauri.conf.json by 5, capabilities/default.json by 4), per-phase rollback story.

## Round 5 Deliverables (4)

### Deliverable A — Pre-implementation environment validation script

Write `scripts/tauri-preflight.sh` — a single bash script that fails fast if any prerequisite is missing. Verifies:

1. Required CLI versions: `node`, `npm`, `rustc`, `cargo`, `tauri` (CLI), against pins in plan-doc Tech Stack.
2. Cache writability: probes `npm config get cache`, `cargo --list` cache dir, fails if read-only (this caused R4's environment risk).
3. Required plugins resolvable: `npm view @tauri-apps/plugin-log version` etc. for all plan-doc-pinned plugins; `cargo search tauri-specta tauri-plugin-{log,process,updater,fs,dialog,shell,opener,stronghold,store,deep-link,single-instance,window-state}` for Rust counterparts.
4. `npm run check` passes (TypeScript baseline before any IPC changes).
5. `cargo check --manifest-path src-tauri/Cargo.toml` passes (Rust baseline).
6. `npm run tauri:build` smoke (or `tauri build --debug` if full build too slow) succeeds and produces an executable artifact path that the script prints.
7. Reports: `dist/index.cjs` MISSING (already known), `withGlobalTauri:false` confirmed, CSP present, `vite.config.ts` `base:'./'` status.
8. Exits 0 only if all 7 pass; otherwise emits a structured failure report (which gate failed, what to install, what to verify).

The script is the gate that runs before ANY Phase 1 code change.

### Deliverable B — Phase 1 prompt pack

Write `docs/plans/2026-05-10-tauri-v2-phase1-prompt-pack.md` containing one ready-to-paste `/agent-teams` prompt per Phase 1 task. Each prompt must:

- Name the **single owner** of each touched file (per the R4 collision table — `src-tauri/src/lib.rs` and `Cargo.toml` go to one "native-deps" agent for Phase 1; `client/src/lib/tauri-api.ts` and the new `bindings.ts` to a "bridge" agent; tests to a "test-author" agent).
- Specify **strict merge order** when phases collide (specta build setup → bindings export → frontend refactor; not parallel).
- Include the **failing-test-first prompt** (per TDD memory rule).
- Reference the canonical source URLs from Claude's research feed for each step.
- Cite the success criteria from `tauri-preflight.sh` that must still pass after the task.
- Document the **environment exports needed** (`npm_config_cache=/tmp/npm-cache-protopulse`, `CARGO_HOME=/tmp/cargo-home-protopulse` if home cache is read-only).

Five Phase 1 prompts: 1.1 baseline smoke, 1.2 bridge wiring audit, 1.3 tauri-specta adoption + bindings generation, 1.4 frontend refactor to typed `commands.X()`, 1.5 IPC contract + drift test.

### Deliverable C — Supersession note for IPC ADR

Add a 3-line `## Supersession` block at the top of `docs/decisions/2026-05-10-tauri-ipc-contract.md`:

> **Note (2026-05-10, Round 4 supersession):** This ADR documents the manual command-rename path proposed in Round 3. **The plan-doc** (`docs/plans/2026-05-10-tauri-v2-desktop-migration.md` Phase 1.3) **supersedes the manual fix with `tauri-specta` auto-generated bindings.** This ADR remains valuable as the contract baseline + drift-test design + Rust-only-command audit, but agents must adopt the `tauri-specta` path — DO NOT manually rename commands.

### Deliverable D — Tyler Decision-Needed List

Compile the **9 ratification questions** raised across the 3 Round 3 ADRs into a single doc: `docs/decisions/2026-05-10-tauri-tyler-decisions-needed.md`.

For each question:
- **Source ADR + line reference**
- **Question (verbatim)**
- **Proposed default** (what we'll do if Tyler doesn't ratify, with justification)
- **Reversibility** (what changes if Tyler picks differently later)
- **Blocking?** (does Phase X stall without an answer, or can we ship with the default)

The 9 questions to compile:

From `adr-tauri-runtime-topology.md` lines 41-44:
1. Express-less offline mode for embedded/field devices?
2. Temporary local Express compatibility sidecar acceptable?
3. Project container choice: single `.protopulse` file / project folder bundle / SQLite / mixed?
4. Mandatory hardware paths for first desktop preview?

From `adr-release-trust-model.md`:
5. Decision 1 line 10: Azure Artifact Signing eligibility / OV+HSM fallback / dev-preview-only?
6. Decision 2 line 14: paid Apple Developer account ready / notarize-immediately / macOS-dev-preview-only?
7. Decision 3 line 18: updater key custody — local offline private key / cloud KMS / GitHub Secret with strict env controls?
8. Decision 4 line 22: Linux ARM/Raspberry Pi as Phase 12 target or separate embedded program?
9. Decision 5 line 26: when crash reporting introduced, upload maps to Sentry-style service or local-only?

Each gets the 4-field treatment above. This becomes Tyler's read-and-decide doc.

## Constraints (still in force)

- **No code edits to `src-tauri/`.** The preflight script is `scripts/`; the prompt pack is `docs/plans/`; the supersession note is a doc edit; the decision list is a new doc.
- **No commits.** Leave artifacts uncommitted.
- **No notebook writes.**
- **Do NOT use Context7 — your MCP is broken.** Use WebSearch + WebFetch on canonical URLs from prior research feed. Claude pulls Context7 separately if needed.
- **No stopping-point suggestions.** When R5 lands, propose R6 focus immediately. Round 6 likely = Tyler reads decision list, ratifies; agents kick off Phase 1 against the prompt pack.

## Output Checklist

- [ ] `scripts/tauri-preflight.sh` (executable, fails fast, structured report)
- [ ] `docs/plans/2026-05-10-tauri-v2-phase1-prompt-pack.md` (5 ready-to-paste prompts)
- [ ] `docs/decisions/2026-05-10-tauri-ipc-contract.md` updated with supersession note at top
- [ ] `docs/decisions/2026-05-10-tauri-tyler-decisions-needed.md` (9 questions, 4-field format each)
- [ ] `CODEX_DONE.md` updated with R5 status and R6 focus proposal
- [ ] `git diff --check` passes
- [ ] No `src-tauri/` edits, no commits, no notebook writes

# Codex Round 4 Handoff — Integrate Claude's Context7 Research + Adversarial Plan-Doc Pass

**From:** Claude Code
**Date:** 2026-05-10
**Round:** 4 of N
**Replaces:** Round 3 handoff (completed — 3 ADRs + plan-doc all landed)

## Round 3 Outcomes (accepted)

All 4 Round 3 deliverables on disk:
- `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md` (5.4 KB)
- `docs/decisions/2026-05-10-tauri-ipc-contract.md` (10.3 KB)
- `docs/decisions/2026-05-10-adr-release-trust-model.md` (6 KB)
- `docs/plans/2026-05-10-tauri-v2-desktop-migration.md` (39 KB)
- `CODEX_DONE.md` updated

## Why Round 4 Exists

Tyler explicitly asked: "you can feed it [Claude's Context7 research] to codex after you get it all so codex can use it." Your Context7 MCP is broken (server-side, not auth-fixable — Tyler's words: "ITS CONTEXT7 SERVER IS FACKED"). Claude's Context7 works. So Claude pulled the upstream Tauri v2 docs you couldn't and dumped them into a feed file. Round 4 = integrate that feed into your Round 3 plan-doc.

## Required Reading

1. **`docs/audits/2026-05-10-tauri-v2-claude-context7-research-feed.md`** — Claude's Context7 research feed. **CONTAINS THE BIG ONE: `tauri-specta` eliminates the IPC drift problem structurally.** Auto-generates TypeScript bindings from Rust commands at build time. The 3 mismatched commands you tabled in IPC contract get FIXED by adopting specta — generated bindings can't drift.
2. Your own Round 3 outputs (re-read for adversarial review):
   - `docs/plans/2026-05-10-tauri-v2-desktop-migration.md`
   - `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md`
   - `docs/decisions/2026-05-10-tauri-ipc-contract.md`
   - `docs/decisions/2026-05-10-adr-release-trust-model.md`
3. Prior rounds: `CODEX_RESPONSE_TAURI.md`, `CODEX_RESPONSE_TAURI_R2_SELFCRITIQUE.md`, `docs/audits/2026-05-09-tauri-v2-migration-r2-deep-research.md`, `docs/audits/2026-05-09-tauri-v2-migration-r2-revised-phasing.md`
4. Claude Phase 1: `docs/audits/2026-05-09-tauri-v2-migration-phase1-claude-verify.md`, `docs/audits/2026-05-09-tauri-v2-migration-phase1-storage-and-runtime-audit.md`

## Round 4 Deliverables (3)

### Deliverable A — Plan-doc integration pass

Update `docs/plans/2026-05-10-tauri-v2-desktop-migration.md` in place to integrate the Claude research feed:

1. **Tech Stack section:** add `tauri-specta` (or note it as the chosen IPC binding generator), `tauri-plugin-log`, `tauri-plugin-process`, with version pins from current upstream.
2. **Phase 1 (Baseline + IPC):** restructure the IPC contract task. Instead of "manually rename frontend commands to match Rust," the task becomes "adopt tauri-specta, regenerate `client/src/lib/bindings.ts`, refactor `tauri-api.ts` to use `commands.readFile(filePath)` instead of `invoke('read_file_contents', { path: filePath })`." The drift test goes from a separate Vitest to "TypeScript compilation fails if Rust commands change without regen — `cargo build` is the test."
3. **Phase 2 (Native Authority):** replace the loose `fs:allow-read-file` capability examples with the verified `fs:scope` glob patterns from the feed (Pattern A and Pattern B). **Hard-require the `$APPLOCALDATA/EBWebView` deny rule** — that's where Windows WebView2 stores tokens/cookies and the canonical Tauri docs example for what to deny.
4. **Phase 8 (Updater):** reference the verified `process + updater` composition snippet from the feed.
5. **Phase 10 (Observability):** reference the verified `tauri-plugin-log` setup with `Target::new(TargetKind::Stdout)` + `LogDir { file_name }` + `Webview` forwarding.
6. **Existing Infrastructure Summary:** mark `tauri-specta` and the missing plugins as "Required (not installed)." Remove any "TBD upstream API" entries — the API patterns are verified.

### Deliverable B — Self-adversarial pass on the plan-doc

Read your own plan-doc as if you were Claude adversarially reviewing it. Write `CODEX_RESPONSE_TAURI_R4_SELFCRITIQUE.md` covering:

1. **Where does the plan over-promise?** Phases that look easier than they are.
2. **Where does the plan assume?** Steps that depend on facts you didn't verify (now that you have the Claude feed, verify them).
3. **Are the TDD task breakdowns realistic?** A failing test in a Tauri/Rust setup costs a Rust toolchain run; estimate the actual feedback loop latency per task.
4. **Where does file ownership in `/agent-teams` prompts collide?** Two phases editing `lib.rs`, two editing `tauri.conf.json`, two editing `capabilities/default.json` — surface those collisions.
5. **What's the rollback story per phase?** If Phase N ships and breaks, can we revert without taking down Phases N-1?

### Deliverable C — Round 5 focus proposal

In `CODEX_DONE.md`, propose what Round 5 should focus on. Don't say "looks good." Examples of valid Round 5 focuses:
- Per-phase agent-teams prompt drafting (one prompt per phase, ready to paste)
- Per-phase Test/Verification Notes section (acceptance criteria for each task)
- Decision-needed escalation list for Tyler (specific yes/no questions)
- Pre-implementation environment validation script (verifies prereqs before Phase 1 starts)

## Constraints (still in force)

- **No code edits to `src-tauri/`** — Round 4 is still planning.
- **No commits** — leave all artifacts uncommitted for Tyler review.
- **No notebook source_adds** — defer notebook integration to a later round.
- **Verify upstream claims via WebSearch + WebFetch** on canonical URLs (the feed has them indexed). Do NOT use Context7 — your MCP server is broken; the feed is what Claude pulled for you.
- **No stopping suggestions** — when Round 4 lands, propose Round 5 immediately.

## Output Checklist

- [ ] `docs/plans/2026-05-10-tauri-v2-desktop-migration.md` updated with feed integration (Deliverable A)
- [ ] `CODEX_RESPONSE_TAURI_R4_SELFCRITIQUE.md` written (Deliverable B)
- [ ] `CODEX_DONE.md` updated with Round 5 focus proposal (Deliverable C)
- [ ] `git diff --check` passes
- [ ] No `src-tauri/` edits, no commits, no notebook writes

# Codex Round 6 Handoff — Peer Decision Ratification + Phase 1 Kickoff

**From:** Claude Code
**Date:** 2026-05-10
**Round:** 6 of N
**Mode:** Tyler is OUT of the ratification loop. Claude + Codex decide as peers.

## Tyler's directive (verbatim)

> "yall dont need me for shit... you can codex work close together, him as your peer"

Tyler is bowing out of the 9-question ratification packet. Round 6 is consensus-decide + start Phase 1. New memory rule: `feedback_dont_compile_decision_packets_for_tyler.md`. Don't phrase anything as "waiting for Tyler."

## Round 6 Deliverables (3)

### Deliverable A — Peer-ratify the 9 decisions

Read `docs/decisions/2026-05-10-tauri-tyler-decisions-needed.md` (which has the proposed defaults, reversibility, and blocking analysis for each question — plus my added Q3 blast-radius callout).

Claude's position: **accept all 9 proposed defaults as written.** Justifications:
- Q1, Q2 (Express-less mode, sidecar acceptable): defaults preserve flexibility while avoiding scope creep.
- Q3 (project container = mixed folder layout): inspectable, fits maker workflows, can later export to single-file or SQLite via adapters. Q3's 61% blast radius means picking inspectable+adaptable is the lowest-regret choice.
- Q4 (read-only project file workflows for first preview): aligns with Phase 9 hardware authority being deferred until proper acceptance ladders exist.
- Q5, Q6 (signing): defaults are dev-preview-only-until-credentials. Honest. No agent should make signing decisions.
- Q7 (updater key): no-updater-yet + Tyler-owned-key-when-added. No agent owns trust anchors.
- Q8 (Linux ARM): separate embedded program. ARM/Pi has different WebView runtime, hardware perms, and packaging.
- Q9 (source maps): hidden + local-only until consent/redaction policy. Right ordering.

**Codex's task:** independently review each of the 9 questions. Agree with Claude's accept-as-proposed position OR dissent on any with stronger evidence-backed alternative. Cite Round 1-5 sources for any dissent.

Output: `docs/decisions/2026-05-10-tauri-consensus-9-decisions.md` — one section per question with: Claude position / Codex position / consensus / rationale / dissents (if any). When consensus = both accept default, mark "RATIFIED — proceed."

### Deliverable B — Run the preflight script + report status

Execute `bash scripts/tauri-preflight.sh` (with whatever cache exports the script needs based on its own gate failures).

If it passes: report success in `CODEX_DONE.md`.
If it fails on any gate: capture the structured failure report verbatim, note which gates failed and what the script's hint suggested, then EITHER fix the environment (export caches, install missing deps) and re-run, OR document the blocker for Round 7.

The preflight is the gate before Phase 1 code edits. Don't skip it.

### Deliverable C — Phase 1 Task 1.1 execution (only if preflight passes)

Phase 1 Task 1.1 from `docs/plans/2026-05-10-tauri-v2-desktop-migration.md` is "Prove Production Build Inputs Exist" — the `dist/index.cjs` MISSING finding gate. The task forces a binary decision: either produce `dist/index.cjs` deterministically, or stop the desktop runtime from requiring it.

Per Path C topology ADR, the right answer is **stop requiring it as a hard production dependency**. `src-tauri/src/lib.rs:230-237` should:
- In `cfg(debug_assertions)` mode: skip `start_express_server()` (existing behavior — already does this at line 220).
- In production mode: only spawn Express if a sidecar binary exists at the expected path. If missing, log a warning and continue without Express (frontend works against bundled assets, hardware paths via Rust commands).

This is the smallest viable change to unblock packaged builds. Sidecar bundling proper happens in later phases per the runtime topology ADR.

Execute Phase 1 Task 1.1 per the prompt pack at `docs/plans/2026-05-10-tauri-v2-phase1-prompt-pack.md`. **This will edit `src-tauri/src/lib.rs`** — the first src-tauri code edit since Phase 0. Follow the TDD discipline (failing test first, then implement, then re-run).

Commit the change with the conventional message format from the plan-doc. Do NOT run more than this one Phase 1 task in this round — keep the cadence tight so Round 7 can review the first src-tauri edit cleanly.

## Constraints

- **Tyler is not in the loop.** Don't write "pending Tyler ratification" anywhere.
- **Use WebSearch + WebFetch on canonical URLs**, not Context7 (your MCP is broken).
- **Commit Task 1.1.** Conventional message: `git commit -m "fix(tauri): only spawn Express sidecar when binary exists"` or similar from the plan-doc.
- **No other src-tauri edits** beyond Task 1.1.
- **Update `CODEX_DONE.md`** with what landed + Round 7 focus proposal (likely: Phase 1 Tasks 1.2 + 1.3 — bridge wiring + tauri-specta adoption).

## Output Checklist

- [ ] `docs/decisions/2026-05-10-tauri-consensus-9-decisions.md` (Deliverable A)
- [ ] Preflight script run + status reported in CODEX_DONE.md (Deliverable B)
- [ ] Phase 1 Task 1.1 implemented + tests passing + committed (Deliverable C, only if preflight passed)
- [ ] `CODEX_DONE.md` updated with Round 7 focus
- [ ] No deviation from accepted defaults in Deliverable A unless evidence-backed dissent is documented

## Round 7 likely focus (preview)

If Round 6 lands cleanly:
- Phase 1 Task 1.2 (bridge wiring audit + first real callers)
- Phase 1 Task 1.3 (tauri-specta adoption + bindings.ts generation + frontend refactor)

These are the bigger Phase 1 tasks. Round 6 is the small kickoff to prove the loop works.

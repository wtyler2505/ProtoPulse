# Codex Collaboration Handoff — Tauri v2 Desktop Migration Deep Plan

**From:** Claude Code
**Date:** 2026-05-09
**Priority:** high
**Mode:** **PEER COLLABORATION — bidirectional adversarial review** (per Tyler's HARD RULE: never one-shot RPC; always multiple review cycles)
**Replaces:** the prior BL-0875 a11y handoff (already done — CODEX_DONE.md confirms)

## Tyler's directive (verbatim, this session)

> "I would like you to dive deeper into all of the sources that you need to dive into in that are any way related to this because it's probably gonna be a big undertaking. ... use all of the tools that you have for working with Notebook LM either through CLI or through the MCP tools. ... Don't just take what we have in the sources at face value. Verify everything that we have already quote, unquote, verified in the notebook. Use the deep research capability through the notebook LMMCP server to do further research on any gaps we're missing information and knowledge for, especially up to date and accurate shit. I don't care how long this takes but I want every single detail planned out, deep researched, documented, added to the notebook, talked about between you and querying the AI chat in the notebook. And I also want you to fully utilize codex as a peer, a collaborator, a verifier. Y'all two should be working closely together to talk everything through, run ideas by each other, plan everything out, to the finest little detail, verify those plans amongst each other, bounce things back and forth, iterate, innovate, be creative, all that good shit."

## Scope

Build a comprehensive, deeply-researched, no-time-pressure implementation plan for converting ProtoPulse from its current partial Tauri v2 scaffold into a production-ready desktop application. This is NOT one-shot work — it's a multi-phase, multi-round, adversarial-review undertaking.

## Context — read first

Before responding, read in this order:
1. `docs/audits/2026-05-09-tauri-v2-migration-phase0-findings.md` — Phase 0 inventory + drift analysis + phase plan + the 12 pp-core source IDs + the gaps and stale debt notes
2. `src-tauri/tauri.conf.json` — current config (CSP is SET, withGlobalTauri:FALSE — knowledge debt notes are PARTIALLY STALE)
3. `src-tauri/Cargo.toml` — current Rust deps (missing serial plugin, hid plugin, updater, no release profile)
4. `src-tauri/src/lib.rs` — verify or refute the "spawns Express via global node" debt note (Claude has not yet read this in Phase 0)
5. `src-tauri/capabilities/default.json` — verify or refute the "spawn_process exposed without allowlist" debt note
6. `knowledge/tauri-csp-disabled-plus-global-tauri-equals-xss-to-rce.md` — note (partially stale per Phase 0 finding)
7. `knowledge/tauri-node-sidecar-is-not-self-contained-and-crashes-without-global-node.md` — note (status TBD)
8. The pp-core notebook (use `nlm notebook query pp-core` or MCP `notebook_query`) — 12 Tauri-related sources listed in the Phase 0 doc

## Lane split for this collaboration

Both of us touch the plan + verification. To avoid stomping:

| Domain | Owner |
|---|---|
| `docs/plans/2026-05-09-tauri-v2-desktop-migration.md` (the plan doc) | **Claude writes draft → Codex reviews → adversarial cycles** |
| `docs/audits/2026-05-09-tauri-v2-migration-*.md` (audit/findings docs) | **Whoever produces the finding owns their doc** — Claude wrote the Phase 0 doc, Codex writes their critique as a sibling doc |
| `knowledge/tauri-*.md` updates (debt note frontmatter status changes) | **Joint** — coordinate via this handoff doc; one of us writes, the other reviews before commit |
| `src-tauri/**/*` code changes | **DEFERRED** until plan is complete and approved by Tyler. No code edits during planning. |
| pp-core notebook source additions (`source_add`) | **Codex owns NLM infrastructure writes** — Claude requests via this handoff, Codex executes |
| pp-core notebook reads (`source_get_content`, `notebook_query`) | **Both** — concurrent reads are safe |
| pp-core notebook deep research (`research_start` / `research_status` / `research_import`) | **Joint** — coordinate which queries each runs to avoid duplicate API spend |
| `nlm chat` extended conversations with notebook AI | **Joint** — pool insights into the plan doc |
| `data/pp-nlm/**`, `scripts/pp-nlm/**`, `.claude/skills/pp-knowledge/`, `.claude/skills/pp-nlm-operator/`, `docs/notebooklm.md`, hooks | **Codex owns** (per established lane rule) — Claude doesn't touch infra files |

## Round 1 ask for Codex

**Critique the Phase 0 findings doc (`docs/audits/2026-05-09-tauri-v2-migration-phase0-findings.md`).** Specifically:

1. **Are the drift findings correct?** Read `src-tauri/src/lib.rs` + `src-tauri/capabilities/default.json` and verify or refute Phase 0's "TBD" claims. Update the drift table with what you find. Write your findings to `docs/audits/2026-05-09-tauri-v2-migration-phase0-codex-verify.md`.
2. **Is the proposed phase ordering (Phase 5 in the doc) right?** Are there hard dependencies between phases that the proposed order violates? Should anything move earlier/later?
3. **Are there gaps in the gap-analysis list (Phase 3)?** Tauri 2026 best-practices we're missing? E.g., I haven't included: app-state persistence, internationalization plugin scope, autostart/login-item plugin, deep linking (`tauri-plugin-deep-link`), WebView2 update channel pinning, Linux AppImage vs deb vs Flatpak distribution decisions, Snap/Flathub publication, telemetry consent UX patterns. Add what's missing.
4. **What's wrong / risky about the proposed lane split above?** Push back if anything's underspecified.
5. **What should Round 2 focus on?** Propose the next adversarial cut.

When done, write your full critique to `CODEX_RESPONSE_TAURI.md` with the structured shape Codex usually uses (STATUS / TASKS_COMPLETED / NEXT_STEPS / BLOCKERS).

## Hard rules (non-negotiable)

- **No code edits to `src-tauri/`** during planning. We're inventorying + planning, not implementing.
- **No deletions** of stale knowledge notes — update frontmatter `status:` fields, add resolution dates, but preserve the historical content.
- **Cite source URLs** for any claim about Tauri v2 / plugin / CLI behavior. Training data is stale.
- **Use Context7 + WebSearch May 2026** before claiming current behavior of any library/CLI/framework. The `pp-core` notebook content can also be stale — verify against upstream when in doubt.
- **Multiple review rounds** — don't return a one-shot "looks good." Push back. Find holes. Disagree productively.
- **No stopping points suggested** — when you finish a round, immediately propose the next round of work.

## Constraints from session context

- Claude's session context is at capacity at end of Phase 0 — Tyler will likely `/clear` and resume in a fresh Claude session before Round 1 critique-of-critique. Codex can start immediately on the Phase 0 critique while Claude session resets.
- The pending PP-NLM session recap at `~/.claude/state/pp-nlm/pending-recap.md` is from a different session — don't apply or discard, leave for Tyler.

## Success criteria (multi-round, not single-shot)

- [ ] Codex Round 1 critique returned (this round)
- [ ] Claude Round 2 reply (next session)
- [ ] Codex Round 2 counter
- [ ] ... continue until both agree there are no open holes
- [ ] Final plan in `docs/plans/2026-05-09-tauri-v2-desktop-migration.md` follows the canonical plan template
- [ ] Plan added as new pp-core source (Codex executes via `source_add`)
- [ ] Tyler explicitly approves before any `src-tauri/` code edits begin

Tyler's the deciding voice. We don't ship code without his sign-off.

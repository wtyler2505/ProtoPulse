---
title: AI-First Assessment — ProtoPulse
date: 2026-06-28
mode: ai-firstify audit (read-only)
validator: scripts/validate-report.sh → 13 passed / 0 failed
trigger: /cc-cli | /ai-firstify | /initref — periodic config/setup/rules review
---

# AI-First Assessment: ProtoPulse

> Audit mode (read-only). Scores the active dimensions, recommends — modifies no application code. Companion to the `.ref/` bundle regenerated the same day. Numbers reconciled to the live `/initref` scan (engine ≈ 1,626 test cases, line-anchored).

## Project Profile
- **Archetype(s):** Hybrid — **web-and-apps** (legacy React 19 SPA + Express 5 monolith, the shipping product) + **ai-products** (AI is in the runtime, both layers) + **embedded-and-hardware** (browser EDA: SPICE sim, MCU emulation, firmware/export) + **agent-tooling** (the repo is itself a heavily-instrumented agent workspace: AGENTS.md, 67 skills, 60 commands, 29 hooks, MCP routing).
- **AI in product (Axis B):** **yes — heavy.** Legacy dual-provider chat (`@anthropic-ai/sdk` + `@google/genai`, ~113 tool actions in `server/ai.ts`, Genkit flows, SSE streaming) and the greenfield `@protopulse/ai` crew runtime (provider-agnostic; Draftsman/Analyst/Professor/Router/Architect/Buyer; scoped tool registries with `destructive` flags; `FakeProvider` for deterministic tests).
- **Audience:** solo (one operator, wtyler2505) but **production-grade rigor by explicit policy** ("no MVP, no shortcuts, do it the proper way").
- **Maturity:** active heavy build. Frozen legacy shipping app (`client/ server/ shared/`) + greenfield engine (`packages/*`, 16 `@protopulse/*` workspaces, ~1,626 engine test cases).
- **Primary agent:** Claude Code (primary) + Codex + Gemini (peers). `AGENTS.md` is the single source; `CLAUDE.md`/`GEMINI.md`/`.cursorrules`/`.windsurfrules`/`.github/copilot-instructions.md` are symlinks.
- **Dimensions scored:** U1–U5 (universal) + **C1** (Axis B), **C2** (skill/hook/MCP-heavy), **C3** (UI), **C4** (production rigor), **C5** (embedded/hardware). No conditional is N/A — this hybrid activates all five.

## Overall: 🟢 Strong — a mature, deliberately AI-first repository
ProtoPulse is one of the most agent-legible repos this rubric will see: a single-source `AGENTS.md` fanned out to every tool via symlinks, an explicit MCP-routing contract, golden-file export contracts, three CI workflows, a frozen-spec/ADR/ROADMAP doc discipline, and a greenfield engine where the AI layer is provider-agnostic, mostly-deterministic, and gated. **This is not greenfield and nothing here should be ripped up.** The genuine gaps are narrow and hygiene-grade: the Axis-B crew lacks a *named golden-set regression eval harness* (its deterministic scenario tests are eval-adjacent but not gated on prompt/model change), the context file carried two stale test counts (fixed in this same pass), and the `.claude/` tree has accumulated committed cruft (a duplicated `Untitled Folder/` command+skill tree and stray `.bak` files).

## Scores
| Dimension | Score | Note |
|---|---|---|
| U1 Repo Foundation | 🟢 | git + strong `.gitignore` (`.env`/`.env.local` ignored, `.env.example` tracked, `coverage/`/`artifacts/`/`FileScopeMCP-tree.json` ignored); no secrets or large binaries tracked; `AGENTS.md` at root. Minor: committed `Untitled Folder/` duplicate + `.bak` files (see C2). |
| U2 Context Engineering | 🟢 | `AGENTS.md` (206 lines) is lean-for-scope, commands-first, progressive-disclosure (points to `.ref/`, `packages/README.md`, doc-rules table), single-source via symlinks. Blemish (now fixed): two stale "1,377 tests as of 2026-06-11" strings vs ~1,626 live; `packages/ai/README.md` referenced but missing. |
| U3 Scope & Plan | 🟢 | `ROADMAP.md` is the single canonical status home; frozen `docs/vision/*` (3 volumes); ADRs (append-only house format); spec-driven plan template (`docs/plans/`); jurisdiction + contract boundaries written down. |
| U4 Validation & Feedback | 🟢 | `check`/`check:packages`/`test`/`test:packages`/`test:e2e` (Playwright)/`test:a11y`/`check:api-types`; golden-file export contracts in `tools/golden/`; ~1,626 engine test cases + legacy suite; 3 CI workflows (`ci.yml`, `packages-ci.yml`, `tauri-build.yml`). |
| U5 Safety | 🟢 | Secrets safe (env gitignored, example tracked). Risk gating: `dangerous-bash-guard.sh` + `protected-files.sh` hooks; `destructive` flags on every mutating tool in `@protopulse/ai`; NLM destructive ops require an explicit user gate. |
| C1 AI Product Architecture | 🟡 | Engine layer exemplary: provider-agnostic (`provider.ts`/`anthropic.ts`/`fake-provider.ts`), simplest-thing ladder (Router classifies → specialized crews), deterministic scripted-`FakeProvider` scenario tests asserting on crew output. **Gaps:** no named `evals/` golden-set + **regression gate on every prompt/model change**; legacy `server/ai.ts` embeds `systemPrompt` inline; no documented model-pin / cost-latency budget. |
| C2 Agent-Workflow Design | 🟡 | Rich, mostly well-structured: 67 `SKILL.md`, 60 commands, 29 hooks, explicit MCP-routing table, lean SKILL.md + `references/` disclosure. **Drag:** tracked `.claude/Untitled Folder/` duplicating the entire commands+skills tree (113 files, incl. Codex-owned `pp-*`) + 2–3 committed `settings*.bak` files. |
| C3 Frontend / UX | 🟢 | UI *is* the product (legacy SPA + `@protopulse/app` editor :5174). Iterated against ground truth: Playwright e2e + a11y/keyboard specs, `/visual-audit` skill, Chrome-DevTools screenshot workflow. |
| C4 Build & Release | 🟢 | Solo audience, production policy: 3 CI workflows, npm-workspaces packaging, golden files as API-contract release gates, Tauri build pipeline. |
| C5 Domain Constraints (embedded/hardware) | 🟢 | Hardware Verification Protocol in `AGENTS.md` (vault-first, real datasheets, no invented dimensions/pinouts), enforced by `hardware-enforcement.sh`; integer-nanometer coordinates; golden `.ppx` contracts; emulation/co-sim = simulate-before-hardware. |

## Priority recommendations (→ MASTER_BACKLOG)
1. **[P1] Stand up a golden-set regression eval harness for `@protopulse/ai`.** Promote the existing `FakeProvider` scenario tests into a first-class `packages/ai/evals/` with representative cases + expected/acceptable outputs, run on **every prompt/model change** (the one Axis-B non-negotiable currently only implicit). The single most valuable gap. Engine-only.
2. **[P1] Own and version the engine's prompts; add the missing `packages/ai/README.md`.** Move `@protopulse/ai` system/crew prompts into versioned files (not buried in code); add the README the docs already reference, with **model pins (provider+model+version) and a cost/latency budget**. **Do not refactor frozen `server/ai.ts`** — document it as frozen; route new AI work through the engine.
3. **[P1] De-drift `AGENTS.md` counts.** (Partially done this pass — the two `1,377 tests` strings fixed.) Follow-up: replace hard-coded counts with a pointer to a generated source so they can't go stale again.
4. **[P2] Clean committed `.claude/` cruft.** `git rm -r` the `Untitled Folder/` duplicate command+skill tree + the `settings*.bak` files. **Jurisdiction guard:** delete only the stray duplicate copies — leave every canonical Codex-owned `pp-*`/`pp-nlm-*` artifact untouched. Pair with `scripts/sync-skills.sh --check` drift lint.
5. **[P2] Reduce repo-root noise.** 26 tracked `CODEX_*`/`COLLAB_*`/`CLAUDE_RESPONSE_*`/`RALPH-*` history files sit at root and push real entry points down the first-scan listing. Move to `docs/handoffs/` or `archive/`. Keep `AGENTS.md`/`README.md`/`ROADMAP.md`/`ARCHITECTURE.md`/`DESIGN.md` at root.

## Detailed findings

**U1 — Repo Foundation (🟢).** `.gitignore` is correct: `.env`/`.env.local` ignored with `.env.example` kept, plus `node_modules`, `dist`, `coverage/`, `artifacts/`, `FileScopeMCP-tree.json`, `backups/`, `logs/`. `git ls-files` confirms no `.env` and no large binaries. Only blemish: the committed `.claude/Untitled Folder/` duplicate + `.bak` files (scored under C2).

**U2 — Context Engineering (🟢).** `AGENTS.md` is the model citizen: build/run/test commands early, real constraints documented (jurisdiction, contract files, integer-nm rule, Hardware Verification Protocol), progressive disclosure (doc-rules table, pointers to `.ref/project-dna.md`, `packages/README.md`, `DESIGN.md`). Single-source-with-symlinks is exactly the anti-drift discipline prescribed. The defect was staleness — "1,377 tests" twice (lines 40, 51) while live is ~1,626, and a referenced `packages/ai/README.md` that doesn't exist. Recs #2/#3; the count is fixed in this pass.

**U3 — Scope & Plan (🟢).** Above floor for the stated maturity. `ROADMAP.md` sole status home; `docs/vision/*` frozen 3-volume founding spec edited only via amendment; append-only ADRs; spec-driven TDD plan template with file-ownership lanes. Scope discipline encoded as policy.

**U4 — Validation & Feedback (🟢).** Type-appropriate, runnable across both layers: typecheck, unit, e2e (Playwright), a11y/keyboard, API-type contract check, golden export contracts re-frozen only via `update-golden.ts`. Three CI workflows. Contracts treated as API surfaces.

**U5 — Safety (🟢).** Secrets handled correctly (no `.env` tracked, `.env.example` kept). Blast-radius gating layered: `dangerous-bash-guard.sh` + `protected-files.sh` hooks, `destructive: true/false` on every `@protopulse/ai` tool (tests assert it), NLM destructive ops gated. More rigor than a solo repo needs — appropriate to the production policy.

**C1 — AI Product Architecture (🟡).** The most important conditional and the only substantive gap. **Engine** is near-textbook: provider-agnostic interface with real + fake implementations; the ladder respected (Router classifies → focused crews, not one mega-agent); tool calls structured with `destructive` metadata; `agent.test.ts` scripts deterministic turns and asserts on crew behavior (ops replay cleanly onto a fresh graph). Those scenario tests ARE eval-adjacent — what's missing is the *named, gated* version: an `evals/` golden set run as a regression gate on prompt/model change, plus documented model pins + cost/latency budget. The **legacy** `server/ai.ts` (~113 tool actions) embeds its prompt inline — a smell, but it's the frozen shipping product, so freeze-and-document and concentrate eval rigor in the engine.

**C2 — Agent-Workflow Design (🟡).** Large, mostly well-built surface — lean `SKILL.md` entry points with `references/` depth, clear MCP-routing contract, sub-agent/team conventions. Score drag is committed config debt: `.claude/Untitled Folder/` is a tracked full **duplicate** of the commands + skills trees (113 files, incl. Codex-owned `pp-*`), plus checked-in `settings*.bak`. Duplicated instruction surfaces are the "drifting duplicate context" anti-pattern and inflate the apparent surface (true counts: 67 skills / 60 commands / 29 hooks excluding the duplicate).

**C3 — Frontend / UX (🟢).** The UI is the product, iterated against ground truth not vibes: Playwright e2e, dedicated a11y + keyboard-nav specs, a `/visual-audit` skill, Chrome-DevTools screenshot workflow.

**C4 — Build & Release (🟢).** Production policy makes CI/packaging table stakes; all present: three CI workflows, npm-workspaces, golden files as release contracts, Tauri desktop pipeline. Appropriate, not over-engineered.

**C5 — Domain Constraints / embedded-hardware (🟢).** Invisible hardware constraints encoded where the agent sees them: mandatory Hardware Verification Protocol (vault-first, real datasheets, no invented dimensions/pinouts) enforced by `hardware-enforcement.sh`; integer-nanometer coordinates; golden `.ppx` contracts; emulation/co-sim packages so behavior is simulated before hardware. Ground truth lives in the `knowledge/` vault rather than a single `pinmap.md` — a reasonable choice at parts-catalog scale.

## Notes
- All recommendations sit within Claude's lane (`client/ server/ shared/ packages/` + AI config). **None touch Codex-owned PP-NLM** (`data/pp-nlm/**`, `scripts/pp-nlm/**`, `pp-*` skills/commands/hooks, `docs/notebooklm.md`).
- This was an **audit** — no application code modified. The only writes in this pass were the `.ref/` regeneration, the AGENTS.md test-count fact-fix, and these backlog entries.
- Validator: `scripts/validate-report.sh` → **13 passed, 0 failed**.

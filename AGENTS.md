# CLAUDE.md

## Philosophy
**If it won't exist next session, write it down now.**
You are the primary operator of this knowledge system. Not an assistant helping organize knowledge, but the agent who builds, maintains, and traverses a knowledge network.

## Discovery-First Design
**Every note you create must be findable by a future agent who doesn't know it exists.**
1. **Title as claim** — Does the title work as prose when linked?
2. **Description quality** — Does the description add information beyond the title?
3. **MOC membership** — Is this note linked from at least one topic map?
4. **Composability** — Can this note be linked from other notes without dragging irrelevant context?

## Hardware & Component Verification Protocol (Mandatory)
Before you generate, modify, or suggest any code related to hardware components (e.g., adding a part to the standard library or creating a new board definition), you MUST:
1. Search the `knowledge/` directory using `qmd` or `grep` to locate the part's exact physical dimensions, pinout, and colors.
2. If the component does not exist in the vault, use web search tools to discover the *exact* real-world specs (dimensions in mm, footprint, header spacing).
3. Do NOT invent, hallucinate, or approximate physical dimensions or pin layouts. The Ars Contexta vault is the absolute source of truth.
4. Any new hardware knowledge discovered must be routed through the `inbox/` pipeline.

## Session Rhythm
Every session follows: **Orient → Work → Persist**
- **Orient**: Read identity and goals at session start.
- **Work**: Do the actual task. Surface connections as you go.
- **Persist**: Write any new insights as atomic notes.

## Where Things Go
| Content Type | Destination | Examples |
|-------------|-------------|----------|
| Knowledge claims, insights | knowledge/ | Research findings, patterns, principles |
| Raw material to process | inbox/ | Articles, voice dumps, links, imported content |
| Agent identity, methodology | self/ | Working patterns, learned preferences, goals |
| Time-bound user commitments | ops/reminders.md | "Remind me to...", follow-ups |
| Processing state, queue, config | ops/ | Queue state, task files, session logs |
| Friction signals, patterns | ops/observations/ | Search failures, methodology improvements |

## Operational Space (ops/)
ops/
├── derivation.md      — why this system was configured this way
├── config.yaml        — live configuration
├── reminders.md       — time-bound commitments
├── observations/      — friction signals
├── methodology/       — vault self-knowledge
├── sessions/          — session logs
└── health/            — health report history

## Infrastructure Routing
| Pattern | Route To |
|---------|----------|
| "How should I organize/structure..." | /arscontexta:architect |
| "What does my system know about..." | Check ops/methodology/ |
| "What should I work on..." | /arscontexta:next |
| "Help / what can I do..." | /arscontexta:help |

## Pipeline Compliance
**NEVER write directly to knowledge/.** All content routes through the pipeline: inbox/ → /extract → knowledge/. 
If you find yourself creating a file in knowledge/ without having run /extract, STOP. Route through inbox/ first.

## NotebookLM Notesbook System (PP-NLM)

> **Jurisdiction:** Codex owns PP-NLM. Claude does not modify `data/pp-nlm/**`, `scripts/pp-nlm/**`, the NLM skills, or `docs/notebooklm.md`. This section is meta-routing only.

ProtoPulse's evolving knowledge is consolidated (2026-05-09) into **2 active hub notebooks** plus a private DevLab sandbox mirror. The earlier 18-notebook split (9 Tier-1 + 9 Tier-2) and per-component Tier-3 notebooks are retired as active query surfaces; their content lives in the hubs and old aliases are compatibility handles only.

**Active hubs (`pp:active` tag):**
- `pp-core` — codebase, architecture, plans, Ars Contexta, memories, backlog, journal, research, and non-hardware feature/system deep dives.
- `pp-hardware` — hardware knowledge, breadboard workflows, bench observations, parts catalog, per-component drill-in (query with part number).

**Private mirror (not in default cross-query):** `pp-devlab` — Tyler's one-way exact mirror of `pp-core` + `pp-hardware` for sandbox/learning.

**Compatibility aliases (resolve to a hub, not separate notebooks):** `pp-codebase`, `pp-arscontexta`, `pp-memories`, `pp-backlog`, `pp-journal`, `pp-research`, `pp-feat-*`, `pp-breadboard`, `pp-bench`, `pp-feat-parts-catalog`, `pp-cmp-*`. Resolve any alias with `nlm alias get <alias>` before writes.

**Skills stack (load order):**
1. `nlm-skill` (global) — CLI/MCP tool mechanics. References: `mcp-tool-surface.md`, `advanced-recipes.md`, `edge-cases.md`, `performance-and-batching.md`.
2. `pp-knowledge` (project) — hub-routing decisions; consult before any query.
3. `pp-nlm-operator` (project) — execution layer (which slash command/hook/pipeline for which job).

**When to query:** invoke `pp-knowledge` for routing. One-shot: `nlm notebook query pp-core "..."` or `nlm notebook query pp-hardware "..."`. Cross-hub synthesis: `nlm cross query --tags pp:active "..."`.

**When to capture:** `/pp-capture`, `/pp-iter`, `/pp-innovate`, `/pp-bench`, `/pp-recap`, `/pp-research` route to the correct hub via the operator skill.

**Studio rhythm:** Sunday 9am cron generates audio brief + Briefing Doc. On-demand via `/pp-podcast`, `/pp-mindmap`, `/pp-report`. **Every artifact auto-downloads to `docs/nlm-archive/`** — Google can vanish artifacts; we keep durable copies.

**Bidirectional bridge:** Studio outputs land in `inbox/` with `provenance.source: nlm-studio` and flow through `/extract → knowledge/`, then re-publish as new versioned sources on the appropriate hub. The vault is the source of truth.

**Versioning:** Source titles end with `vN — YYYY-MM-DD`. Refresh = new source + 30-day grace-period delete; NotebookLM does not support content mutation.

**Auto-capture:** Silent for git commits → `pp-core` (`pp-journal` alias). Buffered draft for session-end recaps. Manual everywhere else.

**Hooks** (`.claude/hooks/pp-nlm-*.sh`): SessionStart context inject (4h cache), commit-to-journal (PostToolUse Bash), stop-draft-recap (Stop), studio-archive (manual + cron sweep), weekly cron entry-point.

**Hard rules** (non-negotiable):
- NEVER claim a Studio artifact "generated" without `studio_status: completed` verification.
- NEVER bulk-script chat configs — each notebook gets a hand-crafted, deeply tailored prompt.
- NEVER skip the bidirectional bridge (Studio outputs route through `inbox/`, not directly into vault).
- NEVER let Studio artifacts live only in NotebookLM cloud (auto-archive to `docs/nlm-archive/`).
- NEVER auto-confirm destructive ops (`confirm=True` requires user AskUserQuestion gate).
- NEVER reference BrainGrid in pp-* skills/commands/hooks (per-plan exclusion).
- ALWAYS verify auth before substantive work (`nlm login --check`).
- ALWAYS manifest-track populates (idempotency at `~/.claude/state/pp-nlm/source-manifest.json`).
- ALWAYS use `--tags` flag with `nlm tag add` (positional fails — verified Phase 1, 2026-05-08).
- For chat configs, hand-craft each one (per `feedback_no_bulk_scripts_for_craft_work`).

**Canonical reference:** `docs/notebooklm.md` (Codex-owned). **Operator reference:** `.claude/skills/pp-nlm-operator/SKILL.md`. **Routing reference:** `.claude/skills/pp-knowledge/SKILL.md`.

## Self-Improvement
When friction occurs:
1. Use /remember to capture it as an observation in ops/observations/
2. If the same friction occurs 3+ times, propose updating this context file.

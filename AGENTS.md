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

## MCP Auto-Routing (Mandatory — use these BEFORE built-in tools)

> **The rule:** MCP usage is automatic, not opt-in. When the situation matches a row below, reach for the MCP tool **first** — not the built-in equivalent. Built-in `Bash`/`Read`/`Edit`/`Write`/`WebSearch` are fallbacks, not defaults, when an MCP server covers the case better.
>
> Established 2026-05-10 after Tyler called out under-utilization of Desktop-Commander, Clear-Thought, Context7, NotebookLM. See [feedback_mcp_auto_routing.md](https://github.com/wtyler2505/ProtoPulse/blob/main/.claude/memory/feedback_mcp_auto_routing.md) (memory note).

### Trigger → MCP Server Mapping

| Situation / Trigger | MCP Tool (use FIRST) | Why over built-in |
|---|---|---|
| Reading `.env`, `.mcp.json`, `credentials.*`, `*.key`, `*.pem`, anything secret | `mcp__desktop-commander__read_file` | Built-in `Read` blocked by permissions |
| Editing/writing sensitive config | `mcp__desktop-commander__edit_block` / `write_file` | Same blocking issue |
| `rm -rf`, long-running processes, file moves across boundaries | `mcp__desktop-commander__start_process` / `move_file` | Built-in `Bash` denies destructive ops |
| Searching INSIDE sensitive files for content | `mcp__desktop-commander__start_search` | grep cannot read denied files |
| Reading 3+ files at once | `mcp__desktop-commander__read_multiple_files` | One round-trip vs N |
| Listing processes, checking ports, system state | `mcp__desktop-commander__list_processes` / `get_config` | Structured output beats parsing `ps`/`netstat` |
| ANY library/framework/SDK question (React, Drizzle, Tauri, Vite, Vitest, Express, etc.) | `mcp__context7__resolve-library-id` → `query-docs` | Training data is stale; primary docs win |
| CLI tool usage docs (npm, gh, pnpm, etc.) | `mcp__context7__resolve-library-id` → `query-docs` | Same |
| Complex debugging (3+ hypotheses), architecture tradeoffs (3+ options), multi-step planning with dependencies | `mcp__clear-thought__clear_thought` | Branching reasoning beats linear thought |
| Querying ProtoPulse knowledge corpus | `mcp__notebooklm-mcp__notebook_query` (`pp-core` or `pp-hardware`) | The hubs ARE the corpus — see PP-NLM section |
| Cross-hub synthesis across vault knowledge | `mcp__notebooklm-mcp__cross_notebook_query --tags pp:active` | Single-hub query misses cross-cutting answers |
| Vault note search by content / vector / deep search | `mcp__qmd__qmd_search` / `qmd_vector_search` / `qmd_deep_search` | Semantic search beats grep over `knowledge/` |
| Vault note retrieval by slug | `mcp__qmd__qmd_get` | Frontmatter-aware vs naked Read |
| Saving / recalling architectural decisions, bug fixes, preferences across sessions | `mcp__memory__create_entities` / `search_nodes` / `add_observations` | Persists across sessions; `Read`/`Edit` does not |
| Browser DOM snapshot, accessibility tree, network inspection | `mcp__chrome-devtools__take_snapshot` / `list_network_requests` | Built-in WebFetch can't see DOM state |
| Browser interaction (click, fill, screenshot in real session) | `mcp__chrome-devtools__click` / `fill` / `take_screenshot` | Required after `take_snapshot` |
| Compiling Arduino sketches, uploading to MCU | `mcp__arduino-cli-mcp__compile` / `upload` | First-class Arduino toolchain |

### Hard Rules

1. **Library/framework questions → Context7 first, every time.** No exceptions, even for "well-known" libraries. Routing rule lives in `~/.claude/rules/context7.md` (global) and is non-negotiable. Pattern: `resolve-library-id` → `query-docs`.
2. **Sensitive file ops → Desktop-Commander, no retries on built-ins.** First permission denial means switch immediately, not negotiate. Tool mapping in global CLAUDE.md §Desktop Commander.
3. **Knowledge corpus questions → NotebookLM hubs first.** Don't grep `knowledge/` blind when `pp-core` / `pp-hardware` will synthesize. Routing logic owned by `pp-knowledge` skill (load before any query).
4. **Complex reasoning → Clear-Thought, not linear chain-of-thought.** Triggers: 3+ hypotheses, 3+ tradeoffs, multi-phase plans with dependencies, decisions affecting multiple subsystems.
5. **Browser work → snapshot FIRST.** Chrome DevTools `take_snapshot` before any click/fill/hover. "No snapshot found" = protocol violation.
6. **Cross-session persistence → Memory MCP.** After non-trivial debugging or design decisions, store via `mcp__memory__create_entities` / `add_observations`. Future sessions benefit.

### Anti-Patterns (don't do these)

- Using `Read` on a path you suspect contains secrets, getting blocked, asking Tyler what to do — switch to Desktop-Commander immediately.
- Answering a library API question from training data without `resolve-library-id` — the rule is mandatory, not advisory.
- Grepping `knowledge/` when the corpus question would be served by `notebook_query pp-core` or `notebook_query pp-hardware`.
- Doing linear reasoning through a 3+ hypothesis bug when `clear_thought` would branch them in parallel.
- Clicking a Chrome DevTools UID without a fresh snapshot in the same turn.
- Solving a tricky bug and not storing the resolution in Memory — re-solving next session is a waste.

### Built-in vs MCP Quick Decision

```
Need to do X. Is there an MCP that handles X better than the built-in?
  YES → Use MCP. (90% of the time the answer is YES for the categories above.)
  NO  → Built-in is fine.
Permission denied on built-in?
  → Switch to MCP equivalent. Don't retry. Don't ask.
```

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

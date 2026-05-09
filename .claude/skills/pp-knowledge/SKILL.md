---
name: pp-knowledge
description: >
  Query the ProtoPulse NotebookLM corpus (the PP-NLM Notesbook). Use when Tyler asks
  "what does this codebase do", "have we tried X", "what do we know about <component>",
  "remind me about Y", "what's the BL- iteration history", "find anything related to
  W". Routes to the right Tier-1 notebook (pp-codebase, pp-breadboard, pp-hardware,
  pp-arscontexta, pp-memories, pp-research, pp-backlog, pp-journal, pp-bench) or drills
  into a Tier-2 feature deep-dive (pp-feat-*) when the question is feature-specific.
  Per-component questions go to pp-hardware with the part number in the query — Tier-3
  per-IC notebooks were tried and dropped 2026-05-09 as redundant.
  Triggers on mentions of "codebase", "breadboard", "hardware", "memory", "remember",
  "research", "iteration log", "journal", "bench", "BL-", or any ProtoPulse-specific
  recall verb.
allowed-tools: Bash(nlm:*), Read, Write
---

# ProtoPulse NotebookLM Notesbook router (`pp-knowledge`)

This skill is the routing brain for ProtoPulse's NotebookLM corpus. It picks WHICH notebook to query and HOW to query it.

For the underlying CLI/MCP mechanics, defer to the `nlm-skill` (global, v0.6.6+).

## Tier map (memorize this — it's the routing table)

| Alias | Title | Use when… | Citation rule |
|---|---|---|---|
| `pp-codebase` | Codebase Atlas | Architecture, services, hooks, contexts, plans, "where does X live" | `path/to/file.ext:LineN` |
| `pp-breadboard` | Breadboard Lab | BreadboardView, exact-part flows, parts catalog, DRC, bench stash | source name + section/line |
| `pp-hardware` | Hardware Knowledge | Component theory, vault claims, datasheet lookups (744-note vault mirror) | vault note slug + ISO date |
| `pp-arscontexta` | Ars Contexta | Methodology, MOC discipline, pipeline rules, vault self-knowledge | methodology doc + section |
| `pp-memories` | Memories | Tyler preferences, gotchas, anti-patterns, hard rules | ISO date of memory |
| `pp-research` | Research Lab | Active investigations, deep-research imports, papers, vendor docs | source title + URL |
| `pp-backlog` | Backlog & Iteration | BL-XXXX history, Wave decisions, "have we tried X" | BL-ID + ISO date + Wave # |
| `pp-journal` | Dev Journal | Daily/weekly recaps, commit summaries, what landed when | ISO date |
| `pp-bench` | Bench Notes | Physical hardware observations, real-world part comparisons | part # / vendor / measurement |
| `pp-feat-*` | Feature deep-dives | Specific subsystem (MNA solver, parts catalog, AI integration, design system, Tauri migration, Arduino IDE, PCB layout, Yjs collab, firmware runtime) | feature name + source |

All Tier-1 notebooks are tagged `pp:active` — default cross-query target.
Tier-2 notebooks are tagged `pp:feature` (opt-in to cross-query via `--tags "pp:active,pp:feature"`).

**Note:** Tier-3 per-component notebooks (`pp-cmp-*`) were tried and dropped 2026-05-09. Per-component drill-in is now: `nlm notebook query pp-hardware "<part-number> <topic>"` — pp-hardware's 744-source corpus already holds every per-IC claim with proper RAG retrieval.

## Routing decision tree

```
Tyler's question…
│
├─► Cross-cutting / "what do we know about X" / unsure which notebook
│    → `nlm cross query --tags pp:active "<question>"`
│
├─► Specific to a feature subsystem
│    → `nlm notebook query pp-feat-<slug> "<question>"`
│
├─► Specific component / IC / part number
│    → `nlm notebook query pp-hardware "<part-number> <topic>"`
│       (Tier-3 per-IC notebooks were dropped 2026-05-09; pp-hardware's RAG retrieves
│        the right per-component chunks when the part number is in the query.)
│
├─► About the code / architecture / plans
│    → `nlm notebook query pp-codebase "<question>"`
│
├─► About a BL-XXXX item or Wave decision
│    → `nlm notebook query pp-backlog "<question>"`
│
├─► About what Tyler said / preferences / gotchas
│    → `nlm notebook query pp-memories "<question>"`
│
├─► About methodology / how vault works / Ars Contexta
│    → `nlm notebook query pp-arscontexta "<question>"`
│
└─► Recent activity / "what landed last week"
     → `nlm notebook query pp-journal "<question>"`
```

## Citation discipline

- **Quote nlm citation slugs verbatim.** Never paraphrase a citation — copy what `nlm` returns.
- For `pp-codebase`: prefer file:line format. If the source has line ranges, include them.
- For `pp-hardware`: surface the vault note slug (the `kebab-case-claim.md` filename without extension) so Tyler can grep the vault directly.
- For `pp-backlog`: surface BL-ID + Wave number every time (the backlog is keyed by these).
- If `nlm` returns no citation, say "uncited synthesis" explicitly — do not fabricate.

## Token efficiency

Prefer ONE well-formed `nlm cross query --tags pp:active "<comprehensive question>"` over multiple per-notebook `notebook query` rounds. Cross-query synthesizes across notebooks with citations attributed per-notebook.

For follow-ups, capture the `--conversation-id` from the first reply and pass it on subsequent `notebook query` calls. This persists in the NotebookLM web UI for cross-device continuity.

## Anti-patterns

- **Never `nlm chat start`** — that's an interactive REPL for humans, not controllable by AI tools (verified via `nlm-skill` SKILL.md L59).
- **Don't query `pp-feat-*` notebooks via `cross --tags pp:active`** — they're excluded from `pp:active` for a reason. Use `--tags "pp:active,pp:feature"` to opt them in, or query them explicitly.
- **Don't paraphrase citations.** Quote them.
- **Don't fabricate.** If a query returns no results, report empty — don't synthesize from training data.

## Bidirectional bridge awareness

When a Studio artifact (audio transcript, study guide, mind map JSON) appears in `inbox/` with `provenance.source: nlm-studio`, it routes through the existing `extract` skill — NOT directly into `knowledge/`. The extracted notes then re-publish as new versioned sources on the matching notebook (round-trip). Don't shortcut this.

## Quota awareness (Ultra tier)

5,000 chats/day, 200 audio, 200 video, 1000 reports, 200 deep-research per day. Burn liberally — this is the project's deep-recall layer, not a precious resource. The only cost discipline:
- `studio_create` calls cost the artifact-type quota (1 audio, 1 mindmap, etc.)
- `notebook query` and `cross query` cost 1 chat each
- Source adds cost 0 quota

## Auth lifetime

Sessions ~20 min. The CLI auto-recovers (CSRF refresh → token reload → headless re-auth → 429/5xx retry with exp backoff). If a query returns "Cookies have expired" after auto-recovery, run `nlm login` manually.

## When to defer to other skills

- **CLI mechanics, MCP tool surfaces, exhaustive command tables** → defer to global `nlm-skill`.
- **Vault search (fast keyword/vector)** → use `qmd` MCP tools first; NLM is the slower synthesis layer.
- **Studio output absorption into vault** → defer to `extract` skill (the bidirectional bridge).
- **Plan-task ↔ vault routing** → defer to `vault-suggest-for-plan` skill.

## Notebook IDs (live, kept synced via `notebook-manifest.json`)

Resolve on the fly: `nlm alias get <pp-alias>` returns the UUID. The canonical mapping lives at `~/.claude/state/pp-nlm/notebook-manifest.json`.

## Out of scope

- BrainGrid integration of any kind.
- Public sharing of notebooks (single-user, private always).
- Any synthesis claim NOT grounded in a source citation.

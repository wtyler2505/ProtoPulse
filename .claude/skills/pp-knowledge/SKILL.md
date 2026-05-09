---
name: pp-knowledge
description: >
  Query the ProtoPulse NotebookLM corpus after the 2026-05-09 consolidation.
  Routes questions to the two active hub notebooks: pp-core for codebase,
  Ars Contexta, memory, backlog, journal, research, and feature/system
  questions; pp-hardware for hardware, breadboard, bench, parts catalog, and
  per-component drill-in. Old pp-* aliases are compatibility aliases that now
  resolve to one of those hubs.
allowed-tools: Bash(nlm:*), Read, Write
---

# ProtoPulse NotebookLM Router (`pp-knowledge`)

This skill chooses which live ProtoPulse NotebookLM hub to query. For CLI/MCP mechanics, defer to the global `nlm-skill`.

## Live Topology

ProtoPulse is consolidated into two active NotebookLM hubs:

| Canonical alias | Notebook | Live ID | Holds |
|---|---|---|---|
| `pp-core` | ProtoPulse :: Core Knowledge Hub | `7565a078-8051-43ea-8512-c54c3b4d363e` | Codebase, architecture, plans, Ars Contexta methodology, Tyler memories, backlog, journal, research imports, and most feature/system deep dives |
| `pp-hardware` | ProtoPulse :: Hardware & Bench Lab | `bb95833a-926e-47b1-8f45-d23427fbc58d` | Hardware knowledge, breadboard workflows, bench observations, parts catalog, and per-component drill-in |

Compatibility aliases deliberately remain:

- Core aliases: `pp-codebase`, `pp-arscontexta`, `pp-memories`, `pp-backlog`, `pp-journal`, `pp-research`, `pp-feat-mna-solver`, `pp-feat-ai-integration`, `pp-feat-design-system`, `pp-feat-tauri-migration`, `pp-feat-arduino-ide`, `pp-feat-pcb-layout`, `pp-feat-collab-yjs`, `pp-feat-firmware-runtime`.
- Hardware aliases: `pp-breadboard`, `pp-bench`, `pp-feat-parts-catalog`, `pp-cmp-*`.

Treat those aliases as routing handles, not separate notebooks. Before any write, resolve with `nlm alias get <alias>` and record the resolved target ID.

## Routing Decision Tree

```
Tyler's question...
|
|-- Cross-cutting / unsure / "what do we know about X"
|    -> `nlm cross query --tags pp:active "<question>"`
|
|-- Codebase, architecture, plans, services, hooks, contexts
|    -> `nlm notebook query pp-core "<question>"`
|
|-- Ars Contexta, methodology, vault pipeline, extraction rules
|    -> `nlm notebook query pp-core "<question>"`
|
|-- Tyler preferences, memories, gotchas, work standards
|    -> `nlm notebook query pp-core "<question>"`
|
|-- Backlog, BL-XXXX, Wave history, implementation decisions
|    -> `nlm notebook query pp-core "<question>"`
|
|-- Recent work, recaps, commits, weekly summaries
|    -> `nlm notebook query pp-core "<question>"`
|
|-- Research imports, innovation notes, external source synthesis
|    -> `nlm notebook query pp-core "<question>"`
|
|-- Feature/system deep dive other than physical parts
|    -> `nlm notebook query pp-core "<feature slug> <question>"`
|
|-- Hardware, breadboard, parts catalog, bench measurements
|    -> `nlm notebook query pp-hardware "<question>"`
|
`-- Specific component / IC / part number
     -> `nlm notebook query pp-hardware "<part-number> <question>"`
```

## Citation Discipline

- Quote `nlm` citation slugs verbatim. Never paraphrase a citation.
- For codebase claims, prefer file path and line details when the source provides them.
- For hardware claims, surface the vault note slug or part number so Tyler can grep the vault directly.
- For backlog claims, surface BL-ID and Wave/date when present.
- If `nlm` returns no citation, say "uncited synthesis" explicitly.

## Query Efficiency

Prefer one strong hub query over a scatter of old alias queries. The old aliases point to hubs now, so querying `pp-codebase`, `pp-backlog`, and `pp-research` separately often repeats the same notebook.

Use `nlm cross query --tags pp:active "<question>"` for broad synthesis across both hubs.

## Anti-Patterns

- Do not treat `pp-feat-*` or `pp-cmp-*` aliases as separate notebooks unless live alias resolution proves a deliberate exception.
- Do not use `pp:feature` or `pp:component` tags for default query scope; those tags are retired-source compatibility signals after consolidation.
- Do not query `pp-feat-breadboard-view`; that alias is retired. Ask `pp-hardware` with "BreadboardView" in the query.
- Do not fabricate citations.

## Bidirectional Bridge Awareness

Studio artifacts still route through `docs/nlm-archive/` -> `inbox/` -> `/extract` -> `knowledge/` -> republish. Consolidation changes the target notebook, not the provenance rule.

Republish routing:

- Methodology, code, backlog, memory, journal, research, and feature notes -> `pp-core`.
- Hardware, breadboard, bench, parts, and component notes -> `pp-hardware`.

## Notebook IDs

The canonical live mapping lives at `~/.claude/state/pp-nlm/notebook-manifest.json`. Resolve live truth with:

```bash
nlm alias get pp-core
nlm alias get pp-hardware
```

## Out Of Scope

- BrainGrid integration of any kind.
- Public notebook sharing.
- Any synthesis claim not grounded in NotebookLM citations or local source evidence.

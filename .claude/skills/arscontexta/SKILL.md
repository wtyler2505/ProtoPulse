---
name: arscontexta
description: Codex adapter for ArsContexta and TAS.SPAM knowledge vaults. Use when Tyler mentions arscontexta, contexta, TAS.SPAM, psyche commands, knowledge vaults, MOCs, wiki-linked markdown graphs, qmd search, NotebookLM-to-vault workflows, or wants Codex to orient, maintain, process, query, or evolve a vault.
---

# Ars Contexta

## Purpose

Use this skill as the Codex routing adapter for ArsContexta. Claude Code owns the
upstream plugin surface, but Codex can operate the durable substrate directly:
markdown files, YAML frontmatter, wiki links, MOCs, qmd collections, queue files,
and deterministic validation scripts.

Primary local vaults:

- TAS.SPAM root vault: `/home/wtyler/TAS.SPAM`
- Legacy ForgeCAD contexta vault: `/home/wtyler/forgecad-models/contexta`
- Upstream methodology checkout: `/home/wtyler/.codex/vendor/arscontexta`

## First Moves

1. Detect the vault shape:
   - Root ArsContexta vault: `.arscontexta`, `notes/`, `ops/`, `self/`.
   - Legacy nested contexta vault: `contexta/`, `contexta/0-meta/`, etc.
2. Read the local authority files before acting:
   - TAS.SPAM: `CLAUDE.md`, `ops/config.yaml`, `ops/derivation.md`,
     `ops/derivation-manifest.md`, `self/goals.md`.
   - Legacy contexta: `ops/config.yaml`, `ops/derivation.md`,
     `contexta/README.md`, `contexta/0-meta/conventions.md`.
3. Run `codex-arscontexta orient [repo-root]` for compact state.
4. For methodology questions, query both local and upstream graphs:
   `codex-arscontexta search "<question>"`.

## Codex Mapping

- Architecture and query work: use `arscontexta-architect`, `psyche-next`,
  `psyche-stats`, `psyche-graph`, `psyche-validate`, `psyche-rethink`,
  `psyche-remember`.
- Content pipeline work: use `arscontexta-pipeline`, `psyche-seed`,
  `psyche-reduce`, `psyche-reflect`, `psyche-reweave`, `psyche-verify`,
  `psyche-pipeline`, `psyche-ralph`.
- Source synchronization: use `notebooklm-mcp` or `notebooklm-cli` when
  NotebookLM source metadata or exports are required, then route into
  `psyche-seed` and `psyche-reduce`.
- Claude hooks are blueprints. Codex uses explicit shell checks, qmd CLI,
  skill workflows, and repo scripts. Never require Claude-only runtime behavior
  for Codex to use the vault.

## Kernel Rules

Apply the upstream kernel to any vault work:

- Markdown files with YAML frontmatter are the graph nodes.
- Wiki links are graph edges; verify they resolve.
- MOCs are attention-management infrastructure, not decoration.
- Descriptions must add retrieval value beyond the title.
- Schema enforcement is deterministic; run the vault gates.
- Judgment belongs in skills; deterministic checks belong in scripts/hooks.
- The live upstream kernel currently has 16 primitive entries in
  `reference/kernel.yaml`; count it live instead of repeating older 15-primitive
  language.

## Commands

```bash
codex-arscontexta orient /home/wtyler/TAS.SPAM
codex-arscontexta health --strict /home/wtyler/TAS.SPAM
codex-arscontexta stats /home/wtyler/TAS.SPAM
codex-arscontexta search "description quality as retrieval filter"
codex-arscontexta qmd-update /home/wtyler/TAS.SPAM
codex-arscontexta sync-upstream   # update upstream checkout and qmd index
```

## Boundaries

- Do not rerun upstream `/setup` over TAS.SPAM unless Tyler explicitly asks for
  a rebuild. The vault already exists at repo root.
- Do not create a parallel `contexta/` or second `notes/` tree in TAS.SPAM.
- Do not bulk-ingest all live NotebookLM sources. NotebookLM remains the
  exploration layer; TAS.SPAM stores transformed findings and frameworks.
- Do not auto-commit. Tyler controls git operations.
- Preserve the three-space boundary: `notes/` for research findings, `ops/` for
  coordination and methodology, `self/` for agent identity/goals.

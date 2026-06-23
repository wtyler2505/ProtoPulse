---
name: arscontexta-architect
description: Diagnose, query, recommend, and evolve ArsContexta vault architecture from Codex. Use for TAS.SPAM and contexta equivalents of ask, recommend, architect, health, upgrade, reseed, next, stats, graph, validate, rethink, remember, methodology questions, kernel validation, qmd/search setup, MOCs, three-space architecture, schema, automation, NotebookLM boundaries, and vault drift.
---

# Ars Contexta Architect

## Purpose

Use the upstream methodology graph to answer why/how questions and to propose
vault evolution. This skill is advisory by default, but if Tyler explicitly asks
to implement a Codex-side capability, make the local skill/tooling changes and
verify them.

## References

Core upstream files:

- `/home/wtyler/.codex/vendor/arscontexta/reference/kernel.yaml`
- `/home/wtyler/.codex/vendor/arscontexta/reference/three-spaces.md`
- `/home/wtyler/.codex/vendor/arscontexta/reference/interaction-constraints.md`
- `/home/wtyler/.codex/vendor/arscontexta/reference/methodology.md`
- `/home/wtyler/.codex/vendor/arscontexta/methodology/index.md`

Local system files:

- `ops/config.yaml`
- `ops/derivation.md`
- `ops/derivation-manifest.md`
- TAS.SPAM: `CLAUDE.md`, `self/goals.md`, `self/methodology.md`,
  `notes/index.md`, `manual/*.md`, `templates/*.md`.
- Legacy contexta only when present: `contexta/README.md`,
  `contexta/0-meta/conventions.md`, `contexta/0-meta/multi-cli-protocol.md`.

## Query Strategy

For methodology answers:

```bash
codex-arscontexta search "<question or concept>"
```

If qmd is unavailable, search directly:

```bash
rg -in "<terms>" /home/wtyler/.codex/vendor/arscontexta/methodology notes ops self
```

Read the 3-7 most relevant files fully before giving architecture advice. Favor
upstream methodology notes for "why" and local `ops/derivation*.md` for "what
this vault is supposed to be."

## Health / Architecture Workflow

1. Run `codex-arscontexta health`.
2. Read `ops/derivation.md` for the intended design.
3. Count `reference/kernel.yaml` live and compare actual vault state against the
   current primitive set. Do not hardcode older primitive counts.
4. Separate deterministic issues from judgment issues:
   - deterministic: stale MOCs, broken links, invalid frontmatter, missing fields
   - judgment: bad descriptions, weak links, over/under-automation, schema drift
5. Rank recommendations by impact and reversibility.
6. When implementing, write the smallest durable skill/script/config change that
   removes the friction, then verify with the skill validator and a smoke test.

## TAS.SPAM Architecture Facts

- Vault root: `/home/wtyler/TAS.SPAM`
- NotebookLM notebook: `9d911fb6-8651-476e-920b-e02ab03629d9`
- Current source boundary: manifest-only. Source content enters via `inbox/`
  after Tyler exports or pastes it.
- qmd collection: resolve from `ops/derivation-manifest.md`; currently
  `tasps-findings`.
- Domain maps: `notes/index.md`, `notes/attachment-theory.md`,
  `notes/psychodynamics.md`, `notes/computational-profiling.md`,
  `notes/qualitative-methodology.md`, `notes/trauma-and-neurobiology.md`.

## Codex Adaptation Rules

- Claude Code hooks are blueprints, not directly portable runtime events.
- Codex automation should use git hooks, `just` recipes, local helper scripts,
  and explicit skills.
- qmd CLI is the semantic-search layer unless a qmd MCP server is available.
- Preserve the repo's hard constraint: no Claude-only dependency may be
  required for the vault to function.
- Prefer deterministic shell/Python checks for schema, link, queue, and qmd
  health. Keep judgment checks in skills.
- Treat source-ingestion automation carefully: cache/source manifests are okay;
  flash-flooding 331 sources into `notes/` is not.

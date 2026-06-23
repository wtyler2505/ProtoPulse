---
name: arscontexta-pipeline
description: Process and maintain ArsContexta vault content from Codex. Use for TAS.SPAM and contexta equivalents of seed, reduce, reflect, reweave, verify, validate, learn, pipeline, ralph, source intake, NotebookLM export processing, creating findings/frameworks/tensions, MOC updates, qmd-assisted duplicate checks, queue handoffs, and graph-quality maintenance.
---

# Ars Contexta Pipeline

## Purpose

Operate ArsContexta vault content using Codex-native workflows instead of
Claude slash commands. TAS.SPAM is the primary target: root-level `notes/`,
`inbox/`, `ops/`, `self/`, and generated `.claude/skills/psyche-*` are the
source model. Legacy ForgeCAD `contexta/` remains supported when detected.

Read upstream templates only when needed:

```bash
/home/wtyler/.codex/vendor/arscontexta/skill-sources/
```

## Runtime Setup

Always resolve vocabulary and paths from:

1. `ops/config.yaml`
2. `ops/derivation-manifest.md`
3. `ops/derivation.md`
4. TAS.SPAM: `templates/*.md`, `manual/*.md`, `self/methodology.md`
5. Legacy contexta only when present: `contexta/0-meta/conventions.md`

TAS.SPAM maps universal ArsContexta terms as:

- `notes` -> `notes/`
- `inbox` -> `inbox/`
- `MOCs` -> domain maps in `notes/`
- `note` -> finding, framework, profile, tension, observation
- qmd collection -> `notes_collection` from `ops/derivation-manifest.md`

## Workflows

### Seed / Source Intake

1. Keep NotebookLM as the exploration layer and TAS.SPAM as the synthesis layer.
2. Put exported source content or query answers in `inbox/`.
3. Add provenance fields: `source_type`, `source_url` if present,
   `notebooklm_notebook`, `notebooklm_id` when available, `domain_hint`,
   `evidence_type`, `status: unprocessed`.
4. Do not bulk-create findings from source metadata alone.

### Reduce / Extract

1. Read source fully or chunk if large.
2. Extract atomic claim titles that pass: "This finding argues that [title]."
3. Classify as finding, framework, profile, or tension using templates.
4. Run duplicate checks with qmd first, then `rg` fallback.
5. Present extraction candidates before creating notes unless Tyler asked for
   fully automated processing.
6. Create notes in `notes/`, update source status, and queue follow-up phases.

### Reflect / Reweave

1. Search by keyword with `rg` and semantically with:
   `qmd search "<query>" -c "$(notes_collection)" -n 10`.
2. Add contextual wiki links where you can explain the relationship.
3. Update relevant domain maps in `notes/`.
4. For reweave, ask: "If I wrote this finding today, what would change?"

### Verify / Validate

Run deterministic checks first:

```bash
codex-arscontexta health --strict /home/wtyler/TAS.SPAM
codex-arscontexta stats /home/wtyler/TAS.SPAM
bash ops/scripts/graph/orphans.sh
bash ops/scripts/graph/dangling-links.sh
```

Then judgment checks:

- title is specific enough to be wrong
- description adds scope, mechanism, or implication
- body shows reasoning, not source summary
- provenance and confidence are explicit
- links resolve and have context
- domain map placement is findable

## Subagents

Use Codex subagents only if Tyler explicitly asks for parallel agents. If an
upstream skill says `/ralph` must spawn subagents, map that to Codex subagents
only when the current user request explicitly invokes that batch/fresh-context
lane. Give each worker disjoint note/source ownership and tell it not to revert
other edits.

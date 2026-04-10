---
name: codex-skill-builder
description: Create, repair, validate, package, and document Codex skills using the latest OpenAI Codex skill guidance. Use when creating a new Codex skill, improving a SKILL.md file, writing or tightening trigger descriptions, adding progressive-disclosure references, deciding whether to use AGENTS.md versus a skill versus a plugin, adding agents/openai.yaml metadata, scaffolding reusable skill folders, validating skill structure, or preparing skills for team/repo distribution. Triggers on codex skill, skill builder, SKILL.md, .agents/skills, openai.yaml, skill triggers, skill packaging, skill validation, skill scaffolding, and improve this skill.
---

# Codex Skill Builder

Use this skill to build Codex-native skills that match current OpenAI guidance, not just ad hoc local conventions.

## Core Standard

Default to repo-scoped skills in `.agents/skills/<skill-name>`.

Build skills around one repeatable job. Keep the `description` exhaustive about when the skill should and should not trigger. Keep `SKILL.md` focused on execution. Move deep material into `references/`, reusable templates into `assets/`, and deterministic helper logic into `scripts/`.

## Decision Tree

Before authoring a skill, decide whether the request is better served by:

1. `AGENTS.md`
   Durable repo or directory guidance that should apply broadly.
2. A skill
   A repeatable workflow or specialized expertise for one clear job.
3. A plugin
   Reusable distribution of one or more skills, optionally with apps or MCP integration.
4. An automation
   A stable workflow that already works manually and now needs scheduling.

If the same correction keeps happening across unrelated tasks, prefer `AGENTS.md`.
If the same workflow keeps reappearing for one class of task, prefer a skill.
If the skill should travel beyond one repo, package it as a plugin after local iteration.

## Authoring Workflow

1. Read `references/official-guidance.md` if freshness matters.
2. Define the one job the skill owns.
3. Draft trigger scope and non-scope before writing instructions.
4. Scaffold the skill in `.agents/skills/<name>`.
5. Write `SKILL.md` with sharp boundaries and imperative steps.
6. Add `references/` only for material Codex should load on demand.
7. Add `scripts/` only when deterministic steps improve reliability.
8. Add `agents/openai.yaml` when UI metadata, invocation policy, or tool dependencies help.
9. Validate the structure and trigger behavior.
10. Update repo routing or docs if the new skill should be discoverable by teammates.
11. If the new or updated skill does not appear in Codex immediately, restart the Codex session.

## Validation Standard

Every skill change should verify:

- structure is Codex-compatible
- `name` and `description` exist in frontmatter
- trigger wording is specific enough for implicit invocation
- the skill is scoped to one job
- optional metadata is deliberate
- repo routing points to the skill when relevant

Use:

- `./.agents/skills/codex-skill-builder/scripts/audit-skill.sh <skill-dir>`
- `./.agents/skills/codex-skill-builder/scripts/scaffold-skill.sh <skill-name>`

## References

- `references/official-guidance.md`
- `references/authoring-playbook.md`
- `references/description-design.md`
- `references/openai-yaml-guide.md`
- `references/validation-and-packaging.md`

## Assets

- `assets/skill-template.md`
- `assets/openai.yaml.template`
- `assets/reference-template.md`

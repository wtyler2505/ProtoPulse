---
name: universal-skill-builder
description: Autonomously design, research, construct, and validate new capabilities (Skills) for Gemini CLI, Codex CLI, and Claude Code. Use when creating a new skill, improving a SKILL.md file, scaffolding reusable skill folders, or deciding between architectures. Triggers on skill builder, SKILL.md, .agents/skills, skill triggers, and improve this skill.
---

# Universal Skill Builder

Use this skill to build native skills that match current guidance for the specific target platform (Gemini, Codex, or Claude Code). **You MUST determine or ask the user which platform the skill is for before scaffolding.**

## Core Standard

Default to repo-scoped skills in `.agents/skills/<skill-name>`.

Build skills around one repeatable job. Keep the `description` exhaustive about when the skill should and should not trigger. Move deep material into `references/`, reusable templates into `assets/`, and deterministic helper logic into `scripts/`.

## Platform-Specific Knowledge

Before scaffolding or modifying a skill, adapt your workflow to the specific platform requirements:

1. **Codex CLI**:
   - Heavily relies on `agents/openai.yaml` metadata files for discovery, UI metadata, and tool dependencies.
   - Skills start from metadata first.
2. **Claude Code**:
   - Skills are placed in `.claude/skills/` (or global `~/.claude/skills/`) or within plugins.
   - Claude Code relies on YAML frontmatter in `SKILL.md` (e.g., `name`, `description`, `allowed-tools`, `context: fork`).
   - Supports dynamic bash context injection using `` !`command` `` syntax directly in Markdown.
3. **Gemini CLI**:
   - Skills are typically located in `.gemini/skills/` or `.agents/skills/`.
   - Supports advanced `assistant.toml` command files with zero-latency injection (e.g., `@{file}` and `!{bash script}`).

## Decision Tree: Standard vs. Maestro Architecture

Decide what architecture the skill needs:

1. **Standard Architecture**
   A repeatable workflow or specialized expertise for one clear job. Driven by a single `SKILL.md`.
2. **Maestro-Class Super Skill**
   If the skill requires complex terminal orchestration, external tool CLI usage, zero-latency dashboards, or extensive diagnostic checks. A Maestro skill leverages a multi-directory ecosystem (`references/`, `scripts/`, `templates/`), pre-computed bash scripts, auto-healing, and auto-backups.

## Authoring Workflow

1. Determine the target platform (Gemini, Codex, Claude Code) and architecture (Standard, Maestro).
2. Scaffold the skill:
   - Run `./.agents/skills/universal-skill-builder/scripts/scaffold-skill.sh <skill-name> --platform <gemini|codex|claude> [--arch maestro]`
3. Write `SKILL.md` with sharp boundaries and imperative steps. Tailor the YAML frontmatter and formatting to the chosen platform.
4. Add `references/` only for material the AI should load on demand.
5. Add `scripts/` for deterministic helper logic (e.g., health checks, validations).
6. Validate the structure and trigger behavior.

## Validation Standard

Every skill change should verify:
- Structure is compatible with the target platform.
- `name` and `description` exist in frontmatter.
- Trigger wording is specific enough for implicit invocation.
- The skill is scoped to one job.

## Assets

### Standard Assets
- `assets/skill-template.md`
- `assets/openai.yaml.template`
- `assets/reference-template.md`

### Maestro Assets (Super Skill Factory)
- `assets/maestro/SKILL.md.template`
- `assets/maestro/command.toml.template`
- `assets/maestro/doctor.sh.template`
- `assets/maestro/auto-backup.sh.template`
- `assets/maestro/log-action.sh.template`
- `assets/maestro/KNOWLEDGE_MAP.md.template`

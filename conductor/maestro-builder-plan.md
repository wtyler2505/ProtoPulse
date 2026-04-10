# Implementation Plan: Maestro Architecture Support for Codex Skill Builder

## 1. Objective
To deeply integrate the "Maestro-Class" Super Skill Architecture into the `codex-skill-builder` toolset. This ensures that any future skill you build can instantly leverage the same god-tier capabilities (zero-latency context injection, auto-healing, self-updating encyclopedias, and telemetry) with a single command, rather than manually reinventing the wheel.

## 2. Key Files & Context
- **Skill Target:** `.agents/skills/codex-skill-builder/`
- **New Asset Directory:** `.agents/skills/codex-skill-builder/assets/maestro/`
- **Scaffold Script:** `.agents/skills/codex-skill-builder/scripts/scaffold-skill.sh`
- **Main Instruction:** `.agents/skills/codex-skill-builder/SKILL.md`

## 3. Implementation Steps

### Phase 1: The Maestro Asset Factory
We will build a comprehensive library of boilerplate templates inside `.agents/skills/codex-skill-builder/assets/maestro/` so the builder never has to guess the syntax:
1. **`SKILL.md.template`**: The lean router prompt, enforcing QMD semantic search and external ecosystem scouting.
2. **`command.toml.template`**: The Gemini CLI interactive command, complete with `@{}` native context injections and `!{bash}` pre-computation hooks.
3. **`scripts/doctor.sh.template`**: The auto-healer shell script template.
4. **`scripts/auto-backup.sh.template`**: The fail-safe rollback script template.
5. **`scripts/log-action.sh.template`**: The autonomous changelog ledger script.
6. **`references/KNOWLEDGE_MAP.md.template`**: The semantic index placeholder.

### Phase 2: Upgrading the Scaffolder (`scaffold-skill.sh`)
We will rewrite the `codex-skill-builder`'s scaffolding bash script to support an `--arch maestro` flag. 
When triggered, it will:
1. Create the robust multi-directory structure (`references/`, `scripts/`, `data/`, `templates/`).
2. Copy all the Maestro bash scripts from the asset factory into the new skill and automatically run `chmod +x` on them.
3. Generate the `.gemini/commands/<skill-name>/assistant.toml` file.
4. Automatically inject the correct relative paths (e.g., `./.agents/skills/<skill-name>/...`) into the command file so it is instantly portable.

### Phase 3: Evolving the Codex Skill Builder's Brain
We will update `.agents/skills/codex-skill-builder/SKILL.md` to recognize this new tier of skill.
1. We will add a new decision tree branch: "If the skill requires complex terminal orchestration, external tool CLI usage, or zero-latency dashboards, build a **Maestro-Class Super Skill**."
2. Instruct the AI on how to invoke the upgraded `scaffold-skill.sh --arch maestro` command.

## 4. Verification & Testing
- Run `./.agents/skills/codex-skill-builder/scripts/scaffold-skill.sh test-maestro --arch maestro` to verify that the entire multi-directory ecosystem and the Gemini command file are perfectly generated with the correct dynamic paths.
- Check that all scripts in the new skill have executable permissions.
# Official Codex Skill Guidance

Last reviewed: 2026-04-09

## Primary Sources

- OpenAI Codex Skills docs: `https://developers.openai.com/codex/skills`
- OpenAI Codex best practices: `https://developers.openai.com/codex/learn/best-practices`
- OpenAI skills catalog repo: `https://github.com/openai/skills`

## What Matters Most

- Skills are reusable workflows for Codex across the CLI, IDE extension, and Codex app.
- A skill is a directory with a required `SKILL.md` and optional `scripts/`, `references/`, `assets/`, and `agents/openai.yaml`.
- Codex starts from skill metadata first and only loads the full `SKILL.md` when it chooses to use the skill.
- Repo-scoped skills belong in `.agents/skills`.
- Codex scans `.agents/skills` from the current working directory upward to the repository root.
- Personal skills live in `$HOME/.agents/skills`.
- Plugins are the installable distribution unit; skills are the workflow authoring unit.
- Use `$skill-creator` first if you want Codex to bootstrap a skill interactively.
- Codex usually detects skill changes automatically; restart Codex if an update does not appear.

## Best-Practice Implications

- Keep one skill focused on one job.
- Prefer instructions over scripts unless you need deterministic behavior.
- Put durable broad guidance in `AGENTS.md`, not inside every skill.
- Turn repeated manual workflows into skills before turning them into automations.
- Iterate locally first. Package as a plugin only when the skill is mature enough to distribute.

## Example Catalogs

Use these as examples, not as substitutes for official docs:

- Official: `https://github.com/openai/skills`
- Community examples: `https://github.com/ComposioHQ/awesome-codex-skills`

# Validation And Packaging

## Validation Checklist

Before calling a skill finished:

- `SKILL.md` exists
- frontmatter includes `name` and `description`
- the folder lives under `.agents/skills`
- the skill owns one job
- references are in `references/`
- deterministic helpers are in `scripts/`
- assets are reusable, not random notes
- `openai.yaml` policy is deliberate
- trigger prompts were sanity-checked
- repo routing or docs mention the new skill if teammates should find it

## Distribution Guidance

Stay local first:

- repo-scoped skill: `.agents/skills`
- personal skill: `$HOME/.agents/skills`

Package as a plugin when:

- the skill should be installed outside this repo
- you want to bundle multiple skills
- the skill depends on app mappings or MCP configuration

## Community Example Sources

When you want inspiration after grounding in official docs:

- `openai/skills` for official patterns
- `awesome-codex-skills` for broader examples and ideas

---
name: claude-skills
description: "Author Claude Code skills and subagents: create or refactor SKILL.md with the current frontmatter spec (description, disable-model-invocation, user-invocable, context: fork, allowed-tools, model), design reliable activation triggers, scaffold references/scripts/assets, and run the quality gate + validator. Use when creating, editing, merging, validating, or debugging skills or agents."
---

# Claude Skills Meta-Skill

Turn scattered domain material into a Skill that is reusable, maintainable, and reliably activatable:
- `SKILL.md` as the entrypoint (triggers, constraints, patterns, examples)
- `references/` for long-form evidence and navigation
- optional `scripts/` and `assets/` for scaffolding and templates

Also covers subagent authoring — see `references/agents.md`.

## When to Use This Skill

Trigger this meta-skill when you need to:
- Create a new Skill from scratch from docs/specs/repos
- Refactor an existing Skill (too long, unclear, inconsistent, misfires)
- Design reliable activation (frontmatter + triggers + boundaries)
- Configure invocation control (`disable-model-invocation`, `user-invocable`, `context: fork`)
- Create or edit a subagent in `.claude/agents/` (see `references/agents.md`)
- Split long content into navigable `references/`
- Add a quality gate and run the validator

## Not For / Boundaries

This meta-skill is NOT:
- A domain Skill by itself (it builds domain Skills)
- A license to invent external facts (if the material does not prove it, say so and add a verification path)
- A substitute for required inputs (if inputs are missing, ask 1-3 questions before proceeding)
- About output styles: **output styles are deprecated in Claude Code — do not author new ones; use skills or CLAUDE.md instead.**

## Quick Reference

### Where Skills Live

| Location | Path | Scope |
|----------|------|-------|
| Personal | `~/.claude/skills/<name>/SKILL.md` | All your projects |
| Project | `.claude/skills/<name>/SKILL.md` | This project only |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | Where plugin is enabled (`plugin:skill` namespace) |

The **directory name** is the command you type (`/deploy-staging` from `.claude/skills/deploy-staging/`). The frontmatter `name` is only a display label, except for a plugin-root SKILL.md where it sets the command name. Files in `.claude/commands/` still work and support the same frontmatter; on a name collision the skill wins.

### Recommended Layout

```
skill-name/
|-- SKILL.md              # Required: entrypoint with YAML frontmatter
|-- references/           # Optional: long-form docs/evidence/index
|   `-- index.md          # Recommended: navigation index
|-- scripts/              # Optional: helpers/automation
`-- assets/               # Optional: templates/configs/static assets
```

### Frontmatter Spec (Current — code.claude.com/docs/en/skills)

All fields are optional; `description` is strongly recommended.

| Field | Semantics |
|-------|-----------|
| `name` | Display name in skill listings; defaults to directory name. Does NOT change the `/command` (except plugin-root SKILL.md). |
| `description` | What + when. Claude uses it to decide when to auto-load the skill. Combined with `when_to_use`, truncated at 1,536 chars in the listing — put the key use case first. |
| `when_to_use` | Extra trigger phrases/examples, appended to `description` in the listing. |
| `argument-hint` | Autocomplete hint, e.g. `[issue-number]`. |
| `arguments` | Named positional args for `$name` substitution (space-separated string or YAML list). |
| `disable-model-invocation` | `true` = only the user can invoke via `/name`; description leaves Claude's context. Use for side-effect workflows (deploy, commit). Default `false`. |
| `user-invocable` | `false` = hidden from the `/` menu; only Claude invokes. Use for background knowledge. Default `true`. |
| `allowed-tools` | Tools pre-approved (no permission prompt) while the skill is active; does not restrict other tools. E.g. `Bash(git add *) Bash(git commit *)`. |
| `disallowed-tools` | Tools removed from the pool while the skill is active; clears on your next message. |
| `model` | Model override for the rest of the current turn (`sonnet`, `opus`, `haiku`, `inherit`). |
| `effort` | Effort override while active: `low`, `medium`, `high`, `xhigh`, `max`. |
| `context` | `fork` = run in an isolated subagent; the SKILL.md content becomes the subagent's prompt. Only for skills with explicit task instructions. |
| `agent` | Subagent type when `context: fork` (`Explore`, `Plan`, `general-purpose`, or a custom agent). Default `general-purpose`. |
| `hooks` | Hooks scoped to this skill's lifecycle. |
| `paths` | Glob patterns; auto-load the skill only when working with matching files. |
| `shell` | `bash` (default) or `powershell` for `` !`cmd` `` injection blocks. |

Invocation matrix:

| Frontmatter | You invoke | Claude invokes | Description in context |
|---|---|---|---|
| (default) | Yes | Yes | Always |
| `disable-model-invocation: true` | Yes | No | No |
| `user-invocable: false` | No | Yes | Always |

**Example — user-only deploy command:**

```yaml
---
description: Deploy the application to production
disable-model-invocation: true
allowed-tools: Bash(npm run deploy *)
---
Deploy $ARGUMENTS to production: run tests, build, push, verify.
```

**Example — forked read-only research skill:**

```yaml
---
description: Research a topic thoroughly across the codebase
context: fork
agent: Explore
---
Research $ARGUMENTS: find relevant files, read them, report with file paths.
```

### Dynamic Content

- Substitutions: `$ARGUMENTS`, `$ARGUMENTS[N]` / `$N`, `$name` (with `arguments:`), `${CLAUDE_SKILL_DIR}`, `${CLAUDE_SESSION_ID}`
- `` !`command` `` at line start runs before Claude sees the content; output is inlined (preprocessing — Claude never executes it). Multi-line: fenced block opened with ```` ```! ````.
- Use `${CLAUDE_SKILL_DIR}/scripts/...` to reference bundled scripts portably.

### Authoring Rules (Non-negotiable)

1. Quick Reference is for short, directly usable patterns (<= 20 when possible); paragraphs go to `references/`.
2. Activation must be decidable: `description` says "what + when" with concrete keywords; "When to Use" lists specific tasks; "Not For / Boundaries" is mandatory.
3. Keep SKILL.md under 500 lines; invoked skill content stays in context for the rest of the session, so every line is a recurring token cost.
4. No bluffing on external details — include a verification path for anything unproven.

### Workflow (Material -> Skill)

1. Scope: write MUST/SHOULD/NEVER (three sentences is fine)
2. Extract patterns: 10-20 high-frequency patterns (commands/snippets/flows)
3. Add examples: >= 3 end-to-end examples (input -> steps -> acceptance)
4. Define boundaries + invocation control (who invokes, fork or inline)
5. Split references: long text into `references/` + `references/index.md`
6. Apply the gate: run the checklist and the validator

### Quality Gate (Pre-delivery Checklist)

Minimum checks (full version: `references/quality-checklist.md`):
1. Directory name matches `^[a-z][a-z0-9-]*$` (it IS the command name)
2. `description` states "what + when" with concrete trigger keywords
3. Invocation-control fields match intent (side effects => `disable-model-invocation: true`)
4. Has "When to Use" + "Not For / Boundaries"
5. Quick Reference <= 20 patterns, each directly usable; >= 3 reproducible examples
6. Long content in `references/` with a navigable `references/index.md`
7. SKILL.md under 500 lines; no secrets; uncertain claims have a verification path

Validate (scripts live under this skill's own directory):

```bash
# From this skill's root (.claude/skills/claude-skills/)
./scripts/validate-skill.sh ../<skill-name>
./scripts/validate-skill.sh ../<skill-name> --strict

# From anywhere, via the skill-dir variable
${CLAUDE_SKILL_DIR}/scripts/validate-skill.sh .claude/skills/<skill-name> --strict
```

### Tools & Templates

```bash
# Scaffold a new skill next to this one (run from this skill's root)
./scripts/create-skill.sh my-skill --full --output ..
./scripts/create-skill.sh my-skill --minimal --output ..
```

Templates: `assets/template-minimal.md`, `assets/template-complete.md`

### Subagents

Agents live in `.claude/agents/*.md` (project) or `~/.claude/agents/*.md` (user) with `name`, `description`, `tools`, `model`, `skills` frontmatter. Full authoring guide: `references/agents.md`.

## Examples

### Example 1: Create a Skill from Docs

- Input: an official doc/spec + 2-3 real code samples + common failure modes
- Steps:
  1. `./scripts/create-skill.sh <skill-name> --full --output ..`
  2. Write frontmatter `description` as "what + when"; pick invocation control
  3. Extract 10-20 patterns into Quick Reference; add >= 3 examples
  4. Move long content into `references/` and wire `references/index.md`
  5. `./scripts/validate-skill.sh ../<skill-name> --strict` and iterate
- Acceptance: validator passes strict mode; skill activates on its trigger phrases

### Example 2: Refactor a "Doc Dump" Skill

- Input: an existing `SKILL.md` with long pasted documentation
- Steps: separate patterns from long-form text; move long-form into `references/`; rewrite Quick Reference as paste-able patterns; fix Examples; add "Not For / Boundaries"
- Acceptance: SKILL.md < 500 lines, validator passes

### Example 3: Lock Down a Side-Effect Workflow

- Input: a skill that deploys or commits
- Steps: add `disable-model-invocation: true`; scope `allowed-tools` to exactly the needed commands (e.g. `Bash(git commit *)`); re-validate
- Acceptance: skill no longer appears in Claude's auto-invocation context; `/name` still works

## References

Local docs:
- `references/index.md` — navigation
- `references/skill-spec.md` — normative spec for this repo's skills
- `references/quality-checklist.md` — gate checklist + scoring
- `references/anti-patterns.md` — failure modes
- `references/agents.md` — subagent authoring guide
- `references/README.md` — upstream overview

External (official):
- https://code.claude.com/docs/en/skills (canonical frontmatter spec)
- https://code.claude.com/docs/en/sub-agents
- https://agentskills.io (open Agent Skills standard)

## Maintenance

- Sources: code.claude.com/docs/en/skills (fetched 2026-06-11) + local references
- Last updated: 2026-06-11
- Known limits: `validate-skill.sh` is heuristic; strict mode assumes the recommended section headings. Output styles intentionally not covered (deprecated).

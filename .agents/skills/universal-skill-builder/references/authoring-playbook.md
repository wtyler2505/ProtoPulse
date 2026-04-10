# Codex Skill Authoring Playbook

## Default Layout

```text
.agents/skills/
  skill-name/
    SKILL.md
    agents/
      openai.yaml
    references/
    scripts/
    assets/
```

Only `SKILL.md` is required.

## Recommended Build Order

1. Name the skill with a focused kebab-case noun phrase.
2. Define the owned job in one sentence.
3. Write the trigger description before the body.
4. Draft the execution workflow.
5. Add references for long-form material.
6. Add scripts only if they reduce variance.
7. Add `openai.yaml` only if metadata or dependencies make the skill better.

## Instruction Style

- Use imperative steps.
- Name the key files or commands explicitly.
- Be clear about boundaries, especially what the skill does not own.
- Tell Codex what to inspect first and what to verify before completion.
- Avoid turning `SKILL.md` into a long essay; move detail into `references/`.

## Smells

- The skill handles multiple unrelated jobs.
- The description is vague enough to match half the repository.
- The skill body duplicates repo-wide `AGENTS.md` rules.
- The skill has scripts that just restate instructions.
- The folder contains extra docs that do not support execution.

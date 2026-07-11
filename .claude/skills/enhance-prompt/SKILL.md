---
name: enhance-prompt
description: Turn rough intent into a strong execution prompt. Use when Tyler asks to improve a prompt, make instructions stronger, prepare a task for Codex/Claude/subagents, convert messy ideas into an actionable request, or sharpen vague implementation/research/design instructions.
---

# Enhance Prompt

## What This Skill Does

Make a prompt runnable. Preserve Tyler's intent and voice, but add the missing
context, constraints, outputs, validation, and guardrails that prevent agents
from wandering.

Inspired by Google Labs Code `enhance-prompt`; adapted for Codex, Claude/Codex
handoffs, TAS.SPAM, and local repo work.

## Enhancement Modes

- **Implementation**: files, behavior, tests, validation, non-goals.
- **Research**: exact question, source standards, citations, uncertainty.
- **Design/UI**: product surface, audience, DESIGN.md, states, screenshots.
- **Vault/TAS.SPAM**: skills, source packs, graph notes, Evidence Court.
- **Parallel agents**: lane split, claimed files, outputs, convergence.
- **Private data**: sensitivity, raw/private/promoted boundaries.
- **Long-running local work**: background job policy, productive wait tasks.

## Prompt Compiler

1. Preserve the actual ask.
2. Name the target:
   - repo/path
   - file(s)
   - tool/API/product
   - artifact to create
3. Add context:
   - current state
   - prior decisions
   - user preferences
   - constraints
4. Add done criteria:
   - command output
   - file created
   - tests passed
   - source cited
   - screenshot verified
5. Add guardrails:
   - newest instruction wins
   - do not revert unrelated changes
   - do not promote raw/private data
   - use current docs for external facts
   - explain skipped obvious alternatives
6. Produce the final prompt and a short note describing what changed.

## Ambiguity Sweep

Check for words that need grounding:

| Vague word | Replace with |
|---|---|
| better | what quality changes and how checked |
| research | source types, date/currentness, citation rule |
| integrate | exact files/indexes/docs/skills |
| finish | validation and handoff state |
| optimize | metric, baseline, acceptable tradeoff |
| private | what can be read, derived, promoted, indexed |
| all | category list plus stopping rule |

## Output Rules

- Return a ready-to-send prompt by default.
- Keep it plain; do not bury the task in ceremony.
- If the prompt is for Tyler, keep his directness.
- If the prompt is for an agent, include exact paths and validation.
- Use `templates/enhanced-prompt.md` for longer prompts.

## TAS.SPAM Defaults

Include these when relevant:

- root: `/home/wtyler/TAS.SPAM`
- use `$arscontexta`, `$arscontexta-pipeline`, `$psyche-*`, NotebookLM skills
- raw Takeout/private rows stay private
- promoted source packs need evidence boundaries and forbidden overclaims
- run `bash ops/scripts/validate.sh --link-check --evidence-court` after graph
  edits

## Source Links

- Google Labs Code enhance-prompt skill:
  `https://raw.githubusercontent.com/google-labs-code/stitch-skills/main/skills/enhance-prompt/SKILL.md`
- Agent Skill listing Tyler provided:
  `https://agent-skill.co/google-labs-code/skills/enhance-prompt`

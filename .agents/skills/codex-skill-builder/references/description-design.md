# Trigger And Description Design

## The Description Is The Router

Implicit invocation depends on the `description`, so treat it like a routing contract.

A strong description includes:

- what the skill does
- when to use it
- what user phrases should trigger it
- what nearby tasks should not trigger it

## Pattern

Use a description shaped like:

`Do X for Y. Use when A, B, or C. Triggers on ...`

## Good Trigger Ingredients

- real phrases users would say
- concrete file names or subsystems
- nearby synonyms
- task verbs like create, improve, validate, package, debug, scaffold

## Guardrails

- Avoid generic words with no domain anchor.
- Avoid descriptions that read like marketing copy.
- If a skill is meta or dangerous to auto-trigger, disable implicit invocation in `agents/openai.yaml`.
- If a skill exists for one repo subsystem, name the subsystem explicitly.

## Quick Trigger Test

Before you finish, try three prompts:

1. one prompt that should clearly trigger the skill
2. one borderline prompt
3. one prompt that should not trigger it

If the distinction is muddy, rewrite the description.

---
description: The /ship and /verify skills both handle validation before commits, creating ambiguity about which to use when
type: claim
source: ".claude/skills/ship/SKILL.md, .claude/skills/verify/SKILL.md"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/skills/ship/SKILL.md", ".claude/skills/verify/SKILL.md"]
---

# ship and verify overlap on commit validation territory

Two skills occupy similar territory around "validate and commit":

- **/ship** (106 lines): Runs type check, tests, and git commit+push pipeline with safety checks. Development-focused -- ensures code quality before pushing.
- **/verify** (533 lines): Combined verification -- recite (description quality via cold-read prediction) + validate (schema compliance) + review (health checks). Knowledge-focused -- ensures note quality.

The overlap is in the "validation before action" pattern. A developer finishing a coding task might reach for /ship, but if they also created knowledge notes, they need /verify first. Neither skill calls the other. The /ship skill also partially overlaps with the blocking-typecheck and test-project Stop hooks, which enforce the same checks automatically.

The real confusion is naming: "verify" sounds like it should verify code, but it only verifies knowledge notes. "Ship" sounds like deployment, but it's just git push. Clearer naming would reduce cognitive load.

---

Relevant Notes:
- [[vault-skills-outnumber-project-skills-seven-to-one]] -- the skill ratio context
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- Stop hooks do the same checks as /ship

Topics:
- [[dev-infrastructure]]

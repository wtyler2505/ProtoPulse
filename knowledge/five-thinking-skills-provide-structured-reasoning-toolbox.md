---
description: Five creativity/reasoning skills form a structured thinking toolbox dispatched via /when-stuck based on symptom matching
type: claim
source: "~/.claude/skills/when-stuck/, collision-zone-thinking/, scale-game/, inversion-exercise/, meta-pattern-recognition/"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]"]
related_components: ["~/.claude/skills/when-stuck/", "~/.claude/skills/collision-zone-thinking/"]
---

# five thinking skills provide structured reasoning toolbox

Five global skills exist purely for structured reasoning, with no implementation component:

1. **when-stuck**: Meta-router that matches stuck-symptoms to techniques. Triggers on "stuck", "blocked", "can't figure out", "spinning wheels".
2. **collision-zone-thinking**: Force unrelated concepts together to discover emergent properties. "What if we treated X like Y?"
3. **scale-game**: Test at extremes (1000x bigger/smaller) to expose fundamental truths hidden at normal scales.
4. **inversion-exercise**: Flip core assumptions to reveal hidden constraints. "What if the opposite were true?"
5. **meta-pattern-recognition**: Spot patterns appearing in 3+ domains to find universal principles.

These skills complement the Clear Thought MCP server (37 reasoning operations) and form a second reasoning layer. Clear Thought provides structured mental models (sequential thinking, debugging approach); the thinking skills provide creative problem-solving techniques.

The /when-stuck skill is the entry point -- it doesn't solve problems itself but dispatches to the right technique based on how you're stuck. This prevents the common failure of applying the wrong reasoning framework to a problem (e.g., using scale-game analysis when the real issue is a flipped assumption that /inversion-exercise would catch).

---

Relevant Notes:
- [[when-stuck-is-a-meta-router-that-dispatches-to-specialized-techniques]] -- the dispatch mechanism
- [[oracle-agent-escalation-is-the-strongest-debugging-path]] -- when thinking skills aren't enough

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]

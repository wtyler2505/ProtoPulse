---
description: The SessionStart and Stop events each have a hook group with no matcher field, relying on implicit default behavior
type: claim
source: ".claude/settings.json"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/settings.json"]
---

# two hook groups have no explicit matcher

In `.claude/settings.json`, the SessionStart event has two matcher groups: group 1 has `"matcher": "*"` (explicit wildcard), but group 2 (session-orient.sh) has no matcher field at all. Similarly, the Stop event's group 2 (session-capture.sh) has no matcher field.

When a matcher is omitted, the hook falls through to whatever default behavior Claude Code applies. Currently both hooks appear to fire correctly, but this is fragile -- a Claude Code update could change the default matcher behavior, silently breaking session orientation and capture.

The fix is trivial: add `"matcher": "*"` to both groups. This makes the intent explicit and resilient to platform changes.

---

Relevant Notes:
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the settings.json structure
- [[session-orient-and-validate-note-have-syntax-bugs]] -- session-orient has other issues too

Topics:
- [[dev-infrastructure]]

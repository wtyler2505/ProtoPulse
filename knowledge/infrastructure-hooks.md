---
description: Claude Code hooks in ProtoPulse — the 26-hook pipeline across 6 events, its quality gate role, and known latency / ordering issues
type: moc
topics:
  - "[[dev-infrastructure]]"
---

# infrastructure-hooks

ProtoPulse runs 26 Claude Code hooks across 6 events (15 claudekit + 11 custom). Hooks enforce quality gates automatically — type-check, lint, commit vault, orient session start. Because they fire on every file edit and every session boundary, hook ordering and latency have outsize impact on session responsiveness.

## Notes

- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the full pipeline and its implications
- [[nine-posttooluse-groups-fire-on-every-write]] -- latency cost of the PostToolUse pipeline
- [[session-orient-and-validate-note-have-syntax-bugs]] -- concatenated lines break bash parsing
- [[blocking-typecheck-takes-33-to-44-seconds-on-protopulse]] -- known timeout issue, fixed via claudekit config
- [[auto-commit-vault-is-the-only-async-hook]] -- 25 blocking vs 1 async creates bottleneck risk
- [[two-hook-groups-have-no-explicit-matcher]] -- SessionStart and Stop groups fall through to default
- [[claudekit-and-custom-hooks-share-the-posttooluse-pipeline]] -- ordering matters, no coordination

---

Topics:
- [[dev-infrastructure]]

---
description: The tsc --noEmit typecheck takes 33-44 seconds on ProtoPulse, requiring custom timeout overrides in claudekit config
type: claim
source: ".claudekit/config.json, MEMORY.md"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claudekit/config.json", ".claude/hooks/blocking-typecheck.sh"]
---

# blocking typecheck takes 33 to 44 seconds on ProtoPulse

The ProtoPulse codebase is large enough that `tsc --noEmit` consistently takes 33-44 seconds to complete. The default claudekit hook timeout was 30 seconds, causing the typecheck-changed hook to timeout and report false failures. This was fixed by adding `.claudekit/config.json` with `timeout: 180000` (3 minutes) for both `typecheck-changed` and `typecheck-project` hooks.

The Stop event also runs `blocking-typecheck.sh`, which calls `npm run check` with `NODE_OPTIONS="--max-old-space-size=4096"` to prevent OOM on the full typecheck. This hook blocks the agent from stopping if TypeScript errors exist -- a hard quality gate that prevents leaving broken code.

To avoid running tsc from scratch on every edit, `start-tsc-watch.sh` launches a tmux session running `tsc --noEmit --watch` at SessionStart, writing output to `.claude/.tsc-errors.log`. The `read-tsc-errors.sh` PostToolUse hook then reads this log to show recent errors without re-running tsc.

---

Relevant Notes:
- [[nine-posttooluse-groups-fire-on-every-write]] -- typecheck is part of the PostToolUse pipeline
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- context on Stop event blocking

Topics:
- [[dev-infrastructure]]

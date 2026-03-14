---
summary: The session-capture.sh Stop hook writes JSON session metadata with mined:false to ops/sessions/, creating a growing backlog that /remember --mine-sessions processes later to extract patterns from completed work sessions
category: convention
areas:
  - agent-workflows
  - conventions
---

# Session capture hooks create a mining backlog with mined false flags enabling retroactive insight extraction from work sessions

The `session-capture.sh` hook (.claude/hooks/session-capture.sh) fires at the Stop event — when the agent finishes responding — and writes a JSON metadata file to `knowledge/ops/sessions/`. Each file contains a session ID (from `$CLAUDE_CONVERSATION_ID` or a timestamp fallback), timestamp, counts of insights and captures touched during that session, and crucially, a `"mined": false` flag.

```json
{
  "session_id": "20260313-163909",
  "timestamp": "2026-03-13T16:39:09+00:00",
  "insights_touched": 0,
  "captures_touched": 0,
  "mined": false
}
```

This creates a growing backlog of unmined sessions. The `/next` skill monitors this backlog as one of its session-priority signals: when unprocessed sessions exceed 3, it recommends `/remember --mine-sessions`. The session-orient.sh hook (SessionStart) does not directly warn about unmined sessions, but the `/next` skill's signal collection reads the sessions directory and counts files without `mined: true`.

The design pattern is **deferred extraction** — work sessions contain friction patterns, gotchas, and methodology signals, but extracting insights at session end would add overhead to every session. Instead, the hook captures minimal metadata (cheap), and full processing happens later when the user or system decides to invest the effort (expensive but batched). This is the capture-fast-process-slow principle from the methodology.

The `mined: false` flag is a simple boolean state machine: `false` → `true` after processing. There is no intermediate state like "partially mined" — a session is either unprocessed or done. This simplicity prevents the complexity of tracking partial extraction.

As of the knowledge system's initialization, 64+ session files had accumulated without being mined. This represents a significant unmined knowledge asset — friction patterns from 79+ waves of development sitting in structured JSON metadata files, waiting for retroactive extraction. The queue.json file tracks this as maintenance task `maint-001` at session priority.

The session-capture hook is gated by two conditions: (1) the `.arscontexta` vault marker file must exist (the hook checks this first), and (2) `session_capture: false` must NOT appear in the vault marker. This double-gating means session capture is opt-in at the vault level and opt-out at the configuration level — the [[arscontexta-vault-marker-file-acts-as-a-feature-flag-that-conditionally-activates-knowledge-system-hooks-without-code-changes|vault marker acts as the feature flag]].

---

Related:
- [[arscontexta-vault-marker-file-acts-as-a-feature-flag-that-conditionally-activates-knowledge-system-hooks-without-code-changes]] — gates whether session capture runs at all
- [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff]] — session-capture.sh is one of the Stop layer hooks
- [[arscontexta-skills-implement-a-knowledge-processing-pipeline-where-each-phase-runs-in-isolated-context-with-structured-handoff-blocks-for-state-transfer]] — mined sessions feed into the processing pipeline

Areas: [[agent-workflows]], [[conventions]]

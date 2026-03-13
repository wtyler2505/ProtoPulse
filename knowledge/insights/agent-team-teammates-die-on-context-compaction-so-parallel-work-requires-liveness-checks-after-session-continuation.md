---
summary: Claude Code agent team teammates are killed when the session context compacts, requiring explicit liveness checks before resuming parallel work
areas: ["[[index]]"]
related insights:
  - "[[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously]] — another agent team operational gotcha where parallel execution creates failure modes"
  - "[[auto-loaded-claude-md-files-in-subdirectories-consume-context-window-causing-premature-session-compaction]] — auto-loaded files accelerate context consumption, causing earlier compaction and teammate death"
created: 2026-03-13
---

ProtoPulse uses Claude Code's agent teams (`/agent-teams`) for parallel implementation — up to 5 teammates working on separate files simultaneously. When the conversation context reaches its limit and compacts, all running teammates are silently terminated. Any work-in-progress on their branches is lost unless committed. After session continuation, the lead agent must check teammate status before re-dispatching, because the shared task list survives but the execution threads do not.

## Topics

- [[index]]

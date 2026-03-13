---
summary: Running 4+ concurrent tsc processes during agent teams causes Node.js OOM — set NODE_OPTIONS="--max-old-space-size=3072" for parallel TypeScript compilation
category: gotcha
areas: ["[[index]]"]
related insights:
  - "[[agent-team-teammates-die-on-context-compaction-so-parallel-work-requires-liveness-checks-after-session-continuation]] — both are agent team operational gotchas where parallel execution creates failure modes"
  - "[[auto-loaded-claude-md-files-in-subdirectories-consume-context-window-causing-premature-session-compaction]] — context consumption accelerates compaction, which kills teammates"
created: 2026-03-13
---

ProtoPulse's agent team workflow spawns up to 5 teammates, each running `npm run check` (tsc --noEmit) against the full codebase. The default Node.js heap limit (~1.7GB) is insufficient when 4+ tsc processes run simultaneously on a machine with limited RAM. The symptom is a SIGKILL/OOM during agent team phases. The fix is `NODE_OPTIONS="--max-old-space-size=3072"` which gives each tsc process up to 3GB, enough headroom for parallel compilation of ProtoPulse's ~500 TypeScript files across client, server, and shared directories.

## Topics

- [[index]]

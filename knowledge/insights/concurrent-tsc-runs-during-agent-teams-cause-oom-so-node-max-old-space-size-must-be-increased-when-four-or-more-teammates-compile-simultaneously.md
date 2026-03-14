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

---

Related:
- [[agent-team-teammates-die-on-context-compaction-so-parallel-work-requires-liveness-checks-after-session-continuation]] — both are agent team operational gotchas where parallel execution creates failure modes
- [[auto-loaded-claude-md-files-in-subdirectories-consume-context-window-causing-premature-session-compaction]] — context consumption accelerates compaction, which kills teammates
- [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff]] — PostToolUse typecheck hooks multiplied by teammates cause the concurrent tsc runs
- [[tsc-watch-in-tmux-provides-near-instant-type-feedback-by-decoupling-the-compiler-lifecycle-from-individual-tool-invocations]] — shared watch session mitigates OOM by avoiding cold tsc per teammate
- [[agent-specifications-use-yaml-frontmatter-to-control-model-selection-tool-access-and-hook-suppression-creating-a-capability-profile-per-agent]] — disableHooks on read-only agents reduces the number of concurrent tsc runs
- [[sessionstart-dependency-verification-creates-a-self-healing-bootstrap-that-surfaces-missing-tools-before-they-cause-cryptic-hook-failures]] — if tmux missing, all teammates fall back to cold tsc, worsening OOM risk

## Topics

- [[index]]
- [[agent-workflows]]

---
summary: The /next skill classifies every vault signal by consequence speed (session/multi-session/slow) and recommends exactly one action, using a priority cascade that respects user-set task stacks over automated detection and deduplicates against a persistent recommendation log
category: architecture
areas:
  - agent-workflows
---

# The next skill uses consequence speed classification to prioritize recommendations where session urgency beats multi-session which beats slow decay

The `/next` skill (.claude/skills/next/SKILL.md) solves a prioritization problem that affects all knowledge systems: when multiple maintenance signals fire simultaneously, which one should the agent act on? The answer is consequence speed — how fast does inaction degrade the system?

**Three tiers of consequence speed:**

| Speed | Signals | Threshold | Why This Priority |
|-------|---------|-----------|-------------------|
| **Session** | orphan notes (any), dangling links (any), 10+ pending observations, 5+ pending tensions, inbox > 5, unprocessed sessions > 3 | Immediate | These degrade work quality in THIS session |
| **Multi-session** | pipeline queue > 10, stale notes > 10, research gaps, methodology convergence | Days | These compound but do not block current work |
| **Slow** | health check overdue, topic map oversized, low link density | Weeks | Background decay — annoying but not blocking |

The key design decision is the priority cascade: (1) user-set task stack always wins (human intent beats automation), (2) session-priority maintenance tasks from the queue, (3) session signals from live analysis, (4) multi-session signals, (5) slow signals, (6) "everything clean." This cascade ensures that the system never overrides explicit human priorities with automated health signals, which prevents the cognitive outsourcing anti-pattern where the user becomes a rubber stamp for system decisions.

The skill also enforces **command specificity** — recommendations must be concrete invocations (`/extract inbox/article.md`, not "process some inbox items") and **deduplication** — it reads `ops/next-log.md` to check the last 3 recommendations and avoids repeating itself. If the same recommendation keeps surfacing, it explicitly acknowledges the repetition ("This was recommended previously. The signal has grown stronger since then.").

The deduplication log serves a meta-purpose beyond avoiding nagging: persistent unacted-upon recommendations may indicate misalignment between what the system values and what the user values. This signal feeds back into `/rethink` as potential evidence that the system's thresholds or priorities need recalibration.

The `/next` skill also performs **maintenance queue reconciliation** (Step 2) before collecting state, evaluating all condition-based maintenance thresholds and auto-creating or auto-closing queue entries. This means the queue is always fresh when the recommendation engine runs — stale queue entries for resolved conditions are cleaned up automatically. The maintenance conditions in `queue.json` (orphan threshold, dangling link threshold, stale days, inbox overflow, observation/tension review thresholds) are configurable, making the health sensitivity itself a tunable parameter.

The invariant: **/next recommends, it does not execute.** The user always decides. This prevents the system from entering a self-modifying loop where it acts on its own recommendations without human judgment.

---

Related:
- [[the-rethink-skill-implements-a-scientific-method-feedback-loop-that-triages-accumulated-friction-into-five-dispositions-preventing-knowledge-system-ossification]] — /rethink processes the accumulated evidence that /next surfaces as signals
- [[arscontexta-skills-implement-a-knowledge-processing-pipeline-where-each-phase-runs-in-isolated-context-with-structured-handoff-blocks-for-state-transfer]] — /ralph processes the pipeline queue that /next monitors for backlog

Areas: [[agent-workflows]]

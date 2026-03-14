---
summary: The /rethink skill applies a 6-phase scientific method (drift check + triage + methodology update + pattern detection + proposal generation + approval) to accumulated observations and tensions, with strict evidence thresholds and human-gated proposals preventing both system calcification and runaway automation
category: architecture
areas:
  - agent-workflows
  - conventions
---

# The rethink skill implements a scientific method feedback loop that triages accumulated friction into five dispositions preventing knowledge system ossification

The `/rethink` skill (.claude/skills/rethink/SKILL.md) is the knowledge system's immune system — the mechanism that prevents generated configurations from calcifying around untested assumptions. It implements a 6-phase protocol that mirrors the scientific method: hypothesize (system assumptions encoded in config/methodology), observe (friction captured as observations and tensions during normal work), analyze (pattern detection with evidence thresholds), propose (specific changes backed by evidence), and revise (human-approved changes logged to changelog).

The triage phase classifies each piece of accumulated evidence into exactly one of five dispositions:

| Disposition | Action | What It Means |
|-------------|--------|---------------|
| PROMOTE | Create permanent insight | General principle that works across sessions |
| IMPLEMENT | Change a system file | Operational guidance — "do X differently" |
| METHODOLOGY | Create/update methodology note | Behavioral learning about HOW to operate |
| ARCHIVE | Mark as resolved | Session-specific with no lasting value |
| KEEP PENDING | Leave for more evidence | Single data point that could go either way |

This five-way disposition prevents two failure modes: (1) discarding evidence too eagerly (ARCHIVE everything), which causes the system to ignore real friction; and (2) acting on thin evidence (PROMOTE/IMPLEMENT everything), which thrashes the system. The KEEP PENDING disposition is the safety valve — it acknowledges that a single observation is not a pattern.

The pattern detection phase (Phase 3) enforces strict evidence thresholds tied to blast radius: 2 observations justify a methodology note update, 3+ justify a skill/template change, 5+ justify a context file change, and pervasive patterns across areas trigger an `/architect` consultation. This proportionality rule prevents rethink from proposing architectural overhauls based on thin evidence.

Critically, Phase 5 enforces a **human approval gate** — proposals are NEVER auto-implemented. This is the invariant that makes rethink safe: it can analyze aggressively because it cannot act unilaterally. The system captures its own evolution history in `ops/rethink-log.md`, creating an auditable trail of how and why the system changed.

The feedback loop closes like this:
```
Work → friction → observations/tensions accumulate
  → /rethink triages + detects patterns + proposes
  → human approves → system evolves → less friction
```

Without this loop, the knowledge system's initial configuration (derived during `/architect`) would become increasingly misaligned with actual usage patterns. The [[arscontexta-skills-implement-a-knowledge-processing-pipeline-where-each-phase-runs-in-isolated-context-with-structured-handoff-blocks-for-state-transfer|processing pipeline]] handles content throughput; rethink handles system health. They are complementary mechanisms operating at different abstraction levels.

---

Related:
- [[arscontexta-skills-implement-a-knowledge-processing-pipeline-where-each-phase-runs-in-isolated-context-with-structured-handoff-blocks-for-state-transfer]] — the processing pipeline handles content flow; rethink handles system evolution
- [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff]] — hooks enforce code quality gates; rethink enforces knowledge system quality

Areas: [[agent-workflows]], [[conventions]]

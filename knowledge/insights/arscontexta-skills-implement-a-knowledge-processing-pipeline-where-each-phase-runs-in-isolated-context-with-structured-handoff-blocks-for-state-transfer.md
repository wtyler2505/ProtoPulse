---
summary: The Ars Contexta skill system (extract, connect, validate, pipeline) implements a multi-phase knowledge processing pipeline where each skill runs in forked context with structured RALPH HANDOFF blocks for cross-phase state transfer
category: methodology
areas:
  - agent-workflows
---

# Arscontexta skills implement a knowledge processing pipeline where each phase runs in isolated context with structured handoff blocks for state transfer

The `.claude/skills/` directory contains 16+ skills from the Ars Contexta knowledge system (version 1.6). Four core skills form a pipeline: extract -> connect -> validate, orchestrated by pipeline. Each skill's YAML frontmatter declares `context: fork`, meaning it runs in a fresh agent context — not the main conversation.

**The pipeline architecture:**

```
/seed (entry) -> /extract (claims from source) -> /connect (graph weaving) -> /validate (schema check)
```

Each phase is designed to be:
1. **Independently invocable** — `/extract`, `/connect`, `/validate` can run standalone
2. **Pipeline-composable** — `/pipeline` chains them with a `/ralph` orchestrator
3. **Resumable** — state lives in a queue file (`ops/queue/queue.json`), not session memory

**The RALPH HANDOFF protocol** is the cross-context communication mechanism. When a skill is invoked with `--handoff`, it appends a structured block at the end:

```
=== RALPH HANDOFF: reflect ===
Target: [[note name]]
Work Done: [summary]
Files Modified: [list]
Learnings: [friction/surprise/methodology/process gap]
Queue Updates: [phase advancement]
=== END HANDOFF ===
```

This block is parseable by the `/ralph` orchestrator, which reads the handoff output, updates the queue, and spawns the next phase's skill in fresh context. The learnings section captures meta-process improvements — friction points, surprises, methodology observations — which feed back into the system's self-improvement.

**Context isolation is intentional.** Each phase gets a fresh context window to avoid contamination between extraction (broad reading) and connection finding (semantic judgment). The queue file is the only shared state, making the pipeline stateless orchestration over stateful queue entries.

**Vocabulary abstraction via derivation manifest.** Skills reference `{vocabulary.notes}`, `{vocabulary.topic_map}`, etc. rather than hardcoded terms. The `ops/derivation-manifest.md` maps these to domain-specific vocabulary (e.g., "insights" instead of "notes", "topic maps" instead of "MOCs"). This makes the skill system reusable across knowledge domains without code changes — only the vocabulary mapping changes.

Areas: [[agent-workflows]]

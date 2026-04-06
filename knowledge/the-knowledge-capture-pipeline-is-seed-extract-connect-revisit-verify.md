---
description: Five ordered skills process raw source material into verified, connected knowledge notes with each phase serving a distinct cognitive function
type: pattern
source: ".claude/skills/seed/, .claude/skills/extract/, .claude/skills/connect/, .claude/skills/revisit/, .claude/skills/verify/"
confidence: proven
topics: ["[[claude-code-skills]]", "[[methodology]]"]
related_components: [".claude/skills/seed/", ".claude/skills/extract/", ".claude/skills/connect/", ".claude/skills/revisit/", ".claude/skills/verify/"]
---

# the knowledge capture pipeline is seed extract connect revisit verify

The five core vault processing skills form a pipeline where each phase transforms content at a different level of abstraction:

1. **Seed** (/seed): Intake. Add a source file to the processing queue. Checks for duplicates, creates archive folder, moves source from inbox. This is the only phase that touches the raw source -- all subsequent phases work on the vault.
2. **Extract** (/extract): Decomposition. Break source material into atomic claims, one per note. The largest skill at 1128 lines because extraction requires judgment about granularity, framing, and what constitutes a standalone insight.
3. **Connect** (/connect): Forward linking. Find relationships between new notes and existing ones, update topic maps. The goal is graph density -- isolated notes provide no navigational value.
4. **Revisit** (/revisit): Backward linking. Return to older notes and update them with new connections. This is the phase most often skipped because it requires re-reading existing content, but it is what prevents knowledge decay over time.
5. **Verify** (/verify): Truth testing. Challenge claims against evidence, assign or update confidence ratings. Combines schema validation (required fields, enum values) with semantic validation (does the claim still hold?).

The pipeline can run end-to-end via /pipeline (automated full sequence) or /ralph (fault-isolated with fresh context per phase). Individual phases are also independently invocable for targeted maintenance. The /revisit phase is architecturally important because it is the only backward pass -- all other phases move forward through the pipeline.

---

Relevant Notes:
- [[extract-connect-revisit-verify-mirrors-academic-methodology]] -- the academic origins of this pipeline
- [[extract-is-the-largest-skill-at-1128-lines]] -- why extraction is the most complex phase
- [[knowledge-pipeline-has-ten-skills-covering-the-full-lifecycle]] -- the expanded 10-skill view

Topics:
- [[claude-code-skills]]
- [[methodology]]

---
description: How the ProtoPulse knowledge agent processes, connects, and maintains knowledge
type: moc
topics:
  - "[[index]]"
  - "[[identity]]"
---

# methodology

This topic map documents the processing pipeline and knowledge management conventions used in the ProtoPulse vault.

## Processing Pipeline

Raw material flows through four phases:

1. **Capture** — raw notes land in `knowledge/` (or `inbox/` if configured). No processing yet.
2. **Extract** (`/extract`) — atomic claims are derived from sources. Each claim gets a unique ID (`source-NNN.md`). Near-duplicates trigger enrichment, not skips.
3. **Connect** (`/connect`) — claims are linked to topic maps and to each other. Relationships are explicit (wiki-links) and implicit (shared topics).
4. **Revisit** (`/revisit`) — backward pass. Older notes are re-evaluated in light of new knowledge.

## Vocabulary (domain-native terms)

| Universal | Domain |
|-----------|--------|
| notes | knowledge |
| reduce | extract |
| reflect | connect |
| reweave | revisit |
| MOC | topic map |

## Claim Numbering
Claim files use globally unique IDs: `{source-basename}-{NNN}.md`. Numbers never repeat across batches. Computed from the maximum seen across both the queue and archive.

## Notes

- [[derivation-rationale]] -- why these specific dimension positions were chosen
- [[enforce-hard-cap-on-concurrent-agents]] -- never exceed 6 agents / 8 background tasks simultaneously
- [[use-agent-teams-not-raw-parallel-subagents-for-implementation]] -- /agent-teams for all parallel implementation, not raw subagents
- [[run-standard-dev-commands-autonomously]] -- run db:push, check, test without asking permission
- [[verify-wiki-links-before-completing-knowledge-work]] -- all [[links]] must resolve to real files before a task is done

## Graph Health Rules
- Every file must link to at least one topic map
- No dangling `[[links]]` — stubs are created immediately when links are referenced
- `/seed` is the entry point for processing any source
- `/status` and `/graph` track health metrics

## Queue Schema
Tasks live in `ops/queue/queue.json`. Each task has: id, type, status, source, file, created, next_claim_start.

---

Topics:
- [[index]]
- [[identity]]

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

## Where Operational Methodology Lives

Agent behavior rules, processing principles, and mined operational learnings do not live in the `knowledge/` notes space. They live in two canonical locations outside this topic map:

- `self/methodology.md` — agent methodology, personality, and the processing cycle (Extract → Connect → Revisit → Verify)
- `ops/methodology/` — operational learnings mined from session transcripts via `/remember` (hard caps, autonomy rules, wiki-link quality gates)

This section intentionally holds no wiki-links to `ops/methodology/` files because cross-space wiki-links violate the three-space boundary and render as broken in the notes space.

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

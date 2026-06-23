---
name: "descriptive-slug-matching-filename"
description: "≤140 char tooltip-grade summary. Cold-read test: can a newcomer understand what this claims?"
type: claim
topics:
  - existing-moc-slug
  - second-topic-tag
audience:
  - beginner
  - intermediate
reviewed: 2026-04-18
confidence: supported
claims:
  - subject: "The thing the claim is about"
    predicate: "what's asserted"
    confidence: supported
related:
  - related-note-slug-1
  - related-note-slug-2
provenance:
  - source: datasheet
    url: "https://example.com/datasheet.pdf"
    page: 23
    verified: 2026-04-18
    verified-by: tyler
    reliability: authoritative
used-by-surface:
  - breadboard
  - schematic
status: active
---

## Claim

State the core claim in one paragraph. What is true? Under what conditions?

## Evidence

Why we believe this claim. Cite sources. Reproduce reasoning chains where relevant.

## Application

How this claim shapes implementation. When to consume it via `<VaultHoverCard>`. Which DRC rule derives from it. What the maker should do differently.

## Caveats

Edge cases, open questions, known contradictions with other claims. Link supersedes/superseded-by relationships.

## Cross-references

- `[[related-note-slug-1]]` — why connected
- `[[related-note-slug-2]]` — why connected
- Topic map: `[[moc-slug]]` — where this note lives in the graph

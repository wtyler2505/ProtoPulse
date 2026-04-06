---
_schema:
  entity_type: "knowledge-note"
  applies_to: "knowledge/*.md"
  required:
    - description
    - type
    - topics
  optional:
    - source
    - confidence
    - superseded_by
    - related_components
  enums:
    type:
      - claim
      - decision
      - concept
      - insight
      - pattern
      - debt-note
      - need
    confidence:
      - proven
      - likely
      - experimental
      - outdated
  constraints:
    description:
      max_length: 200
      format: "One sentence adding context beyond the title"
    topics:
      format: "Array of wiki links to topic maps"
description: ""
type: ""
source: ""
confidence: ""
topics: []
related_components: []
---

# {prose-as-title -- a complete claim or insight, not a topic label}

{Content -- your words, your framing. Transform source material, don't copy it.}

---

Relevant Notes:
- [[related note]] -- relationship context

Topics:
- [[relevant-topic-map]]

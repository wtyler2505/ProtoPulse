---
_schema:
  entity_type: "insight"
  applies_to: "insights/*.md"
  required:
    - summary
    - category
    - areas
  optional:
    - wave
    - affected_files
    - confidence
    - superseded_by
  enums:
    category:
      - architectural-decision
      - bug-pattern
      - implementation-detail
      - dependency-knowledge
      - convention
      - gotcha
      - optimization
      - testing-pattern
    confidence:
      - proven
      - likely
      - speculative
      - outdated
  constraints:
    summary:
      max_length: 200
      format: "One sentence adding context beyond the title"
    areas:
      format: "Array of wiki links to topic maps"

# Template fields
summary: ""
category: ""
wave: ""
affected_files: []
confidence: "proven"
areas: []
---

# {prose-as-title — state your insight as a proposition}

{Content — explain the insight, include code examples if relevant, reference specific files}

---

Related Insights:
- [[related insight]] -- relationship context

Areas:
- [[relevant-topic-map]]

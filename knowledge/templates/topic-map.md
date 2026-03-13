---
_schema:
  entity_type: "topic-map"
  applies_to: "insights/*.md"
  required:
    - summary
    - type
  optional:
    - areas
  constraints:
    summary:
      max_length: 200
      format: "One sentence describing what this topic map covers"
    type:
      value: "moc"

# Template fields
summary: ""
type: "moc"
areas: []
---

# {topic name}

{Brief description of what this area covers in ProtoPulse}

## Key Insights

{Links to the most important insights in this area}

## All Insights

{Complete list of insights in this area}

---

Areas:
- [[index]]

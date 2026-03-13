---
_schema:
  entity_type: "observation"
  applies_to: "ops/observations/*.md"
  required:
    - summary
    - category
    - observed
    - status
  enums:
    category:
      - methodology
      - process
      - friction
      - surprise
      - quality
    status:
      - pending
      - promoted
      - implemented
      - archived
  constraints:
    summary:
      max_length: 200

# Template fields
summary: ""
category: ""
observed: ""
status: "pending"
---

# {what was observed — prose sentence}

{Details of the observation}

---

Areas:
- (assigned if promoted to insight)

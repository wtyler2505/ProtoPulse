---
_schema:
  entity_type: "capture"
  applies_to: "captures/*.md"
  required:
    - summary
    - source
    - captured
  optional:
    - session_id
    - wave
    - status
  enums:
    source:
      - work-session
      - code-review
      - bug-investigation
      - feature-implementation
      - refactoring
      - research
    status:
      - pending
      - processed
      - archived
  constraints:
    summary:
      max_length: 200

# Template fields
summary: ""
source: ""
captured: ""
status: "pending"
wave: ""
session_id: ""
---

# {what happened or what was observed}

{Raw observations, decisions made, problems encountered, patterns noticed}

## Potential Insights to Extract

- {observation that could become a proper insight}
- {another observation}

---

Areas:
- (assigned during processing)

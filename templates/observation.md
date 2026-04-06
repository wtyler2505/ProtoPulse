---
_schema:
  entity_type: "observation"
  applies_to: "ops/observations/*.md"
  required:
    - observed_date
    - category
  optional:
    - severity
    - resolved
    - resolution
  enums:
    category:
      - friction
      - surprise
      - recurring-pattern
      - system-drift
      - vocabulary-mismatch
      - missing-connection
    severity:
      - low
      - medium
      - high
  constraints:
    observed_date:
      format: "YYYY-MM-DD"
observed_date: ""
category: ""
severity: ""
resolved: false
resolution: ""
---

# {what happened -- describe the friction signal, not just the topic}

## Context
{What were you doing when this came up? What task, what workflow?}

## Signal
{What felt wrong, slow, confusing, or surprising? Be specific.}

## Potential Response
{Initial thoughts on what to change -- or leave blank if you're just logging the signal.}

---

Topics:
- [[methodology]]

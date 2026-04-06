---
_schema:
  entity_type: "source-capture"
  applies_to: "inbox/*.md"
  required:
    - source_url
    - captured_date
    - extraction_status
  optional:
    - source_type
    - author
    - relevance
    - extraction_categories
  enums:
    source_type:
      - datasheet
      - documentation
      - article
      - forum-post
      - video
      - book
      - competitor-analysis
      - conversation
    extraction_status:
      - raw
      - partial
      - complete
    relevance:
      - high
      - medium
      - low
  constraints:
    source_url:
      format: "Full URL or local file path"
    captured_date:
      format: "YYYY-MM-DD"
source_url: ""
captured_date: ""
source_type: ""
extraction_status: "raw"
relevance: ""
extraction_categories: []
---

# {source title or descriptive name}

## Why This Matters
{One or two sentences on why you captured this -- what question does it answer, what gap does it fill?}

## Raw Content
{Paste or summarize the source material here. This is the inbox -- messy is fine. The point is to not lose it.}

## Extraction Notes
{As you extract knowledge notes from this source, track what you pulled and what's left:}
- [ ] {potential claim or insight to extract}
- [ ] {another extraction target}

---

Topics:
- [[relevant-topic-map]]

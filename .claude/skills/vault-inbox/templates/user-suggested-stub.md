---
name: "User-suggested note: {{TOPIC}}"
description: "User-submitted suggestion on {{DATE}}. {{TRUNCATED_DESC}}"
captured_date: {{DATE}}
extraction_status: pending
triage_status: pending-review
source_type: user-suggested
submitter: {{SUBMITTER}}
suggested_at: {{TIMESTAMP}}
origin_surface: {{SURFACE}}
origin_slug: {{ORIGIN_SLUG}}
topics:
  - user-suggested
  - inbox
---

## User suggestion

**Topic:** {{TOPIC}}
**Submitted by:** {{SUBMITTER}}
**At:** {{TIMESTAMP}}
**Triggered from:** {{ORIGIN_SLUG}}

### Description (verbatim)

{{DESCRIPTION}}

### Moderation notes

- [ ] Reviewed by: _____
- [ ] Outcome: _approve-for-extract | promote-to-gap-stub | archive-as-spam | needs-more-info_
- [ ] Notes:

## For `/extract`

Treat this as a hypothesis about what the vault should cover. Research the topic via qmd + WebSearch. If supported, produce a proper atomic note in `knowledge/`. If not, close with `archive-as-insufficient-information`.

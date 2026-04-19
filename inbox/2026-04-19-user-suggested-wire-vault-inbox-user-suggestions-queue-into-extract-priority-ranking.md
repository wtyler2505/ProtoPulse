---
name: "User-suggested note: wire vault-inbox user-suggestions queue into /extract priority ranking"
description: "User-submitted suggestion on 2026-04-19. The /extract pipeline reads ops/queue/gap-stubs.md but does not yet consume ops/queue/user-suggestions.md; wire it in at a lower priority class than agent-detected gaps."
captured_date: 2026-04-19
extraction_status: pending
triage_status: pending-review
source_type: user-suggested
submitter: tyler
suggested_at: 2026-04-19T00:00:00Z
origin_surface: cli
origin_slug: extract-integration
topics:
  - user-suggested
  - inbox
  - vault-infrastructure
---

## User suggestion

**Topic:** wire vault-inbox user-suggestions queue into /extract priority ranking
**Submitted by:** tyler
**At:** 2026-04-19
**Triggered from:** extract-integration (vault-inbox skill auto-fired with "extract" as the topic signal)

### Description (verbatim)

The `/extract` command currently processes `ops/queue/gap-stubs.md` (agent-detected vault gaps produced by `/vault-gap`). It does not yet read `ops/queue/user-suggestions.md` produced by the vault-inbox skill. Wire user-suggested stubs into `/extract` at a **lower priority class** than gap stubs, per the vault-inbox SKILL.md "Moderation workflow" section:

- Gap stubs are unblockers for pending plans → high priority.
- User-suggested stubs are hypotheses → lower priority unless frontmatter `unblocks:` points at a pending plan.

Per T15 `/vault-extract-priority`, extend the `--include-user-queue` flag hook noted in the vault-inbox integration spec so the priority ranker can optionally fold user suggestions into its ordering.

Trigger for this stub: the vault-inbox skill was auto-invoked this session with the single token "extract" as a suggestion label. The only interpretation that advances real work is a meta-suggestion to formalize the extract↔inbox integration that the SKILL.md describes but hasn't been implemented yet.

### Moderation notes

- [ ] Reviewed by: _____
- [ ] Outcome: _approve-for-extract | promote-to-gap-stub | archive-as-spam | needs-more-info_
- [ ] Notes:

## For `/extract`

Treat this as a hypothesis about what the vault should cover. Research the topic via qmd + WebSearch. If supported, produce a proper atomic note in `knowledge/`. If not, close with `archive-as-insufficient-information`.

Suggested extract path: this is infrastructure, not knowledge content — likely belongs as a plan doc under `docs/plans/YYYY-MM-DD-extract-user-queue-integration.md` rather than `knowledge/`. Mark as `promote-to-plan` during moderation.

---
name: "{{TOPIC}} — vault-gap stub"
description: "Gap flagged by /vault-gap on {{DATE}}. Origin: {{ORIGIN_PLAN}}#{{ORIGIN_TASK}}. Seed for /extract."
captured_date: {{DATE}}
extraction_status: pending
triage_status: gap-stub
source_type: vault-gap-seed
origin:
  plan: {{ORIGIN_PLAN}}
  task: {{ORIGIN_TASK}}
coverage_at_gap: {{COVERAGE}}
strong_hits_at_gap: {{STRONG_HITS}}
research_questions:
  - What is the canonical answer to the concept "{{TOPIC}}"?
  - Which existing MOC does this belong to (eda-fundamentals / maker-ux / a11y / components / ...)?
  - Is there an authoritative source (datasheet, WCAG SC, Wokwi pattern, IEC/IEEE standard) to cite?
  - What ≤140-char summary would serve as a `<VaultHoverCard>` tooltip?
  - Are there closely-related existing notes this should cross-link to?
topics:
  - vault-gap-seed
  - {{TOPIC_SLUG}}
---

## Gap context

A plan-authoring agent ran `/vault-gap "{{TOPIC}}"` on {{DATE}} and found **{{STRONG_HITS}} strong hits** in the vault (threshold: 3). This stub queues research so `/extract` can produce atomic notes under `knowledge/`.

## Origin reference

- **Plan:** `{{ORIGIN_PLAN}}`
- **Task:** `{{ORIGIN_TASK}}`
- **Excerpt (if supplied):** {{EXCERPT}}

## Closest existing notes (qmd_deep_search top-5)

{{QMD_HITS}}

## Primary sources to consult

_(Fill in URLs / page numbers / PDF pointers here when known. The agent that runs `/extract` will start here.)_

- [ ] Datasheet / spec reference: _(url)_
- [ ] Community source: _(url)_
- [ ] Prior related note in vault: _(slug)_
- [ ] Project code consumer: _(file path)_

## Suggested extraction categories

_(Filled by `/extract` based on `ops/config.yaml` `extraction_categories`.)_

## Instructions for `/extract`

1. Read the primary sources above + the closest existing notes.
2. Produce atomic note(s) under `knowledge/` following the exemplar pattern. Reference exemplars:
   - `knowledge/drc-should-flag-direct-gpio-to-inductive-load-connections-and-suggest-driver-plus-flyback-subcircuit.md`
   - `knowledge/10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts-...md`
   - `knowledge/focus-outline-none-strips-keyboard-indicators-wcag-violation.md`
3. Cross-link to at least 2 existing MOCs from `knowledge/`.
4. Include the required frontmatter (name/description/topics; T2 schema adds audience/provenance/claims/related/reviewed).
5. After extraction, update `ops/queue/gap-stubs.md` — mark this row `status: EXTRACTED → <knowledge-slug>.md`.

## Anti-patterns

- Do NOT fabricate citations. If the vault + public sources genuinely don't cover the topic, flag it and escalate.
- Do NOT write notes without cross-linking to a MOC (orphan notes fail `/validate`).
- Do NOT skip the `description` field (it powers `<VaultHoverCard>` tooltips; must be ≤140 chars).

# Ars Contexta System Upgrades — 2026-04-18

**Companion to:** `docs/superpowers/plans/2026-04-18-e2e-walkthrough/` (19-plan campaign that exposed vault gaps) and `docs/superpowers/plans/2026-04-14-arscontexta-waves-completion-closeout.md` (consumption-layer campaign).

## Context

The 2026-04-14 campaign shipped vault consumption (683 notes, 54 MOCs, `useVaultSearch`/`useVaultNote` hooks, `/api/vault/search`, `server/ai.ts` auto-inject). The 2026-04-18 E2E walkthrough plan-of-plans (943 findings → 19 plans) surfaced a different kind of gap: **the system is excellent at holding hardware/EDA knowledge, but not yet structured to plug systematically into large implementation campaigns**. Plan-authoring agents discovered content gaps (a11y/WCAG, Drizzle/schema, component-editor domain, calculator formula derivations), tooling friction (no slash command to convert a plan task → inbox stub; no backlink when a plan cites a note; no way to see "which notes are being consumed and by whom"), and pedagogical under-labeling (notes don't declare their audience — beginner vs expert — so Learn Hub and hover tooltips can't auto-select).

**Intended outcome:** a menu of concrete system upgrades ranked by leverage-per-unit-effort. Each upgrade has a scope estimate, a success signal, and dependencies. Tyler picks which to execute; items become their own future plans under `docs/superpowers/plans/`.

**Constraint:** respect the Ars Contexta philosophy — "If it won't exist next session, write it down now" + the pipeline rule "never write directly to knowledge/". Upgrades must not bypass the pipeline; they must make the pipeline more powerful.

---

## Current system anatomy (verified 2026-04-18)

### Content layer

- **683 atomic notes** in flat `/knowledge/` (no subdirectories).
- **54 MOCs** — hardware-domain (eda-fundamentals/microcontrollers/actuators/power-systems/passives/displays/sensors/communication) + operational (methodology/architecture-decisions/goals/breadboard-intelligence/maker-ux).
- **Depth asymmetry** — deep on EDA/hardware (~239 notes)/components (~269)/React-UI (~628 mentions)/Arduino (~375); shallow on a11y/WCAG (16), pedagogy/learning-design (aspirational), Drizzle/API-schema (scattered), component-editor (no MOC).
- **Note shape** — frontmatter with `name`, `description`, `topics`, sometimes `claims`. Body is a claim + evidence + crosslinks. Exemplary pattern: `drc-should-flag-direct-gpio-to-inductive-load-connections-...md` (named-as-claim, structured evidence, component crosslinks).

### Tool layer

- **MCP tools (5)** — `qmd_search` (BM25), `qmd_vector_search` (embeddings), `qmd_deep_search` (hybrid + query expansion), `qmd_collections`, `qmd_status`.
- **Slash commands (~25)** — `/extract`, `/connect`, `/revisit`, `/verify`, `/seed`, `/pipeline`, `/ralph`, `/next`, `/tasks`, `/graph`, `/stats`, `/validate`, `/status`, `/remember`, `/rethink`, plus `/arscontexta:help/health/architect/upgrade/setup/reseed/ask/recommend/tutorial/add-domain`.
- **Hooks** — auto-commit on vault change (`.claude/hooks/auto-commit-vault.sh`); auto-push cron; extract queue at `ops/queue/`.

### Pipeline layer

- `inbox/` → `/extract` → `knowledge/`. Extract writes atomic notes, updates topic maps, enforces link discipline.
- `ops/queue/` — batch processing state.
- `ops/observations/` — friction signals.
- `ops/sessions/` — session logs.
- `ops/health/` — periodic health reports (most recent `2026-04-14-report-2.md`).

### Consumption layer (shipped 2026-04-14)

- Server: `GET /api/vault/search?q=...&limit=...`, `GET /api/vault/note/:slug`, `/api/vault/` in `PUBLIC_API_PATHS`, rate-limited 60 req/min.
- AI auto-inject: `server/lib/vault-context.ts::buildVaultContext(message)` prepends top-K vault claims to system prompt.
- AI agent tool: `server/ai-tools/knowledge-vault.ts::search_knowledge_vault`.
- Client hooks: `client/src/hooks/useVaultSearch.ts` — `useVaultSearch`, `useVaultNote`, `useVaultMocs`.
- Client UX: `VaultNoteDialog`, `AnswerSourcePanel` (clickable source chips).

---

## Upgrade catalog (15 items, ranked by leverage ÷ effort)

Each item: **scope** (S/M/L/XL) · **effort** (days) · **leverage** (1-5) · **depends on**. Leverage 5 = unblocks entire campaigns; 1 = nice polish.

### T1 — Plan-authoring slash command: `/vault-gap <topic>`  [S · 1 day · leverage 5]

**Problem:** When a plan author needs vault content on a topic, they currently run `qmd_deep_search`, interpret results, and either cite existing notes OR manually create inbox stubs. This is repetitive and inconsistent.

**Proposal:** `/vault-gap <topic>` command runs the full workflow in one step:
1. Executes `qmd_deep_search` on topic.
2. Returns top-5 matches with slugs + relevance scores.
3. If relevance < threshold, auto-drafts an `inbox/YYYY-MM-DD-<slug>.md` stub using a templated frontmatter ("gap flagged by plan X task Y") + the topic as the research question.
4. Queues the stub in `ops/queue/gap-stubs.md` with the originating plan/task reference.
5. Returns a structured payload the calling agent can paste into the plan's Research log.

**Success signal:** `ops/queue/gap-stubs.md` grows only when real gaps are found; plan Research logs reference specific slugs consistently; `/extract` can batch-process the queue nightly.

**Depends on:** nothing.

---

### T2 — Frontmatter schema expansion + validator  [M · 3 days · leverage 5]

**Problem:** Notes have inconsistent frontmatter. `useVaultQuickFetch` (in `16-design-system.md` Phase 8) needs a stable 140-char summary but many notes only have freeform body. MOC membership is implicit (via topic tags). Audience (beginner/expert) is undeclared. "When to use this note" is buried in prose.

**Proposal:** Upgrade the frontmatter schema:

```yaml
---
name: "descriptive slug"
description: "≤140 chars — used as tooltip summary"  # ENFORCED
type: claim | pattern | reference | moc | meta
audience: [beginner, intermediate, expert]           # Learn Hub / tooltip selector uses this
topics: [moc-slug-1, moc-slug-2]                     # MOC membership explicit
claims:                                               # structured assertions
  - subject: "ESP32 GPIO12"
    predicate: "must-be-low-at-boot"
    confidence: verified | heuristic | anecdote
related: [other-note-slug-1, other-note-slug-2]      # outgoing wiki-link mirror
supersedes: []                                        # deprecated-by
superseded-by: []
reviewed: 2026-04-18                                 # freshness
used-by-surface: [breadboard, schematic]             # where the UI consumes this
tags: [...]
---
```

Ship a validator slash command `/vault-validate` that fails CI when a note is missing required fields. Apply migration script to existing 683 notes (auto-fill where possible, flag for manual review otherwise).

**Success signal:** `<VaultHoverCard>` summary renders cleanly from frontmatter, no more body-parsing fallbacks; Learn Hub can filter by `audience`.

**Depends on:** T1 (gap-stub template will use the new schema).

---

### T3 — Bidirectional plan↔vault backlink index  [M · 3 days · leverage 5]

**Problem:** When plan 07-breadboard cites `knowledge/esp32-gpio12-must-be-low-at-boot-...md`, the note doesn't know. If the note later updates, the plan citations become stale. If the plan moves/archives, the note has an orphan reference.

**Proposal:** Maintain a machine-readable index at `ops/index/plan-vault-backlinks.json`:

```json
{
  "knowledge/esp32-gpio12-...md": {
    "referenced_by": [
      { "plan": "docs/superpowers/plans/2026-04-18-e2e-walkthrough/07-breadboard.md", "task": "6.1", "excerpt": "..." },
      { "plan": "docs/superpowers/plans/2026-04-18-e2e-walkthrough/06-schematic.md", "task": "5.9", "excerpt": "..." }
    ],
    "consumed_by_code": [
      { "file": "client/src/components/schematic/PinHoverCard.tsx", "last_verified": "2026-04-20" }
    ]
  }
}
```

Updated by an `/vault-index` slash command that greps `docs/superpowers/plans/` + `client/src` for slug mentions, reconciles, commits. Pre-commit hook invalidates cache on note edit.

**Success signal:** When a note is edited, surfacing "3 plans + 2 code files consume me" gives authors immediate awareness. Dead notes (zero references after N days) surface in health reports.

**Depends on:** T2 (reliable frontmatter anchors).

---

### T4 — Directed MOC expansion for known gap domains  [L · 2 weeks · leverage 4]

**Problem:** The 19 plans identified 4 domains the vault under-covers: a11y/WCAG, Drizzle/API-schema, component-editor field semantics, calculator formula derivations.

**Proposal:** Commission a deliberate write-up campaign — one MOC per gap domain, seeded via `inbox/` stubs, extracted through `/extract`:

- `a11y-wcag-2.1-aa-patterns` (target 30+ notes) — focus ring, role attribution, keyboard nav, ARIA grids/comboboxes, live regions, label associations. Cite WCAG SC numbers explicitly.
- `drizzle-orm-patterns` (target 15+ notes) — scoped queries, migrations, transactional boundaries, schema versioning, test mocks (consumes project memory "Drizzle block in Vitest").
- `component-editor-domain` (target 20+ notes) — Family/Mounting/Package/MPN field semantics, pin role taxonomy, SPICE model conventions, IPC package codes.
- `electronics-math-derivations` (target 20+ notes) — Ohm, RC filter, resistor divider, LED current limiter, decoupling cap sizing, transfer function fundamentals.

Each MOC stub drops in `inbox/`; `/extract` processes; notes back-link to the MOC via T2's frontmatter.

**Success signal:** Plans 03-a11y, 06-schematic, 09-component-editor, 15-generative all have ≥5 vault citations in their Research logs (up from ~0).

**Depends on:** T1 + T2.

---

### T5 — `/vault-suggest-for-plan <plan-file>` command  [M · 2 days · leverage 4]

**Problem:** The current "enhance-with-vault" workflow is manual (read plan, run 5-10 qmd searches, map results into tasks). Lots of room for automation.

**Proposal:** Command takes a plan file path; extracts every Task description + Goal sentence; runs batch `qmd_deep_search` for each; returns a structured suggestion report:

```
Plan: 06-schematic.md
Task 2.7 (live ERC squiggles) — ≥3 matches:
  - knowledge/floating-input-pins-act-as-antennas-for-noise.md (score 0.89)
  - knowledge/erc-rules-for-power-nets-multi-driver-detection.md (score 0.81)
Task 5.9 (pin alternate-function dialog) — ≥10 matches (esp32/attiny/atmega pin notes) — use bulk HoverCard

Task 4.1 (net spotlight) — 0 strong matches
  → suggested inbox stub: "net-spotlight-ux-pattern-highlight-cross-probe.md"
```

**Success signal:** plan-authoring agent can run one command at the start of a plan and get 80% of the vault integration mapped for review.

**Depends on:** T1 + T2. Implementation uses existing `mcp__qmd__qmd_deep_search` looped over plan content.

---

### T6 — Note-provenance metadata + `/vault-source` command  [M · 3 days · leverage 4]

**Problem:** Some vault notes are community lore, some are datasheet-verified, some are AI-generated speculation. No way to tell which is which when consuming.

**Proposal:** Extend T2 frontmatter with a `provenance` block:

```yaml
provenance:
  - source: datasheet
    url: "https://www.espressif.com/sites/default/files/.../esp32-s3-datasheet.pdf"
    page: 23
    verified: 2026-04-14
    verified-by: tyler
  - source: community
    url: "https://esp32.com/viewtopic.php?...23421"
    reliability: consensus
```

Slash command `/vault-source <slug>` prints the provenance block in a human-readable form. Hover tooltips show a small badge (📖 datasheet / 💬 community / 🤖 AI-suggested-to-be-verified).

**Success signal:** consumers can weigh AI outputs vs verified claims; audit trail for "why does my circuit follow this rule?" is crisp.

**Depends on:** T2.

---

### T7 — `/vault-health` expansion: gap heatmap  [S · 1 day · leverage 3]

**Problem:** `ops/health/` reports summarize note counts + freshness. They don't quantify "where the vault should be denser given downstream demand."

**Proposal:** Extend the next health report with two new sections:

1. **Consumption heatmap** — top 20 most-referenced notes (from T3 backlink index) + top 20 least-referenced. Reveals which notes are carrying their weight.
2. **Demand gap analysis** — topics where plans cited `<VaultHoverCard topic="...">` but the topic has no matching note or MOC. Auto-fed from T3 + T5.

Runs weekly via cron (project already has cron machinery per auto-push).

**Success signal:** directed vault content effort is quantitatively justified.

**Depends on:** T3 + T5.

---

### T8 — `<VaultInbox>` client UI for "suggest a note"  [S · 1 day · leverage 3]

**Problem:** Per T1, when a user hits a 404 on `<VaultHoverCard slug="foo">`, they currently see a "No note yet" message. Users with domain knowledge could help fill the gap but have no path to do so.

**Proposal:** 404 state shows an inline "Suggest a note" CTA that opens a modal. User writes a description, hits submit. Server creates `inbox/YYYY-MM-DD-suggested-<slug>.md` with their text + attribution. `/extract` processes later.

**Success signal:** community-sourced vault growth; a real maker seeing a missing tooltip becomes an author.

**Depends on:** T1 (stub format).

---

### T9 — Vault graph visualization as a first-class tab  [L · 5 days · leverage 3]

**Problem:** 683 notes + 54 MOCs have rich interlinking but no way to visually explore. Obsidian has this; ProtoPulse doesn't, despite 13-learning-surfaces.md Wave 2 Task 2.9 proposing it.

**Proposal:** Accelerate the 13-learning-surfaces Task 2.9 graph view into a top-priority deliverable. Use `react-force-graph-2d` (lightweight, proven at 1000+ nodes). Interactions: hover node → 140-char summary (uses `useVaultQuickFetch`); click node → `VaultNoteDialog`; filter by MOC; color by `audience` (from T2); size by `referenced_by.length` (from T3).

**Success signal:** new users can discover vault depth visually; existing users see orphans + hubs instantly.

**Depends on:** T2 + T3. Already scoped in plan 13.

---

### T10 — AI-assisted `/extract` quality gate  [M · 3 days · leverage 3]

**Problem:** `/extract` currently turns inbox stubs into knowledge notes. Quality varies — some extractions lose the original researcher's questions; some miss the claim→evidence→application pattern.

**Proposal:** Before `/extract` commits a new note, run an AI quality check:
- Does the body present a clear claim (not just "here's a topic")?
- Is there evidence (citation or derivation)?
- Is there application guidance (when to use this)?
- Does it cross-link ≥2 MOCs?
- Is the description field ≤140 chars?

If any fail, the note lands in `inbox/review/` with the AI's flagged concerns. Human author fixes, re-runs `/extract`.

**Success signal:** new notes match the quality of exemplars (`drc-should-flag-...`, `10uf-ceramic-on-esp32-vin-...`).

**Depends on:** T2.

---

### T11 — `<VaultExplainer>` progressive disclosure by audience  [S · 1 day · leverage 3]

**Problem:** One note serves beginners and experts. `<VaultExplainer>` currently renders the full body regardless.

**Proposal:** With T2's `audience` frontmatter, note bodies can carry audience-gated sections:

```markdown
### [beginner] What this means
Plain-English.

### [intermediate] Why it happens
Physics-level.

### [expert] Edge cases
Quirks + workarounds.
```

`<VaultExplainer audience={userMode}>` renders only the matching section. Users can click "Show more detail" to progress.

**Success signal:** same note works for Student/Hobbyist/Pro modes (from plan 17 Phase 7).

**Depends on:** T2.

---

### T12 — Plan↔Vault↔Code traceability panel  [M · 3 days · leverage 3]

**Problem:** When a plan cites vault note → code file consumes note → plan completes → code moves: the traceability snaps.

**Proposal:** A read-only panel in `/vault?slug=X` that shows:
- Plans citing this note (from T3 backlinks)
- Code files consuming this note (greppable from `<VaultHoverCard slug="...">` usages)
- Git log of when the note changed
- Drift alert when a plan cites but code doesn't consume (or vice versa)

**Success signal:** architectural debt from stale citations becomes visible.

**Depends on:** T3.

---

### T13 — "Teach me this" learn-plan generator  [L · 5 days · leverage 4]

**Problem:** Vault has deep knowledge but no structured learning paths. A newcomer hitting `electronics-math-derivations` doesn't know where to start.

**Proposal:** Slash command `/vault-teach <topic> --audience=beginner` uses T2's audience metadata + MOC structure to generate a reading sequence:

```
Learn path: "I want to understand decoupling capacitors"
  Step 1 (foundation): what-is-capacitance.md (5 min)
  Step 2 (mechanism): why-capacitors-smooth-voltage.md (5 min)
  Step 3 (application): 10uf-ceramic-on-esp32-vin-... (10 min)
  Step 4 (deep): esr-and-high-frequency-decoupling.md (15 min)
  Pre-test: drc-should-flag-missing-decoupling.md
```

Integrates with plan 13-learning-surfaces.md Learn Hub.

**Success signal:** the Vault becomes a generative tutor, not just a reference.

**Depends on:** T2 (audience metadata) + T4 (denser MOCs).

---

### T14 — "Vault as context cache" for Claude Code sessions  [M · 3 days · leverage 3]

**Problem:** Every Claude Code session re-discovers vault content via qmd searches. Session memory exists (`~/.claude/projects/.../memory/`) but doesn't pre-load relevant vault notes by project context.

**Proposal:** On session start, based on the current working directory + recent git activity, pre-fetch relevant MOCs into the session memory. If user opens `client/src/components/schematic/`, `eda-fundamentals` + `breadboard-intelligence` MOCs are pre-indexed.

Executes via a SessionStart hook that reads git log + file paths + runs `qmd_collections` + loads top-K MOCs into conversation memory.

**Success signal:** "Claude already knows my project's hardware context" — less hunting, more doing.

**Depends on:** T2 (topic tags drive pre-fetch).

---

### T15 — Extract-queue priority from downstream demand  [S · 1 day · leverage 4]

**Problem:** `inbox/` grows faster than `/extract` processes. Priority is FIFO or manual. With 19 plans pending execution, which inbox stubs unblock the most plans?

**Proposal:** Each inbox stub has optional `unblocks: [plan-file-path, ...]` frontmatter. `/extract` runs in priority order: most-referenced-by-pending-plans first.

**Success signal:** plan execution doesn't stall on vault gaps.

**Depends on:** T3 (backlink index knows what plans want).

---

## Quick wins (pick any 5 for 2-week sprint)

Ranked for bang-for-buck given ProtoPulse's current state:

1. **T1** `/vault-gap` command — foundational tooling (1 day, leverage 5)
2. **T2** Frontmatter schema + validator (3 days, leverage 5) — unblocks T3/T5/T6/T11/T13/T14/T15
3. **T5** `/vault-suggest-for-plan` command (2 days, leverage 4) — automates 80% of this very plan's work
4. **T15** Extract-queue priority from demand (1 day, leverage 4)
5. **T8** "Suggest a note" 404 CTA (1 day, leverage 3)

Total: **8 days of focused work** to upgrade the system meaningfully before executing the 19-plan campaign.

## Quarterly picks

- **Q1**: T1, T2, T3, T5, T15 (foundational data layer + tooling).
- **Q2**: T4 (directed MOC expansion), T9 (graph view), T13 (learn-paths).
- **Q3**: T6 (provenance), T7 (health), T10 (AI quality gate), T11 (progressive disclosure).
- **Q4**: T12 (traceability panel), T14 (session pre-fetch), T8 (community suggestions at scale).

## Explicit non-goals

- Moving off flat-file `/knowledge/` to a DB backend (would break Obsidian compat + complicate `/extract`).
- Replacing `qmd` MCP with a different search engine (current hybrid BM25+embedding works; improvements should be additive).
- Eliminating the `inbox/ → /extract → knowledge/` pipeline (discipline over convenience; preserve audit trail).
- Auto-generating notes from code without human review (T10's AI quality gate is at the EDIT stage, not the FABRICATION stage).

## How this ties back to the 19-plan campaign

The vault-integration plan (`i-want-to-explore-partitioned-peach.md`) proposes using the current system to enhance the 19 plans. This document proposes upgrading the system so that future plan campaigns don't need such a labor-intensive enhancement pass — T1+T2+T5+T15 alone would have collapsed the 2026-04-18 enhancement exercise from "day of manual work" to "one command".

## How to execute

Treat this as a menu. For each upgrade Tyler selects:
1. Create a standalone implementation plan file under `docs/superpowers/plans/YYYY-MM-DD-arscontexta-T<N>-<slug>.md` using the standard plan template (TDD waves, `/agent-teams`, research log).
2. Execute; MOC update commits go through the pipeline (`/extract` processes new schema updates in T2's case).
3. Update this document's status table as each T-item ships.

## Status table

| Item | Status | Plan | Shipped |
|------|--------|------|---------|
| T1 | proposed | — | — |
| T2 | proposed | — | — |
| T3 | proposed | — | — |
| T4 | proposed | — | — |
| T5 | proposed | — | — |
| T6 | proposed | — | — |
| T7 | proposed | — | — |
| T8 | proposed | — | — |
| T9 | proposed | (partially in 13 Wave 2) | — |
| T10 | proposed | — | — |
| T11 | proposed | — | — |
| T12 | proposed | — | — |
| T13 | proposed | — | — |
| T14 | proposed | — | — |
| T15 | proposed | — | — |

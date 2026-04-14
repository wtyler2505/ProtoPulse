# Ars Contexta Campaign Closeout

**Status:** Complete 2026-04-14
**Campaign start:** 2026-04-10 (138 files in docs/parts/ identified for extraction)
**Campaign end:** 2026-04-14
**Duration:** 5 days, multiple work sessions

## Scope Executed

Original plan (`2026-04-12-parts-knowledge-extraction.md`) called for extracting all 138 source files across 8 waves. Evidence-grounded scope revision on 2026-04-14 (verified zero ProtoPulse runtime code consumed the vault — vault was dormant inventory) pivoted the second half of the campaign to:

1. **Finish high-value extraction** (Wave F wiring guides + Wave H selective novel parts)
2. **Skip low-value extraction** (Wave E7/E8/E9 breadboards/industrial/salvage, Wave G unidentified)
3. **Ship the vault consumption layer** so extracted knowledge actively grounds ProtoPulse AI work instead of accumulating as unread inventory

The scope revision is documented in `2026-04-14-arscontexta-waves-completion.md` with the grep-verified evidence supporting it.

## Vault Totals

| Metric | Campaign start | Campaign end | Delta |
|---|---|---|---|
| Atomic notes in `knowledge/` | ~320 (2026-04-10) | **528+** (2026-04-14) | +208 |
| Hardware topic maps (MOCs) | 1 (`eda-fundamentals`) | **11** | +10 (Wave 0) |
| Architectural tensions filed | 0 | **2** (1 resolved during campaign) | +2 |
| AI-readable via runtime | **0%** (no code path consumed vault) | **100%** (every AI request auto-grounded) | integration complete |

## Waves Executed

| Wave | Scope | Status | Notes produced | Notable outputs |
|---|---|---|---|---|
| 0 | Create 10 hardware topic maps | ✅ Complete | — | 10 MOCs populated (76/76/90/80/92/55/31/43/41/23 lines) |
| A | MOC/index files (13 files) | ✅ Complete | prior session | — |
| B | Microcontrollers (12 files) | ✅ Complete | prior session | 68+ MCU gotchas across ESP32/8266, Arduino, RP2040 |
| C | Sensors + Communication (27 files) | ✅ Complete | prior session | 80+ sensor/comm claims |
| D | Actuators + Power (20 files) | ✅ Complete | prior session | BLDC brake polarity tension filed |
| E1-E5 | Displays/passives/input/shift-register/shields (25 files) | ✅ Complete | prior session | — |
| E6 | Shields + level shifters (5 files) | ✅ Complete | 17 | TXS0108E OE-pin gotcha, TB6612 mosfet-vs-Darlington ladder; mosfet-driver-efficiency tension filed |
| E7-E9 | Remaining E files (~17 files) | ⏸ SKIPPED | — | Low-value per revised scope |
| F1 | Wiring guides sub-batch 1 (4 files) | ✅ Complete | 30 | 3 load-bearing integrative claims; brake-polarity tension corroborated |
| F2 | Wiring guides sub-batch 2 (3 files) | ✅ Complete | 22 (+6 queued, later materialized) | Staggered-start inrush claim, 4WD rover GPIO budget ceiling, tank-steering via differential wheel-speed |
| G | Unidentified parts (15 files) | ⏸ SKIPPED | — | Nothing verifiable to extract |
| H | Selective novel Document Sets (8 of 80+) | ✅ Complete | 24 | Cytron MD25HV resolves mosfet-driver tension; AC motor class anchored; Arduino Leonardo HID architectural distinction |

**Skipped rationale:** E7/E8/E9/G skipped after evidence-grounded scope revision on 2026-04-14. Verified via grep that no ProtoPulse code consumed the vault, making low-value extraction pure overhead. Breadboards had 95% dedup expected against existing `breadboard-intelligence` content; industrial/salvage parts out of scope for maker-tier ProtoPulse focus; unidentified parts have nothing verifiable to extract.

## Tensions Surfaced During Campaign

| Tension | Filed | Status | Resolution |
|---|---|---|---|
| BLDC brake polarity contradicts between KJL-01 (active high) and ZS-X11H (active low) | Wave D | **Corroborated** | Wave F1+F2 added explicit CT-brake-polarity-active-low note for ZS-X11H. Vendor-specific, not a BLDC convention. |
| mosfet-driver-efficiency vs voltage-range (inventory has no high-voltage MOSFET H-bridge) | Wave E6 | **Resolved** | Wave H added Cytron MD25HV (58V/25A MOSFET with active current limiting) — fills the gap cleanly. Voltage ladder complete: TB6612 (13V) → L298N (46V) → MD25HV (58V). |

## Vault Consumption Layer (integration shipped this campaign)

The most consequential deliverable is that the vault now actively grounds AI work in ProtoPulse runtime — not just future agentic sessions.

### Server-side

- **`server/lib/vault-search.ts`** — Fuse.js-backed index of `knowledge/*.md`. Loads 520+ notes, supports keyword + fuzzy search with weighted scoring (title 35%, description 30%, slug 20%, body 15%). 17 tests.
- **`server/lib/vault-context.ts`** — Lazy-loaded singleton + per-message grounding. `buildVaultContext(message, activeView)` returns a formatted INVENTORY KNOWLEDGE section capped at ~6KB, derived from user message keywords. Stopword filter + Fuse threshold gate prevent noise. 8 tests.
- **`server/ai.ts`** — `processAIMessage` and `streamAIMessage` now call `buildVaultContext` per request and append to the cached system prompt. Empty-string fallback on vault failure preserves AI functionality if vault breaks. Cache invariants preserved.
- **`server/ai-tools/knowledge-vault.ts`** — `search_knowledge_vault` tool exposed to AI. Category: `component`, permission tier: `read`, no confirmation. Results wired to `ToolSource` with `type: 'knowledge_base'` for BL-0160 Source Panel. 6 tests.
- **`server/routes/knowledge-vault.ts`** — HTTP endpoints: `GET /api/vault/search?q=...&limit=...`, `GET /api/vault/note/:slug`, `GET /api/vault/mocs`. Rate-limited 60/min, `setCacheHeaders('project_data')`.

### Client-side

- **`client/src/hooks/useVaultSearch.ts`** — React Query hooks: `useVaultSearch(q, limit)`, `useVaultNote(slug)`, `useVaultMocs()`. Stale times tuned (60s search, 5min note, 10min mocs).
- **`client/src/components/panels/chat/AnswerSourcePanel.tsx`** — knowledge_base source chips now CLICKABLE. Click opens `VaultNoteDialog` showing full note body + topics + linked notes. Icon updated to `BookOpen`.

### End-to-end loop

```
User asks AI in chat
  → server/ai.ts: buildSystemPrompt + buildVaultContext → inject top-K vault claims
  → AI responds grounded in authoritative inventory facts
  → AI optionally calls search_knowledge_vault tool for deeper lookup
  → Tool returns results with sources[{type:'knowledge_base', id:<slug>, label:<title>}]
  → Client AnswerSourcePanel renders clickable chips
  → User clicks chip → VaultNoteDialog fetches /api/vault/note/:slug
  → User reads full claim body + topics + linked notes
```

## Tests + Quality Gates

- **31 vault-specific tests pass** (17 vault-search + 8 vault-context + 6 knowledge-vault tool)
- **Full TypeScript check (`npm run check`): exit 0, clean**
- **Full vitest suite: 29813/29816 pass** — 3 pre-existing failures in `shared/__tests__/exact-part-resolver.test.ts` caused by verified-boards pack expansion (rpi-pico, sparkfun-thing-plus, adafruit-feather added 4 days ago) while test expectations last updated 8 days ago. **Outside vault-integration scope** — flagged for Tyler's parts-consolidation branch review.

## Known Issues Flagged

- **qmd MCP vector search non-functional** — all extraction subagents in E6, F1, F2, H fell back to keyword grep Tier-3. Works, but slower and less precise. Fix would require resolving `'qmd' is not defined` in the MCP server + running `qmd update && qmd embed` to reindex (57/480 files indexed as of F1 report — severely stale). Tracked as maintenance task for future session.
- **Ralph skill subagent-spawning in non-Task harness** — the `/ralph` skill assumes a Task-class subagent spawner. When ralph ran inline in this harness, it completed work but documented the architectural deviation. Future ralph invocations will continue to run inline until skill adapts.
- **Exact-part-resolver test drift** (noted above).

## Lessons for Future Extraction Campaigns

1. **Evidence-ground scope decisions early.** The 2026-04-14 grep verification that no ProtoPulse code consumed the vault was the correct pivot point. Had this happened at Wave A, skipped scope could have been defined upfront rather than after 100+ low-value notes were already considered.

2. **Sub-batching wiring guides produces better dedup.** Wave F split 4+3 gave F1 time to seed the vault before F2 ran, producing heavier enrichment (cleaner) instead of creating near-duplicates. Worth repeating for any future integrative-content wave.

3. **Skill subagent-spawning architecture matters.** `/ralph` and `/pipeline` skills assume a particular subagent-spawning model. When running in harnesses that lack that exact model, work still completes but diverges from the designed pattern. Future skill revisions should make the spawning layer pluggable.

4. **Raise `queue_max_depth` before high-density waves.** Wave F temporarily pushed queue to 70; had config still been at 50, enrichments would have silently dropped. Raised to 200 for the campaign — keep it there or higher.

5. **Integration work has to accompany extraction.** The most valuable output of this campaign is not the 208 new notes — it's the consumption layer. A note that no code reads is a note that doesn't exist to the end user. Bake integration into every future extraction plan.

## Files Written/Modified This Campaign (Integration Layer)

**New files:**
- `server/lib/vault-search.ts`, `server/lib/__tests__/vault-search.test.ts`
- `server/lib/vault-context.ts`, `server/lib/__tests__/vault-context.test.ts`
- `server/ai-tools/knowledge-vault.ts`, `server/ai-tools/__tests__/knowledge-vault.test.ts`
- `server/routes/knowledge-vault.ts`
- `client/src/hooks/useVaultSearch.ts`
- `docs/superpowers/plans/2026-04-14-arscontexta-waves-completion.md` (revised-scope plan)
- `docs/superpowers/plans/2026-04-14-arscontexta-waves-completion-closeout.md` (this doc)

**Modified files:**
- `server/ai.ts` — vault context injection into both `processAIMessage` and `streamAIMessage`
- `server/ai-tools/index.ts` — registered `knowledge-vault` tool
- `server/routes.ts` — registered knowledge-vault routes
- `client/src/components/panels/chat/AnswerSourcePanel.tsx` — clickable vault source chips + VaultNoteDialog
- `ops/config.yaml` — queue_max_depth 50 → 200

**New MOC files (Wave 0):**
- `knowledge/{microcontrollers,sensors,actuators,displays,power-systems,shields,communication,passives,input-devices,wiring-integration}.md`

**Tension files:**
- `ops/tensions/bldc-brake-polarity-contradiction-between-kjl01-and-zs-x11h-sources.md` (corroborated)
- `ops/tensions/mosfet-driver-efficiency-conflicts-with-voltage-range-because-the-inventory-has-no-high-voltage-mosfet-h-bridge.md` (resolved)

## Next Work Beyond This Campaign

- Drain remaining ~35 queue tasks via additional `/ralph` batches
- Run `qmd update && qmd embed` to reindex vault so semantic search via MCP works again (estimated 20-40 min for 528 files)
- Consider extending `KnowledgeView.tsx` to surface vault content alongside the hardcoded `electronics-knowledge.ts` articles (would make vault user-visible without requiring AI chat)
- Monitor whether AI grounding with vault context actually improves answer quality — add telemetry or A/B compare

---

**Campaign closed 2026-04-14.** Vault is now an active infrastructure piece of ProtoPulse, not dormant inventory.

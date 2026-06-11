# My Parts Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so My Parts work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real My Parts behavior.

## Pending Proposals

- Add screenshots for the main My Parts states.
- Add more specific gotchas after the next real My Parts implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-my-parts)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-my-parts/scripts/inspect-my-parts.mjs` → **Status: ok** (PersonalInventoryPanel.tsx 166 lines / 19 CCN, 0 tracked tests — very lightweight panel).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep analysis:
   - scc: 154 code / 19 CCN (tiny — simple personal stock list + search-to-add + location grouping).
   - Full read of `PersonalInventoryPanel.tsx` (compact Card with "Personal Inventory" header + count, search input + catalog popover for adding parts, stock grouped by storageLocation, StockRow showing truncated partId + location + supplier + qty + price, ScrollArea max-h-420px).
   - Uses `usePersonalInventory()`, `useAddPersonalStock()`, `useCatalog()` (global parts catalog). Data shape: PartStockRow (id, partId, storageLocation, supplier, quantityOnHand, unitPrice).
   - Cross-referenced entire campaign (project-level Inventory/StorageManagerPanel with full health analyzer + barcode/QR, BOM shortfalls BL-0150 in Exports, breadboard-lab exact-part provenance + "local stock vs community", Component Editor exact-part verification, Generative output with `generatedFrom`, provenance/trust story across many views).
4. Grepped for confidence/trust UI, provenance badges, links to breadboard/3D/exact parts/generative, integration with project inventory or health.
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (Personal Parts / Stock Counts / Locations / Part Confidence):**

- **Clean, compact personal stock viewer (strength):** Simple, focused panel showing the user's private bin stock, grouped by storage location, with search-to-add from the global catalog. Stock counts (quantityOnHand) and locations (storageLocation) are visible and grouped. The UI is deliberately lightweight (166 lines) compared to the rich project-level StorageManagerPanel (994 lines with health analyzer, barcode, QR labels).

- **"Part Confidence" pillar is completely missing (direct P1 contract violation):** The UX contract explicitly requires "Part Confidence is visible enough for a user to understand what is happening." The current implementation has **zero** trust, verification, provenance, or confidence UI:
  - No badges for "Verified Exact Part", "Generative Origin", "Community-sourced", "Local unverified", confidence score, source evidence, or verification status.
  - No link to Component Editor verification or exact-part provenance.
  - No distinction between high-confidence personal stock (verified exact parts the user owns) vs low-confidence (generic, untracked, or AI-generated without verification).
  - The "AI-generated or uncertain data is clearly marked" contract is not reflected here at all.

- **No bridges to breadboard / 3D / generative / project surfaces (P1 gap):** 
  - No indication which personal parts are currently placed on breadboard or have verified 3D models.
  - No "use my personal stock" affordance when adding exact parts in breadboard or Component Editor.
  - No provenance link when adding a generative-adopted part to personal inventory.
  - No integration with project-level inventory health or BOM shortfalls (personal stock should inform "I have X on hand personally" vs project stock).

- **"Personal Parts" vs "Project Inventory" distinction is good but isolated:** The existence of a separate PersonalInventoryPanel (vs the rich StorageManagerPanel for project BOM/stock) is the right architectural split for "my home bin" vs "project assets." However, the two surfaces do not talk to each other, and personal stock does not participate in the provenance, health, or readiness stories.

- **0 tests recorded (notable gap for a stock/confidence surface):** The skill records zero tests. Per the gotchas, this increases risk for search-to-add, location grouping, and any future confidence UI.

- **Low complexity, clean code (positive):** 19 CCN on 154 LOC — deliberately thin. Good use of ScrollArea and grouping. The panel follows the "keep compact, no cards inside cards" spirit of the UI Container Rule.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Implement Part Confidence / provenance UI (direct contract violation)**
- Add visible confidence/trust badges or indicators on every StockRow and in the add-search results (e.g., "Verified Exact Part", "Generative Origin", "Community-sourced", confidence score, source evidence link).
- Pull and display verification status and provenance from Component Editor / Generative when parts are added or matched.
- Make uncertain/AI-generated personal stock visually distinct (consistent with VaultHoverCard / TrustReceiptCard patterns used elsewhere).

**P1 — Bridge Personal Inventory to breadboard / 3D / Component Editor / project surfaces**
- When adding exact parts in breadboard or Component Editor, offer "use from my personal inventory" with stock counts and locations.
- Show which personal parts have verified 3D models / mechanical envelopes (link to 3D View or Component Editor).
- Feed personal stock into project-level inventory health and BOM shortfall calculations (or at least make it visible as "I have X personally").
- On adoption of a generative candidate, offer to add the resulting parts to personal inventory with appropriate provenance flags.

**P2 — Unify or clearly link Personal vs Project inventory views**
- Provide navigation or summary links between PersonalInventoryPanel and the project StorageManagerPanel so users understand "my private bin" vs "project assets" and how they interact for exact-part decisions and fab handoff.

**P2 — Test coverage for search-to-add, location grouping, and (once implemented) confidence flows**
- Record test globs in the skill and add coverage for the add flow, grouping, and provenance display.

**Strengths (relative to peers):**
- Clean, deliberately lightweight personal stock viewer that respects the "keep compact" and "no cards inside cards" principles.
- Good separation of "my private bin" (PersonalInventoryPanel) vs "project assets" (StorageManagerPanel) — the right architectural distinction for personal vs shared stock.
- Search-to-add from the global catalog with MPN display is practical.
- Location grouping and simple stock counts are immediately useful for "where did I put my resistors?"

**Cross-Cutting Value (very high for the provenance + breadboard-lab + exact-part story):**
- This is the user's "I have these parts at home" truth that should inform safe and confident exact-part choices on breadboard ("use my verified personal stock first").
- It must carry and prominently surface the same provenance/trust signals (exact-part verification, generative origin, community vs local) that the rest of the system now enforces, or the personal stock layer becomes a blind spot in the safety story.
- Personal inventory confidence directly affects "can I rely on this part for my current design?" decisions across breadboard, 3D mechanical fit, and fab handoff.

**Durable Lesson:**
A clean, compact personal inventory panel can still leave "Part Confidence" completely invisible if it never pulls or displays verification status, generative origin, or source provenance from the Component Editor, Generative, and breadboard-lab systems. The UX contract requires "Part Confidence" to be visible — after the provenance campaign, the user's private stock must participate in the same trust model as project parts, or "my bin" becomes a provenance hole that undermines exact-part safety and fab handoff confidence.

**Recommended for Codex (immediate high-ROI tasks):**
1. Add prominent confidence/trust badges and provenance indicators on every StockRow and in the add-search results (verified exact, generative origin, source evidence, trust level) using existing VaultHoverCard / TrustReceiptCard patterns.
2. Wire Personal Inventory into breadboard exact-part selection ("use from my personal stock"), Component Editor part creation, and 3D model association.
3. Feed personal stock counts/locations into project-level inventory health and BOM shortfall surfaces (or at least make them visible as "personal buffer").
4. On generative adoption, offer to add resulting parts to personal inventory with provenance flags.
5. Record tests in the skill and add coverage for the add flow, location grouping, and provenance display.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc (19 CCN), exact missing "Part Confidence" UI, provenance gaps, integration opportunities with breadboard/3D/Component Editor/Generative/project inventory, and cross-references to the full provenance/trust, exact-part, breadboard-lab, Exports, Inventory, and health work from the same handoff campaign.
- No production code mutated during discovery.
- All findings tied directly to the provenance/trust, exact-part, breadboard-lab, and inventory health work from the same handoff audit.

---

*My Parts analysis complete. Clean, lightweight personal stock viewer with good location grouping and search-to-add, but "Part Confidence" (the 4th contract pillar) is completely missing — no trust, verification, or provenance UI at all. This is the user's "my private bin" layer that must participate in the safety/provenance story for exact-part decisions and fab handoff. Currently it is a provenance blind spot. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended My Parts section (2026-05-23).*

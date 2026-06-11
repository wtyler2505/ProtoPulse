# Learn Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Learn work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Learn behavior.

## Pending Proposals

- Add screenshots for the main Learn states.
- Add more specific gotchas after the next real Learn implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-learn)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-learn/scripts/inspect-learn.mjs` → **Status: ok** (KnowledgeView.tsx 466 lines / 39 CCN, 0 tracked tests).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep analysis:
   - scc: 392 code / 39 CCN (very low — clean lightweight browser/orchestrator).
   - Full read of `KnowledgeView.tsx` (article browser with difficulty/category/tags, search, InteractiveCard + VaultHoverCard on every article for "Explore in Vault", simple markdown renderer, difficulty badges, TODO for vaultMoc field + Plan 13 integration).
   - Uses `useKnowledgeBase` (lib/electronics-knowledge) — curated subset, not the full qmd/Ars Contexta vault or NotebookLM hubs.
   - Cross-referenced entire campaign (pp-knowledge, pp-nlm-operator, vault tools, provenance/VaultHoverCard usage across Component Editor/Exports/Generative/Breadboard/3D, Labs, History, Audit Trail, Dashboard, Inventory, Digital Twin).
4. Grepped for source quality display, view-aware help, vaultMoc/vault linkage, bidirectional MOC integration.
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (Learning Content / Search / Source Quality / View Aware Help):**

- **Clean, focused learning content browser (strength):** Good article cards with difficulty badges, category, time-ish feel via tags, preview text, search, and filters. Uses modern primitives (`InteractiveCard` from Architecture work). `VaultHoverCard` on every article ("Explore in Vault") provides a direct bridge to provenance/source quality teaching. This satisfies "Learning Content" and "Search" well for curated electronics topics.

- **"Source Quality" is delegated but not deeply surfaced inline (P1 gap):** The contract requires Source Quality to be "visible enough." The view relies on `VaultHoverCard` for category-level teaching, but individual articles do not show rich inline source metadata (datasheet vs experiment vs vault note, verification date, evidence strength, NotebookLM hub origin, etc.). The TODO in the code (`article.vaultMoc` + Plan 13) explicitly acknowledges that deeper bidirectional vault integration is planned but not yet present.

- **"View Aware Help" is aspirational / one-way (P1 gap):** The contract requires View Aware Help to be visible. Currently the view is a standalone hub. There is no evidence in the code that other views (Breadboard, 3D, Component Editor, Generative, Labs, etc.) dynamically surface context-specific vault notes or help from this surface. The reverse (articles linking out via VaultHoverCard) exists, but view-aware injection into the maker tools does not appear to be wired here.

- **This is a curated subset, not the full knowledge system the user has built:** The heavy investment in Ars Contexta (qmd, pipeline, MOCs, provenance), NotebookLM hubs (pp-core, pp-hardware, pp-nlm-operator), vault tools, and cross-hub synthesis is not visible or navigable from this view. Users get a nice "electronics for beginners/intermediates" experience, but not the full "this is the living knowledge graph behind ProtoPulse" experience.

- **No tests recorded (notable gap for a source-quality / help surface):** The skill records zero tests. Per the gotchas, this increases risk for search, rendering, and the critical VaultHoverCard provenance teaching paths.

- **Low complexity, clean code (positive):** 39 CCN on 392 LOC — the view is deliberately thin. The TODO referencing E2E-552 / Plan 03 Phase 4 and InteractiveCard migration shows the team is tracking the broader system cleanup.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Deepen Source Quality display and vault linkage (directly serves the provenance + vault investment)**
- Add per-article source metadata display (origin type, verification date, evidence strength, NotebookLM hub tags, vaultMOC slug) using the same primitives as VaultHoverCard / TrustReceiptCard.
- Complete the `vaultMoc` field + bidirectional linking so every article is a first-class vault citizen (Plan 13 work).
- Make "Explore in Vault" richer — show a mini provenance summary inline before expanding the hover card.

**P1 — Implement real View Aware Help (the contract's fourth pillar)**
- Wire the Learn surface so that other views can request context-specific vault notes (e.g., "in Breadboard with this exact part selected, show relevant vault notes on pinout verification and mechanical fit").
- Add a "View-aware help" panel or command that pulls from the knowledge base + vault based on current view + selected objects (component, net, 3D model, lab, etc.).

**P1 — Decide scope: curated learning hub vs full knowledge system portal**
- Either evolve KnowledgeView into the primary user-facing portal for the Ars Contexta vault + NotebookLM hubs (with MOC navigation, cross-hub synthesis, source freshness, etc.), or explicitly scope it as "curated electronics for learners" and create a separate "Vault Explorer" or "Knowledge Portal" for the full system.
- The current gap leaves the massive vault/knowledge investment mostly invisible to end users.

**P2 — Test coverage for search + provenance teaching**
- Record test globs in the skill and add coverage for search/filter, VaultHoverCard rendering, difficulty/category metadata, and (once implemented) view-aware help resolution.

**P2 — Polish for laptop viewports and accessibility**
- The eslint disable at the top references the InteractiveCard migration — finish that work so role="button" divs become real buttons.
- Ensure the article list + detail view scroll and focus correctly on laptop heights when many tags or long content are present.

**Strengths (relative to peers):**
- Clean, low-complexity learning content browser with excellent use of existing provenance primitives (`VaultHoverCard`, `InteractiveCard`, difficulty badges).
- Explicit awareness of deeper vault integration (TODO referencing Plan 13 and vaultMoc) — the team knows the gap.
- Good metadata (difficulty, category, tags) and search/filter UX for its intended audience (beginner/intermediate electronics learners).

**Cross-Cutting Value (extremely high):**
- This is the primary **user-facing learning + source quality** surface that should make the entire Ars Contexta vault, NotebookLM hubs (pp-core, pp-hardware), pp-knowledge, and provenance system discoverable and trustworthy.
- It is the natural home for "View Aware Help" that can inject context-specific vault notes into every other view (Breadboard, 3D, Component Editor, Generative, Labs, Exports, etc.).
- With the heavy investment in the knowledge system, this view is where that investment becomes visible and actionable to users instead of remaining an internal agent tool.

**Durable Lesson:**
A clean curated learning hub that correctly uses VaultHoverCard for provenance teaching can still leave the full knowledge system (vault + NotebookLM + pipeline + MOCs) invisible if it remains a one-way curated subset without bidirectional vaultMoc linkage, inline source quality metadata, and view-aware help injection into the maker tools. The UX contract requires Source Quality and View Aware Help to be visible — after the vault and provenance campaigns, Learn must become the place where users see and trust the living knowledge graph.

**Recommended for Codex (immediate high-ROI tasks):**
1. Complete the `vaultMoc` field + bidirectional linking so every article is a first-class vault citizen (finish the Plan 13 TODO).
2. Add per-article inline source quality display (origin, verification, evidence strength, NotebookLM tags) using existing provenance primitives.
3. Implement real View Aware Help: allow other views to request context-specific vault notes based on current selection (component, net, lab, 3D model, etc.).
4. Decide and document the scope (curated learner hub vs full knowledge portal) and evolve the UI accordingly (add MOC navigation / hub cross-query if it becomes the portal).
5. Record tests in the skill and add coverage for search, VaultHoverCard, and (once implemented) view-aware help resolution. Finish the InteractiveCard a11y migration.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc (39 CCN), explicit TODO for vaultMoc/Plan 13, source quality and view-aware help gaps, and cross-references to pp-knowledge, pp-nlm-operator, vault tools, provenance (VaultHoverCard usage), breadboard-lab, 3D, Component Editor, Generative, Labs, History, Audit Trail, and Dashboard.
- No production code mutated during discovery.
- All findings tied directly to the vault, NotebookLM, provenance, and education work from the same handoff campaign.

---

*Learn analysis complete. Clean curated electronics learning hub with good use of provenance primitives, but Source Quality is delegated rather than deeply surfaced, View Aware Help is not yet implemented as injection into other views, and the full Ars Contexta + NotebookLM knowledge system is not visible. This should be the primary user-facing portal for the living knowledge graph. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Learn section (2026-05-23).*

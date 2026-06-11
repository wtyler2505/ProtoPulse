# Vault Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Vault work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Vault behavior.

## Pending Proposals

- Add screenshots for the main Vault states.
- Add more specific gotchas after the next real Vault implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

## Fast Workflow Execution Report — 2026-05-23 (pp-view-vault Audit)

**User Command:** `/pp-view-vault`

**Inspector (entry + final exit):**
- Status: **ok** both times.
- Tracked tests: **0** (none recorded)
- Primary source: `client/src/components/views/VaultBrowserView.tsx` (637 lines / 543 code / **77 CCN**)
- Three-pane layout: Left MOCs (topic maps), Middle notes (search or MOC-linked), Right full markdown note body with chips
- Uses `useVaultSearch`, `useVaultMocs`, `useVaultNote` hooks (client/src/hooks/useVaultSearch.ts)
- Server requires search or MOC selection (no blind "list all")
- References all present. Re-run after discovery remained clean.

**Exact Fast Workflow Sequence Followed (non-negotiable contract):**
1. `node .agents/skills/pp-view-vault/scripts/inspect-vault.mjs` → ok
2. Read `references/page-map.md` (25 lines)
3. Read `references/ux-contract.md` (24 lines) — before any browsing/search/provenance synthesis
4. Read `references/testing.md` (27 lines)
5. Read `references/gotchas.md` (17 lines) — before any sync/persistence/trust analysis
6. Read `SKILL.md` (Tier 3, single 637-line file)
7. Deep source inspection (VaultBrowserView + hooks + MarkdownContent usage + chip rendering) + mandatory ast-grep + scc
8. Cross-campaign synthesis vs. Ars Contexta knowledge system (qmd, NotebookLM pp-core/pp-hardware, pipeline, provenance methodology), provenance visibility (source taxonomy, verification date, reliability tier), UI Container Rule on three-pane layout, "AI-generated or uncertain data" marking in knowledge notes
9. Durable appends to this log + master report (section 41)
10. Final inspector re-run (ok)

**Quantitative Snapshot (scc):**
- 543 code / **77 CCN** — moderate for Tier 3 (three-pane coordination + search + MOC filtering + markdown rendering + chip interactions)

**Source Ownership:**
- `VaultBrowserView.tsx` (skill-owned)
- Hooks: `useVaultSearch`, `useVaultMocs`, `useVaultNote` (in client/src/hooks/)
- Note rendering: `MarkdownContent` from chat/MessageBubble (reused)
- Data model: Ars Contexta vault notes with frontmatter (name, description, topics, audience, provenance, claims, etc.) + MOCs (topic maps)

**Deep Analysis vs. UX Contract (Vault Browsing / Knowledge Sources / Search / Provenance):**

- **Vault Browsing & Search (functional three-pane design):**
  - Left: MOC/topic map navigation (filter middle pane to linked notes)
  - Middle: search results or MOC-linked notes (with chips)
  - Right: full note body (MarkdownContent) + clickable topic chips + linked-note chips
  - "Search or MOC required" default state (instructional empty state instead of dumping the entire vault) — good design for large knowledge bases.
  - Reuses MarkdownContent (consistent with chat rendering).

- **Knowledge Sources & Provenance (the pillar that matters most for this skill):**
  - The ux-contract explicitly lists **"Provenance"** as one of the four must-hold-true pillars.
  - The Ars Contexta methodology (and the vault-health / vault-source skills) defines provenance as: source taxonomy (datasheet / standard / community / vendor-doc / textbook / paper / experiment / ai-suggested / code / other), URL, page, verification date + verifier, reliability tier.
  - In VaultBrowserView.tsx, provenance is **not directly rendered as a first-class block** in the code we read (no dedicated <VaultSource> or provenance table in the JSX). It likely lives inside the markdown body of the note itself (as the note author is expected to include a provenance section) or via a separate component not visible in the top-level view.
  - This creates a discoverability gap: the right pane shows the note body + chips, but does not guarantee or elevate the structured provenance block that the methodology requires for every note.
  - "AI-generated or uncertain data is clearly marked" — if a note came from an AI suggestion or has low verification, the UI does not add a visual treatment on the card or header; it relies on the note content.

- **Layout & UI Container Rule (three-pane risks on laptop):**
  - Three horizontal panes (MOCs | notes | body) + chips + markdown content create the classic risks (fixed widths, nested ScrollArea, laptop-height failures, content clipping when the right pane has long markdown + many chips).
  - The skill's gotchas correctly flag "fixed heights and nested overflow" and "small-height desktop viewports."

- **Tests (gap):**
  - 0 tracked. Browser checks (load, MOC selection, search, chip click, right-pane scroll, keyboard navigation, provenance visibility) are the current contract.

**Cross-References to Prior Campaign Work:**
- Ars Contexta knowledge system (qmd, NotebookLM pp-core/pp-hardware, pipeline, /vault-source, /vault-health, /vault-validate, /vault-audience, /vault-index) — the VaultBrowserView is the primary UI surface for all of that.
- Provenance campaign (the through-line of the entire 41-view audit) — this skill explicitly owns the "Provenance" pillar for the knowledge vault.
- NotebookLM / pp-knowledge skills (Codex-owned) — the hubs feed the vault that this view browses.
- "AI-generated or uncertain data" marking across the app (Generative, Component Editor, Tasks board, Kanban, etc.) — the vault browser must make it visible for knowledge notes.
- UI Container Rule on multi-pane browsers (same class of problem as right/left sidebars, chat, simulation viewers, Kanban).

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Make Provenance first-class and guaranteed visible in the right pane**
- Add a dedicated, always-visible (or one-click expandable) provenance block in the right pane for the selected note (source taxonomy, URL, verification date, verifier, reliability tier, claims).
- Use or create a reusable <VaultSource> / provenance component (consistent with the methodology in the vault-source skill).
- Visually mark AI-suggested or low-verification notes at the card/header level (not just inside the markdown).

**P1 — Enforce UI Container Rule on the three-pane layout on laptop viewports**
- MOC list, note list, and right-pane markdown + chips must all remain reachable via scroll/collapse/resize on realistic laptop heights. The current three-pane flex + nested ScrollArea is fragile.

**P2 — Add tracked tests for the core browsing flows** (MOC selection, search, chip navigation, right-pane rendering, provenance block visibility, empty instructional state, keyboard navigation).

**P2 — Extract reusable components** (MocList, NoteListItem, ProvenanceBlock, NoteChips) from the 637-line view so the page skill stays focused on orchestration while the primitives can be reused in VaultHoverCard and other knowledge surfaces.

**Strengths (relative to peers):**
- Clean three-pane information architecture that matches the Ars Contexta model (MOCs as entry points, notes as atomic claims, full body + chips for navigation).
- Reuses MarkdownContent for consistency.
- "Search or MOC required" default prevents dumping the entire vault — thoughtful for large knowledge bases.
- The skill explicitly names "Provenance" as a first-class pillar (rare and correct).

**Durable Lessons for Future Agents:**
- When a skill's own ux-contract lists "Provenance" as one of four pillars, the UI must make the structured provenance block (source taxonomy, verification date, reliability tier) first-class and guaranteed visible — not buried inside the note body or absent.
- Three-pane browsers are exactly the surfaces where UI Container Rule (laptop height, nested scroll, chip overflow) fails silently; they require explicit laptop-viewport stories and collapse/resize primitives.
- The knowledge vault browser is the public face of the entire Ars Contexta system. If provenance is not elevated here, the "verified knowledge" claim of the product is invisible to the user.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 0 tests).
- Mandatory ast-grep + text search showed no first-class provenance block rendering in VaultBrowserView (it relies on note content or downstream components).
- Full scc report (543 code / 77 CCN) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).
- All findings cross-referenced to the Ars Contexta knowledge system (qmd, NotebookLM hubs, pipeline, /vault-source, /vault-health, /vault-validate, /vault-audience, /vault-index), the provenance campaign (the through-line of the entire audit), UI Container Rule on multi-pane browsers, "AI-generated or uncertain data" marking, and prior Tier 3 audits (Project Explorer, Starter Circuits, Supply Chain).
- Detailed Fast Workflow Execution Report appended here; master report section 41 written.

---

*Vault analysis complete. This is a clean Tier 3 three-pane Vault browser (77 CCN) that provides good MOC/topic navigation, search, and note reading with consistent markdown + chip navigation. The "Vault Browsing / Knowledge Sources / Search" pillars are functionally solid. The "Provenance" pillar (explicitly named in the skill's own contract) is not yet first-class in the UI — it is not guaranteed visible as a structured block (source taxonomy, verification date, reliability tier) and AI-suggested/low-verification notes are not visually marked at the card level. This is a high-leverage gap for the knowledge system that the entire Ars Contexta vault depends on. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Vault section (2026-05-23).*

# Learning Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Resolve all Pass 1/2 Vault, Learn, Patterns, Starter Circuits, Labs findings. Decide the consolidation outcome (17 Wave 2 proposes merging 4 surfaces into one Learn Hub; Vault remains separate as knowledge-graph root). Implement the decision. Ship cross-links so every Learn article deep-links to the Vault MOC for further reading (E2E-423). Add "Start Lab" CTA (E2E-452), progress tracking (E2E-453), graph view for Vault (E2E-400, E2E-402), and difficulty filter semantics.

**Architecture:** 3 waves — (1) Learn Hub consolidation decision + implementation, (2) Vault deepening + graph view, (3) per-surface polish (wiki-link rendering, filter-pill active states, card affordance fixes).

**Parent:** Tier F. Depends on 03 (InteractiveCard for cards), 16 (primitives), 17 (tab structure decision).

## Coverage

| Source | IDs |
|--------|-----|
| Pass 1 Vault | E2E-001-005 |
| Pass 2 Vault | E2E-396-402 |
| Pass 2 Learn | E2E-421-425 |
| Pass 2 Patterns | E2E-441-445 |
| Pass 2 Starter | E2E-446-450 |
| Pass 2 Labs | E2E-451-455 |
| Systemic merge | E2E-487 |
| Expanded | E2E-286 chevron affordance |

## Existing Infrastructure

- `client/src/components/views/KnowledgeView.tsx` (Vault)
- `client/src/components/views/DesignPatternsView.tsx`
- `client/src/components/views/StarterCircuitsPanel.tsx`
- `client/src/components/panels/LabTemplatePanel.tsx`
- Vault back-end: Ars Contexta (already shipped per project memory)
- `qmd` MCP tool for Vault queries

## Research protocol

- **Context7** `cytoscape.js` or `react-force-graph` — Vault graph view (Wave 2)
- **Vault** `qmd search "learning hub"`, `qmd search "knowledge graph view"`
- **WebSearch** "Obsidian graph view UX — scale performance with thousands of notes"
- **Advisor** — before Wave 1 (merge decision commits UX direction).

## Waves

### Wave 1 — Learn Hub merge decision + implementation (E2E-487, E2E-423, E2E-455)

- [ ] Task 1.1 — `advisor()` on merge
  - Option A: ONE "Learn Hub" tab with filter pills (Learn / Patterns / Starters / Labs). Vault stays separate.
  - Option B: Keep 4 tabs, add cross-link headers.
  - Recommendation: Option A per 17 Wave 2 grouping.
- [ ] Task 1.2 — Implement Option A: single `LearnHubView.tsx` with type filter + unified card grid. Keep existing sub-surface components as renderers behind the filter.
- [ ] Task 1.3 — Cross-link every Learn article → Vault MOC (E2E-423): card footer "Read more in Vault →".
- [ ] Task 1.4 — Time estimate badge on all cards (E2E-451 pattern replicated to Learn + Patterns + Starter).
- [ ] Task 1.5 — Tests + commit.

### Wave 2 — Vault deepening (E2E-001-005, E2E-396-402)

- [ ] Task 2.1 — De-duplicate note title (E2E-001): single h1 per note.
- [ ] Task 2.2 — Search clear button (E2E-002).
- [ ] Task 2.3 — Wiki-link rendering (E2E-003): `[[esp32-adc2...]]` renders as clickable cross-note link (use regex + `<Link>`).
- [ ] Task 2.4 — Active MOC filter chip + clear (E2E-004).
- [ ] Task 2.5 — Responsive behavior for narrow screens (E2E-005).
- [ ] Task 2.6 — Brighter MOC count badges (E2E-397).
- [ ] Task 2.7 — Empty-state recently-viewed note pre-load (E2E-398).
- [ ] Task 2.8 — "Topic Maps" → "Topics" rename for beginners (E2E-399).
- [ ] Task 2.9 — Graph view sub-tab (E2E-400, E2E-402): force-directed graph of all notes, edges = wiki-links. Zoom + filter by MOC.
- [ ] Task 2.10 — Tests + commit.

### Wave 3 — Per-surface polish

- [ ] Task 3.1 — Patterns card chevron click area (E2E-286, E2E-442).
- [ ] Task 3.2 — "Apply pattern to project" CTA (E2E-443): one-click instantiate into Architecture/Schematic (cross-tab action).
- [ ] Task 3.3 — Category legend on Learn (E2E-422, E2E-404).
- [ ] Task 3.4 — Starter "Open Circuit" multi-target (E2E-450): Send to Schematic / Breadboard / PCB dropdown.
- [ ] Task 3.5 — Labs "Start Lab" CTA on every card (E2E-452).
- [ ] Task 3.6 — Progress bar per lab (E2E-453).
- [ ] Task 3.7 — Recommended for first-time badge (E2E-454).
- [ ] Task 3.8 — Filter-pill active-state styling (E2E-447).
- [ ] Task 3.9 — ESP32/RP2040/STM32 starter variants (E2E-449) → backlog entry; skip from this plan.
- [ ] Task 3.10 — Tests + commit.

## Checklist

```
□ Prereqs: 03, 16, 17 merged
□ check/test/lint/prettier clean
□ Playwright learn-hub-*, vault-* pass
□ Vault MOC cross-link count > 0 after migration
□ advisor() ≥1× (Wave 1 Task 1.1)
```

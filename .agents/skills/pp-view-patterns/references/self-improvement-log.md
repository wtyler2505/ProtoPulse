# Patterns Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Patterns work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Patterns behavior.

## Pending Proposals

- Add screenshots for the main Patterns states.
- Add more specific gotchas after the next real Patterns implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-patterns)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-patterns/scripts/inspect-patterns.mjs` → **Status: ok** (DesignPatternsView.tsx 964 lines / 72 CCN, 0 tracked tests — large educational browser + "My Snippets" CRUD).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep analysis:
   - scc: 852 code / 72 CCN (moderate — two-tab UI: curated Patterns grid + My Snippets CRUD, with expand-to-detail educational content).
   - Full read of `DesignPatternsView.tsx` (Tabs for "Patterns" vs "My Snippets"; PatternCard with InteractiveCard + expand to show whyItWorks/components/connections/tips/common mistakes; difficulty/category filters + search; DifficultyBadge; My Snippets tab with create/edit/delete via useDesignSnippets; no "apply" buttons, no trust/provenance UI).
   - Uses `getAllPatterns` / `getPatternsByCategory` etc. from `@/lib/design-patterns` (DesignPattern with name, description, category, difficulty, whyItWorks, etc.) and `useDesignSnippets` from `@/lib/design-reuse` (DesignSnippet CRUD).
   - Cross-referenced entire campaign (Generative for pattern-seeded generation, Component Editor for subcircuit/mechanical patterns, breadboard-lab for wiring patterns, 3D View for mechanical/enclosure patterns, Lifecycle for pattern maturity, Exports/Order PCB for "known-good fab patterns", provenance/trust story, Learn/Knowledge for educational content, Inventory for part-based patterns).
4. Grepped for apply flow, trust/provenance badges, verification status, generative origin, usage evidence, source quality on pattern cards.
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (Reusable Patterns / Search/Browse / Apply Flow / Pattern Trust):**

- **Solid educational / documentation browser for patterns (strength):** The "Patterns" tab provides a clean, searchable, filterable grid of curated `DesignPattern` cards with difficulty badges, category icons, and rich expandable educational content (whyItWorks, components, connections, tips, common mistakes). The "My Snippets" tab provides practical CRUD for user-owned reusable fragments. Search/Browse is well implemented. This satisfies the educational side of "Reusable Patterns" and "Search/Browse."

- **"Apply Flow" pillar is completely missing (direct P1 contract violation):** The UX contract explicitly requires "Apply Flow is visible enough." There are **no apply buttons, no "use this pattern" actions, no integration with breadboard/3D/Component Editor/Generative**. The view is read-only documentation + personal snippet management. Users cannot yet take a pattern and instantiate it into their current design (as new CircuitInstances, breadboard placements, 3D components, etc.).

- **"Pattern Trust" pillar is completely missing (direct P1 contract violation):** The UX contract explicitly requires "Pattern Trust is visible enough." There are **zero** trust, verification, provenance, or confidence UI elements on the pattern cards or in the detail view:
  - No badges for verification status, source evidence, usage count across projects, maturity/lifecycle, generative origin, or community contribution.
  - No link to "who verified this pattern" or "last used successfully in these designs."
  - The "AI-generated or uncertain data is clearly marked" contract is not served for patterns at all.
  - "My Snippets" has no provenance stamping when a user creates one from their own work.

- **No connection to the provenance / 3D / breadboard / generative / lifecycle systems (P1 gap):** The entire campaign has built rich provenance (verification, generative origin, breadboard/3D usage, lifecycle). Patterns are the perfect vehicle for reusable, trusted assets, but the view does not yet participate in that story. A pattern that has been successfully used in 47 projects with verified exact parts and good 3D mechanical fit should surface that evidence; currently it does not.

- **"My Snippets" is a good start for user-generated patterns but lacks trust stamping:** When a user creates a snippet from their own design, it should automatically carry provenance (source design snapshot, parts used with their verification status, breadboard/3D context). It currently does not.

- **0 tests recorded (notable gap for a trust/apply surface):** The skill records zero tests. Per the gotchas, this increases risk for the two-tab UI, filters, expand/collapse, and any future apply/trust flows.

- **Good use of modern primitives (positive):** Uses `InteractiveCard`, `Tabs`, `EmptyState`, `ScrollArea`, etc. The two-tab structure (curated library + personal snippets) is a thoughtful separation.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Implement Apply Flow (direct contract violation)**
- Add "Apply Pattern" / "Instantiate" action on every curated pattern and user snippet.
- On apply, create the corresponding elements in the current context (new CircuitInstances in the active design, breadboard placements, 3D components with mechanical data, etc.), preserving any part provenance.
- Offer choices: "Apply to current schematic", "Apply to breadboard", "Apply as 3D mechanical sub-assembly", "Seed generative run with this pattern as constraint."

**P1 — Implement Pattern Trust / provenance UI (direct contract violation)**
- Add visible trust badges and provenance summary on every PatternCard and in the expanded detail (verification status, source evidence, usage count across projects, maturity/lifecycle, generative origin, last successful use).
- For "My Snippets," automatically stamp provenance when created (linked design snapshot, parts with their verification status, breadboard/3D context) and display it.
- Use the same VaultHoverCard / TrustReceiptCard primitives as Exports, Order PCB, Component Editor, Generative, etc.

**P1 — Wire Patterns into Generative, Component Editor, Breadboard, 3D, Lifecycle, Exports as first-class reusable assets**
- Generative should be able to use patterns as seeds or constraints.
- Component Editor should offer "save this subcircuit/mechanical arrangement as a reusable pattern."
- Breadboard and 3D should offer "apply this wiring/mechanical pattern."
- Lifecycle and Exports should treat patterns as "known-good" or "maturity-stamped" assets that improve readiness scores.

**P2 — Add usage evidence and "proven in the wild" signals**
- Show real usage counts and example projects (anonymized or with permission) that have successfully used the pattern.
- Allow users to "endorse" or "report success" when they apply a pattern, feeding back into its trust score.

**P2 — Test coverage for the two-tab UI, filters, expand/collapse, and (once implemented) apply/trust flows**
- Record test globs in the skill and add coverage for search/filter, tab switching, snippet CRUD, and the new apply/provenance UI.

**Strengths (relative to peers):**
- Thoughtful two-tab structure (curated library for learning + personal snippets for reuse).
- Rich educational content per pattern (whyItWorks + components + connections + tips + common mistakes) — excellent for the "Learn" side of the platform.
- Good use of modern UI primitives (`InteractiveCard`, `Tabs`, `EmptyState`).
- Clean separation between system-curated patterns and user-owned snippets.

**Cross-Cutting Value (extremely high):**
- This is the **reusable assets / knowledge amplification** layer that turns individual successful designs into platform-wide leverage.
- Patterns that carry rich provenance (verification, generative origin, breadboard/3D usage evidence, lifecycle maturity) become the highest-trust building blocks users can apply, directly multiplying the value of the Component Editor, 3D View, breadboard-lab, and Generative systems.
- It is one of the primary places where the entire provenance and safety story becomes reusable and teachable at scale.

**Durable Lesson:**
A beautiful two-tab patterns browser with rich educational content can still leave the most important "trust" and "apply" questions unanswered if it never surfaces Pattern Trust (verification, provenance, usage evidence) or provides an Apply Flow that instantiates the pattern into the user's actual breadboard/3D/schematic with provenance preserved. The contract requires all four pillars — after the 3D, breadboard-lab, Component Editor verification, Generative, and provenance campaigns, Patterns must become the place where users find, trust, and safely apply proven reusable assets, not just read about them.

**Recommended for Codex (immediate high-ROI tasks):**
1. Implement Apply Flow: add "Apply" actions on patterns and snippets that create the corresponding elements in the current design context (CircuitInstances, breadboard placements, 3D components) while preserving part provenance.
2. Implement Pattern Trust UI: add verification status, source evidence, usage counts, maturity/lifecycle, generative origin badges on every card and in the detail view using existing provenance primitives.
3. Wire "My Snippets" creation to automatically capture and stamp provenance from the source design (linked snapshot, parts with verification status, breadboard/3D context).
4. Integrate with Generative (use pattern as seed/constraint), Component Editor (save sub-arrangement as pattern), Breadboard/3D (apply wiring/mechanical pattern), Lifecycle (pattern maturity), and Exports (known-good patterns improve readiness).
5. Record tests in the skill and add coverage for the two-tab UI, filters, CRUD, and the new apply/trust flows.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc (72 CCN), exact missing Apply Flow and Pattern Trust UI, educational content strength, and cross-references to Generative, Component Editor, breadboard-lab, 3D View, Lifecycle, Exports, Order PCB, Learn, and the full provenance/trust campaign from the same handoff audit.
- No production code mutated during discovery.
- All findings tied directly to the reusable assets, provenance, 3D mechanical, exact-part, breadboard-lab, Generative, and knowledge system work from the same handoff campaign.

---

*Patterns analysis complete. Solid educational two-tab browser (curated patterns + My Snippets) with rich "why it works" content, but "Apply Flow" and "Pattern Trust" (two of the four contract pillars) are completely missing. No apply actions, no provenance/verification/usage evidence on the cards. This should be the reusable trusted assets layer that multiplies the value of 3D, breadboard, Component Editor, and Generative — currently it is read-only documentation. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Patterns section (2026-05-23).*

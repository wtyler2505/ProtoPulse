# Generative Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Generative work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Generative behavior.

## Pending Proposals

- Add screenshots for the main Generative states.
- Add more specific gotchas after the next real Generative implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-generative)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-generative/scripts/inspect-generative.mjs` → **Status: ok** (GenerativeDesignView.tsx 425 lines, 53 tracked tests across view + lib/generative-design/**, strong coverage especially on adopt flow).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep quantitative + structural analysis:
   - scc on view + lib: 9 files, 2767 code LOC, 388 complexity (hotspots: generative-adopt.ts 100 CCN, circuit-mutator.ts 91 CCN, fitness-scorer, generative-engine).
   - Full read of `GenerativeDesignView.tsx` (split layout: spec + constraint sliders on left, candidate grid with fitness bars/rank/previews on right, AdoptCandidateDialog, live Architecture IR integration).
   - Core lib: `generative-engine.ts`, `generative-adopt.ts` (compare/adopt/export with `generatedFrom: 'generative-design'` provenance stamp), `circuit-mutator.ts`, `fitness-scorer.ts` (constraint-driven: budget/power/thermal).
   - AdoptCandidateDialog shows clear added/removed/changed diff with status badges.
   - Cross-referenced entire campaign (3D hybrid, Component Editor exact-part verification + mechanical, breadboard-lab provenance, Digital Twin, Exports trust receipts, Dashboard health, Architecture extraction).
4. Grepped for trust/provenance markers (`generatedFrom`, VaultInfoIcon, etc.).
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (AI Generation / Proposal Review / Adoption Flow / Trust Labels):**

- **Solid generative core with explicit provenance stamping (major strength):** The evolutionary loop (engine + mutator + fitness with hard constraints + adopt) is well factored. On adoption, nodes are stamped with `data: { generatedFrom: 'generative-design', candidateId, ... }` — this is exactly the "AI-generated or uncertain data is clearly marked" primitive the breadboard-lab + Component Editor + Exports + trust work have been building. Comparison in AdoptCandidateDialog is clear (added/removed/changed badges).

- **Proposal Review + Adoption Flow are functional but visually light on "trust" (P1 gap):** The candidate cards show fitness % / rank / bars / component count, and the dialog shows diff. However, the explicit `generatedFrom` label and any richer trust/provenance UI (badges like in Component Editor verification or Exports TrustReceiptCard, VaultHoverCard explanations, "this was AI-generated — review before fab" warnings) are not prominent on the cards or in the review dialog. The UX contract requires "Trust Labels" to be "visible enough."

- **No visible bridge to the 3D / mechanical / exact-part world (P1 gap after the 3D rescue):** Generated candidates live in Architecture IR. There is no "Preview this proposal in 3D" (using the now-hardened BoardViewer3DView), no automatic creation of candidate exact parts in Component Editor with pending verification, no breadboard placement preview or mechanical fit check before adoption. Adoption is one-way into the canvas without carrying the richer provenance the rest of the system now expects.

- **Constraint-driven generation is thoughtful:** Budget/power/thermal sliders feed the fitness scorer — good engineering alignment with real hardware constraints (ties to Component Editor thermal/mechanical data and breadboard power concerns).

- **Test coverage is strong on the critical adopt path (positive signal):** 53 tests, heavy emphasis on generative-adopt.test.ts — the place where provenance is injected.

- **Layout is clean split-pane but must watch scroll/focus on live generation:** Left column scrolls for spec, right grid of cards. As generations run, the UI updates; laptop viewport and focus management during long evolutions should be verified.

**P0 / P1 / P2 Backlog Items for Codex (added to master report):**

**P1 — Make Trust Labels first-class and visible on candidates + adoption (directly serves the provenance identity)**
- On candidate cards and in AdoptCandidateDialog, surface prominent "AI-Generated" / "generative-design" badges, candidate ID, and (where available) confidence or fitness provenance.
- Use or extend VaultHoverCard / TrustReceiptCard primitives so hovering the badge explains "This proposal was produced by the evolutionary engine — review the diff and constraints before adopting."
- On adoption, ensure the stamped `generatedFrom` data is also written to any created exact parts (Component Editor) or 3D model entries so downstream Exports, Validation, and Board Health can surface "this part originated from generative design and has not been verified."

**P1 — Bridge generated proposals to 3D View + Component Editor + Breadboard before adoption**
- Add "Preview in 3D" action on candidates that feeds the proposal IR into the hardened BoardViewer3DView (with temporary airwires or component placement for review).
- On adoption, offer optional "Create as exact part candidate in Component Editor (verification pending)" and/or "Place on breadboard as starter/exact-part proposal."
- This closes the loop so generative output can be mechanically validated (3D fit, breadboard wiring, exact-part verification) before it becomes "real" in the canonical model.

**P2 — Richer Proposal Review explanations**
- Beyond the diff, surface "why this candidate scored well" (which constraints it satisfied best, which mutations helped) so users can learn from the AI rather than treat it as a black box.

**P2 — Lifecycle / rejection paths**
- Make it easy to reject a generation run or individual candidates while still capturing the attempt in history/audit-trail for later review of "what the AI proposed."

**Strengths (relative to peers):**
- Clean separation of concerns (engine, mutator, scorer, adopt) with real test depth on the adoption/provenance injection point.
- Explicit `generatedFrom` stamping is the right architectural move for the entire trust story.
- Constraint sliders + fitness feedback loop is practical engineering, not pure novelty.
- Live integration with the Architecture context (recent fix from audit C-1 shows responsiveness to prior findings).

**Cross-Cutting Value (very high):**
- This is the "create from AI" surface that must feed the provenance, 3D, exact-part, breadboard, and export pipelines with correct trust labels from day one.
- If generative output bypasses the verification and mechanical review surfaces built elsewhere, the safety story breaks at the source.

**Durable Lesson:**
A generative design tool that correctly stamps `generatedFrom: 'generative-design'` on adoption has done the hard architectural part right — but if the UI does not make those trust labels obvious on the candidate cards and in the review dialog, and if there is no path to preview the proposal in the hardened 3D View or as a pending exact part before adoption, the "AI-generated or uncertain data is clearly marked" contract fails in practice. The system now has the primitives (Component Editor verification, 3D mechanical, breadboard provenance); generative must become a first-class consumer and producer of them.

**Recommended for Codex (immediate high-ROI tasks):**
1. Add prominent, hoverable trust badges ("Generative Design", candidate ID, fitness provenance) on every candidate card and in AdoptCandidateDialog, using VaultHoverCard or TrustReceiptCard patterns.
2. Wire "Preview in 3D" and "Create as exact-part candidate (verify before use)" options on adoption or per-candidate actions.
3. Ensure adopted nodes carry provenance that is respected by Exports precheck, Validation, Board Health, and Dashboard health surfaces.
4. Add or expand tests that assert provenance data is present after adoption.
5. Run full browser checklist on the live generation + candidate grid flow (laptop height, focus during evolution, scroll with many candidates).

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement-log entry with scc hotspots, explicit `generatedFrom` stamp location, UI gap analysis vs the four pillars, and cross-references to 3D, Component Editor, breadboard-lab, Digital Twin, and Exports trust work.
- No production code mutated during discovery.
- All findings tied directly to the provenance/trust and 3D mechanical campaigns from the same handoff audit.

---

*Generative analysis complete. The core engine + explicit provenance stamping is architecturally sound; the UI visibility of trust labels and the bridges to 3D / exact-part / breadboard review are the clear gaps to close so generative output is born with the same safety expectations as manual work. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Generative section (2026-05-23).*

---

**R17 Generative -> 3D bridge**

**Date:** 2026-05-24.

Candidate cards now include `View 3D`. The action publishes the candidate id, first component refdes, title, fitness subtitle, component count, `generatedFrom: generative-design`, and an explicit `ai-generated` / `candidate` / `readyNow: false` trust state through the generic bridge before switching to `viewer_3d`. This keeps generated designs out of the “looks authoritative” path until they are reviewed.

## R23 Keyboard Lesson

Generative spec sliders need stable `data-testid` and `aria-label` values. Without them, different range inputs collapse to the same generic `input` selector in the keyboard helper and look like a focus trap even when focus is moving.

---

**R26 Generative Browser Bridge Proof**

**Date:** 2026-05-25.

The 3D bridge E2E spec now opens Generative, runs the actual generator with a small population and one generation, clicks the first candidate `View 3D` action, and verifies the 3D viewer receives AI provenance. The card must show `Generative candidate`, `ai generated`, `generated`, a fitness subtitle, component count, and `needs review`.

Durable lesson: Generative-to-3D proof should use the real engine path when possible. Mocked unit tests prove payload shape, but the product requirement is that a user-generated candidate can cross the route boundary into 3D review without looking verified.

---

**R36 Generative 3D structured fitness**

**Date:** 2026-05-25.

Generative 3D handoffs now publish `sourceName: Generative design engine` and numeric `fitnessScore` through the shared bridge. The 3D viewer renders that source and fitness as explicit badges while preserving `ai-generated`, `generated`, component count, and `needs review`.

Durable lesson: A fitness number in subtitle text is too fragile for downstream safety UI. Generated candidates need structured fitness provenance so 3D review, validation, and later money gates can all read the same value.

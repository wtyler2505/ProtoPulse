# Breadboard View + Lab — Scoped Product Analysis Report
**Command:** `/product-analysis -> /pp-view-breadboard + breadboard-lab` ("Closely and carefully analyze every detail")
**User Intent:** 1 + 3 + 4 (full scoped report + tight deep-dive on the worst file + thorough Lab-inclusive treatment)
**Date:** 2026-05-18

## Executive Summary

The Breadboard View + Lab is the most important surface in ProtoPulse for the hobbyist, educator, and startup maker personas — the place where beginners first experience "this tool understands how I actually build things."

It is also currently the highest-risk surface in the product.

**Quantitative reality:**
- 66 TypeScript files, **17,434 LOC**, **3,602 complexity points** dedicated to breadboard.
- The single worst file in the entire 1.4M+ LOC codebase is `breadboard-canvas/index.tsx` (1,677 LOC / 475 complexity).
- Multiple other 800–1,400 LOC high-complexity modules (board-audit, part-inspector, coach plan, view-sync) all feed into or are owned by the same small set of files.
- The file that owns the entire interactive experience even contains the line: "Phase 2 (W1.12b) will split this into sub-files." That extraction never happened.

**Qualitative reality (against the contracts the skills themselves mandate):**
- The core Lab identity (bench/stash vs board placement, provenance, trust/readiness, coach guidance that is more believable than verified data, schematic sync that feels safe, hardware photo inspection as a natural part of the bench) is implemented inside the most complex, least-owned runtime in the product.
- The breadboard-lab skill's own references (`workflow-playbook.md`, `ai-audit-and-sync.md`, `gotchas.md`) repeatedly flag exactly the areas that are currently concentrated in the god canvas as high-risk.
- Competitively, Fritzing owns the "this feels like a real breadboard" experience for teaching. ProtoPulse's massive integration advantage (schematic, coach, inventory, procurement, VLM hardware inspection, digital twin) is currently undermined because the core canvas does not yet feel as physically believable or provenance-clear as the simpler dedicated tool.

This is not a "nice to have polish" problem. This is the place where the "maker who starts on breadboard and never leaves" story either succeeds or quietly fails.

The 3D View analysis showed us one high-visibility surface with data, renderer, and dead-code problems. The breadboard analysis shows us the **central workflow** of the entire maker platform implemented as a single growing, acknowledged-but-unextracted runtime with no clean boundaries between the canvas, the bench model, the coach, the sync engine, and the trust system.

## Phase 0 Baseline (Breadboard Surface Only)

- 17,434 LOC / 3,602 complexity across 66 files.
- Top 5 monsters: breadboard-canvas (1,677/475), breadboard-board-audit (1,406/396), breadboard-part-inspector (816/409), view-sync (766/176), BreadboardView orchestrator (708/147).
- The canvas file is larger and more complex than any single 3D View file, and unlike the 3D case it is the active production path for the primary maker workflow.

(See `.agents/analysis/breadboard-canvas-deep-dive.md` for the full structural autopsy of the 1,677 LOC file.)

## Phase 1 — Current State Inventory (View + Lab)

**What exists and is substantial:**
- Full interactive SVG canvas with pan/zoom, wire drawing, component placement, bendable legs, ratsnest, DRC overlay, connectivity explainer, keyboard cursor, simulation current flow.
- Bench / stash model (parts can live on the bench with bench coordinates before being committed to the breadboard).
- Starter shelf, inventory dialog, exact part request, quick intake.
- Coach plan generation + visual overlays + remediation application (`useBreadboardCoachPlan`).
- Board health / audit with focus integration.
- Hardware photo inspection + VLM analysis (HardwareInspectionPanel).
- Schematic ↔ Breadboard bidirectional sync engine (view-sync.ts) with provenance tracking.
- Trust / readiness / part inspector model.
- Undo/redo, auto-placement, selection, context menus, wire color, accessibility announcer.

**What is missing or weak (per the contracts):**
- Clear, immediate visual + inspector-level provenance for every part and wire (starter vs stash vs exact vs coach vs synced).
- First-class "bench → board" mental model transition.
- Coach and board health outputs that are as actionable and trusted as the physical placement itself.
- Hardware inspection as a natural, discoverable part of the bench rhythm rather than a separate panel.
- Physical realism and collision/intuition parity with the dedicated breadboard tool (Fritzing) that educators already trust.

The implementation is large and sophisticated. The ownership boundaries and mental model clarity are not yet at the same level as the feature surface.

## Phase 2 — Competitive Gap (Fritzing as Primary Breadboard Rival + Integration Opportunity)

Fritzing's strength is exactly what the ProtoPulse breadboard-lab claims to improve: the feeling that you are working with real physical parts on a real bench.

ProtoPulse's differentiation is the rest of the stack (schematic sync that actually works, coach that understands your specific board, inventory that knows what you own, hardware photo that lets you inspect the real thing you just built, procurement that closes the loop).

Currently the integration advantage is at risk because the core canvas + bench experience has the same class of problems the 3D View had (god file, unclear data boundaries, complex logic not yet extracted) plus the additional complexity of two coordinate systems and live sync.

The gap that matters most for the education persona is not "does ProtoPulse have more features?" It is "when I put a real resistor on my real breadboard photo, does the coach and the schematic and the inventory all stay coherent and trustworthy, or does it feel like two different tools fighting?"

## Phase 3 — UX & Workflow Evaluation (Against the Actual Contracts)

The `pp-view-breadboard` UX contract and `breadboard-lab` workflow-playbook are unusually explicit. The analysis measured directly against them.

**Violations called out in the checklist (selected):**
- Cannot instantly distinguish part provenance (direct violation of "Starter parts, project-linked parts, stash parts, and exact parts are clearly different").
- Hardware inspection is not "reachable without hunting" in the primary bench flow.
- Coach guidance and board health are not yet first-class, immediately actionable citizens of the bench mental model.
- The god canvas makes small changes high-risk, violating the spirit of "BreadboardView.tsx is an orchestrator. Keep new local logic small."
- Sync can succeed silently in ways the lab skill itself warns against.

The testing guide in the skill is excellent. The reality of coverage on the interaction matrix inside the canvas is the usual pattern: heavy investment in dialogs and happy paths, lighter structural coverage of the runtime that actually moves parts and wires between bench and board.

## Phase 4 — Technical Debt & Architecture (The Canvas Is the Story)

The dedicated deep-dive (`.agents/analysis/breadboard-canvas-deep-dive.md`) is the authoritative source.

Key findings:
- The file knows it should have been split and wasn't.
- It owns two coordinate systems whose distinction is the entire point of the "Lab".
- It is the execution environment for coach, the timing gate for sync, the owner of drop provenance, and the renderer of everything.
- Supporting modules (board-audit 1.4k, part-inspector 800+, coach plan 600+, sync 766) are themselves large and feed back into the same runtime.

This is classic "successful ambitious feature grows faster than the team's extraction discipline." The difference from many codebases is that ProtoPulse's own skills documented the problem and the intended fix — and the fix did not land.

## Phase 5 — Innovation Opportunities (After the P0 Debt)

Once the canvas has reasonable ownership boundaries and provenance/trust is visually immediate:
- Make the bench → board commit a first-class, visible, coach-aware, hardware-inspectable gesture.
- Reverse sync ("this physical bench configuration becomes the schematic of record").
- Physical simulation and clearance that works on the bench area the same way it does on the placed board.
- "Show me the real-world equivalent of this coach suggestion" that opens the hardware inspection photo with the relevant area highlighted.
- Deep Fritzing import/export + "Fritzing mode" for pure teaching moments while keeping the integrated ProtoPulse experience for real projects.

These are the features that would make the education persona say "ProtoPulse is what Fritzing should have become."

## Cross-Phase / Meta Synthesis

The breadboard-lab skill was created because the surface is important enough to deserve its own page skill with contracts, gotchas, and inspection scripts. The contracts are unusually good.

The implementation has not yet caught up to the clarity of its own contracts.

The 3D View was a high-visibility but somewhat peripheral ambitious feature. Breadboard View + Lab is central to the "I start here and the rest of the tool actually helps me" story. The debt concentration in one file + the lack of clean boundaries between canvas, bench, coach, sync, and trust is the highest systemic risk to the maker value proposition that currently exists in the product.

**Bottom line:** The "shit that needs to be done" on breadboard is larger, more central, and more culturally important than the 3D problems we found earlier. The good news is that the skill contracts already tell us exactly what "done" looks like. The bad news is that the most complex file in the product is currently the place where all of those contracts are most at risk.

---

**Deliverables produced in this run:**
- This report
- `docs/product-analysis-breadboard-checklist.md` (ruthless prioritized action list)
- `.agents/analysis/breadboard-canvas-deep-dive.md` (tight technical autopsy of the 1,677 LOC monster)
- Updates to both breadboard skill self-improvement logs (new lessons from the analysis)

The analysis followed the exact mandated workflow of both `pp-view-breadboard` and `breadboard-lab` skills before any synthesis. All findings are traceable to the contracts, the code, and the quantitative data.
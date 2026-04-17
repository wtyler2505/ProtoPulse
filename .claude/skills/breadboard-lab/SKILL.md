---
name: breadboard-lab
description: ProtoPulse Breadboard Lab — the full maker-bench workflow skill. Use for BreadboardView, starter/project/exact-part flows, bench stash, board health, DRC overlay, coach plan, inventory reconciliation, preflight, wire editing, bench-pin endpoint wiring, connectivity explainer, schematic↔breadboard sync, and breadboard realism. Triggers on breadboard, breadboard lab, board health, bench, exact part, starter shelf, breadboard coach, breadboard inventory, wire editing, breadboard sync, breadboard workbench, reconciliation, preflight, bench pin, ratsnest, snap preview.
---

# Breadboard Lab — The Maker Workbench

Treat the Breadboard tab as **a physical bench with rules**, not an SVG editor. Every interaction must map to something a real person can do with a real breadboard, real parts from their stash, and a real DMM.

## Quick Reference

| Topic | File | LOC | Role |
|---|---|---:|---|
| **Main entrypoint** | `client/src/components/circuit-editor/BreadboardView.tsx` | 2284 | Orchestration shell (toolbar, canvas, overlays, dialogs, coach) — **ALWAYS start here** |
| Workbench sidebar | `client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx` | 347 | Right-rail surface: starter shelf, project parts, stash, exact-part dialog triggers |
| Starter shelf | `client/src/components/circuit-editor/BreadboardStarterShelf.tsx` | — | Canonical starter parts a beginner can drop on a bench instantly |
| Inventory dialog | `client/src/components/circuit-editor/BreadboardInventoryDialog.tsx` | — | "What's on my bench / in my drawer" reconciliation |
| Exact-part request | `client/src/components/circuit-editor/BreadboardExactPartRequestDialog.tsx` | — | User asks for a specific MPN → resolver → verified/candidate/needs-draft |
| Reconciliation | `client/src/components/circuit-editor/BreadboardReconciliationPanel.tsx` | — | BOM gaps, stash diffs, shopping list surface |
| Shopping list | `client/src/components/circuit-editor/BreadboardShoppingList.tsx` | — | Shortfall items surfaced as buy-this list |
| Quick intake | `client/src/components/circuit-editor/BreadboardQuickIntake.tsx` | — | "Which board do you have?" fast onboarding |
| Board audit | `client/src/lib/breadboard-board-audit.ts` + `BreadboardBoardAuditPanel.tsx` | 891 | Scored issue generator + remediation UI |
| Bench trust/readiness | `client/src/lib/breadboard-bench.ts` | 332 | Per-part readiness labels (verified-exact / connector-defined / heuristic / stash-absent) |
| Part inspector | `client/src/lib/breadboard-part-inspector.ts` + `BreadboardPartInspector.tsx` | 754 | Selected-part detail panel — pin map confidence, fit, provenance |
| Layout quality | `client/src/lib/breadboard-layout-quality.ts` | 240 | Scoring: rail usage, signal-path length, decoupling adjacency |
| Preflight | `client/src/lib/breadboard-preflight.ts` | 523 | "Can this build? What's missing?" before bring-up |
| Coach plan | `client/src/lib/breadboard-coach-plan.ts` + `useBreadboardCoachPlan.ts` + `BreadboardCoachOverlay.tsx` | 393 | Proactive guidance: next-step suggestions grounded in selected part |
| AI prompts | `client/src/lib/breadboard-ai-prompts.ts` | 175 | Coach prompt templates — keep trust-tier language consistent |
| 3D rendering | `client/src/lib/breadboard-3d.ts` | 700 | Optional 3D preview model of the board + placed parts |
| Canvas grid | `client/src/components/circuit-editor/BreadboardGrid.tsx` | — | Hole array rendering, drop-preview, fit zones |
| Component renderer | `client/src/components/circuit-editor/BreadboardComponentRenderer.tsx` | — | SVG footprint rendering with bendable legs |
| Bench-pin renderer | `client/src/components/circuit-editor/BreadboardBenchPartRenderer.tsx` | — | Off-board parts (Mega, hub motor, BLDC driver) that attach via bench pins |
| Wire editor | `client/src/components/circuit-editor/BreadboardWireEditor.tsx` + `breadboard-wire-editor.ts` | — | Select/move/delete wires with endpoint snap preview |
| DRC overlay | `client/src/components/circuit-editor/BreadboardDrcOverlay.tsx` + `breadboard-drc.ts` | — | Real-time violations: shorts, floating inputs, missing decouplers |
| Connectivity overlay | `client/src/components/circuit-editor/BreadboardConnectivityOverlay.tsx` + `breadboard-connectivity.ts` | — | Visualize the electrical net graph beneath the board |
| Connectivity explainer | `client/src/components/circuit-editor/BreadboardConnectivityExplainer.tsx` | — | "Why is this pin connected to that one?" — teach the rail model |
| Shared model | `client/src/lib/circuit-editor/breadboard-model.ts` | — | Canonical data model: holes, rails, occupancy, placement geometry |
| Bench connectors | `client/src/lib/circuit-editor/breadboard-bench-connectors.ts` | — | Bench-pin endpoint rules for off-board parts |
| Drag/move | `client/src/lib/circuit-editor/breadboard-drag-move.ts` | — | Placement drag semantics with grid snap |
| Undo | `client/src/lib/circuit-editor/breadboard-undo.ts` | — | Breadboard-scoped undo/redo stack |
| Sync | `client/src/lib/circuit-editor/view-sync.ts` | — | Schematic ↔ breadboard net + placement coherence |
| Animations | `client/src/components/circuit-editor/breadboard-animations.css` | — | Drop preview, snap halo, coach highlight keyframes |
| Cursor hook | `client/src/lib/circuit-editor/useBreadboardCursor.ts` | — | Cursor-style state: pointer / drawing-wire / placing / rejecting |

**Total surface: ~4,000+ lines of breadboard-specific logic.** The skill's job is to keep those systems coherent.

## When To Invoke This Skill

YES — use this skill for:
- Any change to `BreadboardView.tsx` or files it orchestrates
- Starter shelf / project shelf / exact-part flow changes
- Board health surfacing, issue remediation, focus behavior
- Coach plan logic, overlay, prompts, trust-tier messaging
- Canvas interaction (drop preview, snap, zoom/pan, overlays)
- Bench-pin endpoint wiring for off-board parts
- Sync drift / duplicate wires between schematic and breadboard
- Inventory reconciliation, preflight gating, shopping list
- Part-inspector trust/readiness display
- Anything touching `knowledge/breadboard-intelligence.md` claims

NO — defer or compose:
| Instead of... | Use this skill... |
|---|---|
| Pure schematic editor work | schematic-specific context |
| PCB layout / copper / gerber | pcb-specific context |
| Generic unit test methodology | `testing-mastery` + this skill together |
| Generic verification | `verification-mastery` + this skill together |
| Pure styling unrelated to Breadboard behavior | `frontend-design` + this skill together |
| Circuit DSL / generative design | circuit-dsl or generative-design context |

## The Mandatory 6-Question Breadboard Lens

**Every change must answer all six before shipping:**

1. **Beginner onboarding** — Can a first-time user figure out how to start within 5 seconds of opening the tab?
2. **Provenance clarity** — Does the UI distinguish starter-generic, project-linked, and verified-exact parts unambiguously? (icon + label + color, not color alone)
3. **Stash-grounded readiness** — Is "can I build this right now?" answered by what the user actually owns, not by design intent?
4. **Debugging confidence** — Does the change help a user diagnose a real problem on a real board, or does it only add visual density?
5. **Cross-view coherence** — After this change, does the schematic / validation / inventory / AI guidance still agree with the breadboard?
6. **Browser-verified** — Is the improvement proven in a real browser at the actual viewport Tyler uses, not just in tests?

If any answer is "no" or "not sure," the change isn't ready.

## Mental Model: Five Interlocked Systems

```
┌──────────────────────────────────────────────────────────────┐
│                    WORKBENCH SHELL                           │
│   Starter Shelf │ Project Shelf │ Stash │ Exact-Part │ Audit │
└────────────┬─────────────────────────────────────┬───────────┘
             │                                     │
             ▼                                     ▼
┌─────────────────────────────┐  ┌──────────────────────────────┐
│     CANVAS EDITING           │  │   TRUST & READINESS          │
│ • Placement + snap preview   │  │ • Fit check (breadboard vs   │
│ • Wire editor (incl. bench   │  │   off-board-only)            │
│   pin endpoint snap)         │  │ • Pin-map confidence          │
│ • DRC overlay                │  │ • Stash truth (have / need)   │
│ • Connectivity overlay       │  │ • Layout quality score        │
│ • Bendable legs + realism    │  │ • Board audit issues          │
└──────────────┬───────────────┘  └──────────────┬───────────────┘
               │                                  │
               ▼                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                     COACH / AI                                │
│  selected-part plan · prompt shaping · prevention-first      │
└─────────────────────────────┬─────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                   SYNC & PROVENANCE                           │
│  schematic ↔ breadboard nets · dedup · origin labels         │
└──────────────────────────────────────────────────────────────┘
```

**You cannot strengthen one without maintaining the others.** Every change touches at least two; verify the interaction.

## Canonical Trust Tiers (use these EXACT labels everywhere)

| Tier | Meaning | Example | UI color cue |
|---|---|---|---|
| `verified-exact` | Connector map, footprint, and electrical profile verified against a real datasheet + physical sample | Arduino Uno R3 (0.3" wide, 14+6 headers), NodeMCU ESP32-S (2.3mm spacing) | Green shield icon + "Verified" badge |
| `connector-defined` | Pin map is defined but physical / electrical profile is partial | Generic `IC_DIP16` with placeholder pin names | Yellow dashed outline + "Pins defined" |
| `heuristic` | System inferred footprint or pins; no user or vault confirmation | AI-placed 555 timer before user confirms pinout | Blue dotted outline + "Inferred" |
| `stash-absent` | Referenced in BOM but not in user's inventory | Required but unowned | Red ghost outline + "Buy / request" |

**Never flatten these tiers** in copy, sorting, filtering, or coach output. A user deciding whether to breadboard a design right now needs to know which parts are verified-exact and which are heuristic.

## Standard Workflow

1. **Orient** — read `./breadboard-architecture-and-entrypoints.md` for file map.
2. **Classify** — which of the 5 subsystems does this request primarily touch?
3. **Check if already exists** — grep the codebase. Many requested features exist as lib helpers or dormant dialog props that aren't surfaced from `BreadboardView.tsx` yet.
4. **Consult the vault** — `knowledge/breadboard-intelligence.md` lists every verified-board quirk, layout rule, and bench-coach claim. Use `mcp__qmd__qmd_vector_search` with "breadboard" + topic to find adjacent claims.
5. **Design smallest change** — keep the 5-subsystem coherence. Reject changes that improve one pillar at the cost of another.
6. **Write/update tests** — see `./breadboard-testing-and-browser-verification.md`. Test the interaction, not the isolated function.
7. **Typecheck + standalone test** — `npm run check` must be clean; targeted Vitest must pass.
8. **Browser verify** — load the tab in the app, exercise the flow, capture evidence.
9. **Capture new knowledge** — if the work revealed durable product knowledge, route it through `inbox/` → `/arscontexta:extract` → `knowledge/`.

## Reference Files (load as needed)

| File | When to load |
|---|---|
| `./breadboard-architecture-and-entrypoints.md` | File/subsystem map, routing requests to entrypoints |
| `./breadboard-workflow-playbook.md` | Product workflow expectations, UX heuristics |
| `./breadboard-testing-and-browser-verification.md` | Test matrix + Chrome DevTools verification checklist |
| `./breadboard-ai-audit-and-sync.md` | Coach plan, audit scoring, trust tiers, sync invariants |
| `./breadboard-knowledge-vault-links.md` | Ars Contexta vault notes that directly shape breadboard behavior |
| `./breadboard-common-tasks.md` | Recipe-style canned procedures for frequent request shapes |
| `./breadboard-anti-patterns.md` | Things we've learned NOT to do — flag in review |

## Related Skills

- `frontend-design` — styling, cyberpunk theme, responsive
- `testing-mastery` — framework-level test patterns
- `verification-mastery` — pre-completion verification
- `chromedevtools-mastery` — real-browser verification
- `project-context` — broader ProtoPulse architecture
- `arscontexta:extract` — when knowledge emerged for the vault

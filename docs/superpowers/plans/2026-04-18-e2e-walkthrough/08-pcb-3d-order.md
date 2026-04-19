# PCB, 3D View, Order PCB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Resolve Pass 1/2 PCB + 3D + Order PCB findings. Consume the single board source-of-truth shipped by `02-p1-dead-buttons.md` Phase 4 (`useProjectBoard()` / `/api/projects/:id/board`). Fix layer visibility sync (E2E-233 via 02), layer presets disclosure, auto-fit board on tab entry, 3D thickness rendering, wizard step-indicator polish, saved fab profiles.

**Architecture:** 3 waves — (1) PCB editor UX (auto-fit, layer color taxonomy, trace tooltips, layer presets), (2) 3D View board thickness + view angle icons + component hints, (3) Order PCB wizard polish + fab profiles + project-type recommendation.

**Tech Stack:** React + SVG/Canvas for PCB 2D, Three.js via react-three-fiber for 3D (verify via grep), Radix Tabs/Select for fab selection.

**Parent:** Tier D. Depends on 02 Phase 4 board source-of-truth, 01 Phase 3 DRC guard. Innovations (STL/STEP export E2E-368; stack 3D IoT E2E-810 etc.) → 18.

---

## Coverage

| Source | IDs |
|--------|-----|
| Pass 1 PCB | E2E-044-050 |
| Pass 2 PCB | E2E-357-363 |
| Pass 2 3D | E2E-364-369 |
| Pass 2 Order PCB | E2E-410-415 |
| Systemic | E2E-228, E2E-235, E2E-270, E2E-488 (handled by 02 Phase 4 — consume) |
| Spinbutton | E2E-236, E2E-271 (handled by 02 Phase 7 — consume) |
| Layer viz | E2E-233 (handled by 02 Phase 6 — consume) |

## Existing Infrastructure

| Concern | File |
|---------|------|
| PCB view | `client/src/components/circuit-editor/PCBLayoutView.tsx` |
| 3D view | `client/src/components/views/BoardViewer3DView.tsx` |
| Order PCB view | `client/src/components/views/PcbOrderingView.tsx` |
| Board hook | `client/src/hooks/useProjectBoard.ts` (shipped by 02 Phase 4) |
| Board API | `server/routes/boards.ts` (shipped by 02) |

## Research protocol

- **Context7** `@react-three/fiber` + `@react-three/drei` — "boxGeometry thickness + layer stack rendering"
- **WebSearch** "PCB layer color conventions — KiCad vs Eagle vs Altium" — Wave 1 palette
- **WebSearch** "JLCPCB / PCBWay API auto-quote integration" — Wave 3

## Waves

### Wave 1 — PCB editor

- [ ] Task 1.1 — Auto-fit board on tab entry (E2E-358): compute viewport fit on mount + on board-geometry change.
- [ ] Task 1.2 — Active layer pill color fix (E2E-359): `F.Cu (Front)` bright red = warning-implying; use primary cyan for active.
- [ ] Task 1.3 — Layer presets disclosure (E2E-360): hide 16-layer/32-layer behind "More" disclosure; show 2/4/6/8 by default.
- [ ] Task 1.4 — Layer panel sync with Layer Stack (E2E-361, E2E-233 cross-ref): one source of truth — consume `useProjectBoard().layers`.
- [ ] Task 1.5 — Trace slider tooltips (E2E-362): "Default 2mm is fine for power; signal traces use 0.25mm".
- [ ] Task 1.6 — Diff pair tool + length matching (E2E-363): verify toolbar "D" exists; add length-tuning UI in sidebar.
- [ ] Task 1.7 — Polish Pass 1 gaps (E2E-044-050): per-finding small fixes (TSV).
- [ ] Task 1.8 — Tests + commit.

### Wave 2 — 3D View

- [ ] Task 2.1 — Board thickness render (E2E-364): box geometry with 1.6mm depth instead of flat parallelogram. Config via `useProjectBoard().thicknessMm`.
- [ ] Task 2.2 — Internal layer checkboxes (E2E-365): ensure 4/6-layer internal layers render + are toggleable (not "uncheckable yet shown").
- [ ] Task 2.3 — Inline board edit (E2E-366): drag corner to resize board; commit via `useProjectBoard().mutate`.
- [ ] Task 2.4 — Empty state hint (E2E-367): "Place components in Schematic to see them here" when 0 components.
- [ ] Task 2.5 — STL/STEP export (E2E-368) → route to `15-generative-digital-twin-exports.md` as it owns Exports tab. Pin-1 markers + polarity indicators: implement here.
- [ ] Task 2.6 — View angle icons (E2E-369): Lucide cube-face icons for Top/Bottom/Front/Back/Left/Right/Iso.
- [ ] Task 2.7 — Tests + commit.

### Wave 3 — Order PCB wizard

- [ ] Task 3.1 — Compatible-Fabs "4/5" linkage (E2E-411): show which 5 fabs were checked + which failed and why.
- [ ] Task 3.2 — Step indicators larger (E2E-412): numbered circles, not tiny dots.
- [ ] Task 3.3 — Project-type recommendation wizard step (E2E-413): new step "Tell me about your project (cost vs speed vs quality)" → AI-recommend fab.
- [ ] Task 3.4 — Saved fab profiles (E2E-414): per-user saved credentials + API keys — integrate with Settings > API Keys (17 Phase 7).
- [ ] Task 3.5 — Real footer nav (E2E-415): promote Previous/Next bar from floating to sticky footer.
- [ ] Task 3.6 — Tests + commit.

## Vault integration (added 2026-04-19)

Per master-index §7 + §13.

### Planned insertions

| Task | Insertion site | Target vault slug | Status |
|------|----------------|-------------------|--------|
| Wave 1 Task 1.5 (trace slider tooltips) | PCB trace-width slider — `<VaultExplainer slug="trace-width-vs-current-carrying-capacity">` | `trace-width-vs-current-carrying-capacity-ipc-2221` | 🟡 seed gap |
| Wave 1 Task 1.4 (layer stack sync) | Each layer row "?" icon → `<VaultHoverCard topic="copper-prepreg-soldermask-stackup">` | `pcb-layer-stack-copper-prepreg-soldermask-silkscreen` | 🟡 seed gap |
| Wave 3 Task 3.3 (project-type recommendation) | AI recommendation engine reads MOC `pcb-fabrication-comparison` | `moc-pcb-fabrication-comparison-jlc-oshpark-pcbway-tradeoffs` | 🟡 seed gap (create MOC) |
| Wave 3 Task 3.4 (fab profile cards) | Each fab card (JLC/OSH Park/PCBWay) has `vaultSlug` metadata | `jlcpcb-capability-matrix`, `osh-park-capability-matrix`, `pcbway-capability-matrix` | 🟡 seed gaps |
| Wave 2 Task 2.5 (pin-1 markers + polarity indicators) | 3D view polarity overlay — "Why pin 1?" tooltip | `pin-1-marker-conventions-dot-notch-bevel` | 🟡 seed gap |

### Gap stubs to seed

```
/vault-gap "PCB trace width vs current carrying capacity IPC-2221" --origin-plan 08-pcb-3d-order.md --origin-task 1.5
/vault-gap "PCB layer stack copper prepreg soldermask silkscreen" --origin-plan 08-pcb-3d-order.md --origin-task 1.4
/vault-gap "PCB fabrication comparison JLCPCB OSH Park PCBWay tradeoffs" --origin-plan 08-pcb-3d-order.md --origin-task 3.3
/vault-gap "JLCPCB capability matrix minimum trace via tolerance" --origin-plan 08-pcb-3d-order.md --origin-task 3.4
/vault-gap "OSH Park capability matrix purple 2-layer 4-layer stackup" --origin-plan 08-pcb-3d-order.md --origin-task 3.4
/vault-gap "PCBWay capability matrix HDI flex rigid-flex" --origin-plan 08-pcb-3d-order.md --origin-task 3.4
/vault-gap "pin 1 marker conventions dot notch bevel IC polarity" --origin-plan 08-pcb-3d-order.md --origin-task 2.5
```

### Consumption pattern

```tsx
<Slider value={traceWidth} onValueChange={setTraceWidth}>
  <TooltipTrigger>
    <VaultExplainer slug="trace-width-vs-current-carrying-capacity-ipc-2221">
      Trace width determines current capacity. 10mil ≈ 0.5A at 10°C rise.
    </VaultExplainer>
  </TooltipTrigger>
</Slider>
```

## Team Execution Checklist

```
□ Prereqs: 02 Phase 4 + 6 + 7 MERGED (board hook + layer viz sync + spinbutton fix)
□ npm run check / test / eslint / prettier clean
□ Playwright pcb-*, 3d-*, orderpcb-* suites pass (assert all 3 tabs consume useProjectBoard)
□ advisor() ≥1× (Task 2.1 three.js thickness perf)
```

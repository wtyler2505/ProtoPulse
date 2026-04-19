# Architecture Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Resolve all Pass 1/2/7/8/9 Architecture findings — sidebar density, pin handle discoverability, edge labels + protocol type tags + auto-color, auto-layout, multi-select + align tools, net browser for architecture, group-as-subsystem, smart AI suggestion ghost nodes, live cost + power-budget overlay, architecture lints — while keeping `tool-analyze` working (fixed in `02-p1-dead-buttons.md` Phase 2) and the clean React Flow canvas the audit praised.

**Architecture:** 5 waves — (1) sidebar cleanup (BME280 triplicate, category icons labels, resize), (2) handle discoverability (3-stage pulse, edge preview, drag-from-handle), (3) edge customization (labels, protocol tags, auto-color by type, active-during-sim), (4) multi-select + align + group-as-subsystem, (5) live cost + power-budget + architecture lints + ghost-node AI suggestions.

**Tech Stack:** React Flow 11.x (Node/Edge types, handles, default edges), shadcn/ui combobox for edge-label protocol selector, existing `ArchitectureAnalyzer` (fixed in 02).

**Parent:** `00-master-index.md` Tier D. §3.1 routing E2E-019-025, E2E-076-088, E2E-326-333, E2E-743-844. Cross-owner on E2E-078 (02 fixes dead button; this plan adds tool-auto-layout / tool-group / tool-add-text). Innovations E2E-776-778 / E2E-809-818 / E2E-832-844 → `18-innovation-roadmap.md`.

**Tier:** D. **Depends on:** 01, 02, 03, 16, 17.

---

## Coverage

| Source | IDs | Routing |
|--------|-----|---------|
| Pass 1 | E2E-019-025, E2E-076-088 | owned |
| Pass 2 | E2E-326-333 | owned |
| Pass 7 | E2E-743-778 | owned except E2E-776-778 (→18) |
| Pass 8 | E2E-779-818 | owned except E2E-809-818 (→18) |
| Pass 9 | E2E-819-844 | owned except E2E-832-844 (→18) |

TSV: `coverage/05-architecture-coverage.tsv`.

## Existing Infrastructure (verified 2026-04-18)

| Concern | File | Notes |
|---------|------|-------|
| View | `client/src/components/views/ArchitectureView.tsx` (verified handler sites in 02 plan) | Primary target |
| Asset Library | within view, category filters + Favorites + Recently Used + 12 parts | Wave 1 |
| Analyzer | `client/src/lib/architecture-analyzer.ts` | Fixed by 02 Phase 2 |
| Node types | `client/src/components/views/architecture-nodes/*` (grep) | Wave 2 handle scaling |
| Edge types | grep `reactflow.*edge|defaultEdgeOptions` | Wave 3 |

## Research protocol

- **Context7** `reactflow` — "handle customization + hover state + connection line preview" / "edge markers + labels + custom edge components"
- **Context7** `d3-force` OR `elkjs` — auto-layout algorithm for Wave 4
- **WebSearch** "Lucidchart smart connector routing" — Wave 3
- **WebSearch** "IEEE/UML bus protocol notations (I2C, SPI, UART)" — Wave 3 Task 3.2
- **Advisor** — before Wave 2 (handle scale thresholds), before Wave 5 (cost overlay data path).

## Waves

### Wave 1 — Sidebar cleanup (E2E-744, E2E-745, E2E-753, E2E-760, E2E-762, E2E-019-022, E2E-326-333, E2E-984)

- [ ] Task 1.1 — Resolve BME280 triplicate (E2E-760): Favorites + Recently Used + main list — keep part in Favorites/Recent but mark main list entries with "⭐" if favorited instead of listing 3× separately.
- [ ] Task 1.2 — Category filter labels (E2E-326, E2E-744): 6 icon glyphs get labels under each (All / MCU / Power / Comm / Sensor / Connector). Keep count badges.
- [ ] Task 1.3 — Main list header "All Parts (12)" (E2E-745).
- [ ] Task 1.4 — Asset Library separator + spacing (E2E-327): clear divider between filters row and Favorites header.
- [ ] Task 1.5 — Resize handle smooth (E2E-753, E2E-984): verify; default 280px.
- [ ] Task 1.6 — Search placeholder + scope clarification (E2E-762): placeholder "Search parts by name, MPN, or tag"; `/` hotkey confirmed via global command palette (17 Phase 6).
- [ ] Task 1.7 — Drag-handle icon on each part (E2E-331): `≡` icon left of part name signals draggability.
- [ ] Task 1.8 — Tile-grid view toggle (E2E-332): list/grid toggle for expert dense view.
- [ ] Task 1.9 — Tests + commit.

### Wave 2 — Handle discoverability + edge preview (E2E-779-782, E2E-819-820, E2E-943, E2E-755)

- [ ] Task 2.1 — 3-stage handle hover (E2E-779, E2E-819): (a) within 40px = scale 1.2×, (b) within 15px = scale 1.6× + cyan glow ring, (c) cursor on handle = scale 2× + tooltip "from BME280 pin SDA".
- [ ] Task 2.2 — Handle pulse on idle (E2E-780): `animate-pulse` keyframe on handles when node selected + no wire-tool active. Honors `prefers-reduced-motion`.
- [ ] Task 2.3 — Edge-drag preview line (E2E-781, E2E-820): during drag, render preview with distance, edge type guess ("looks like an I2C bus"), validity color, predicted signal-integrity warning if long route.
- [ ] Task 2.4 — Edge arrowhead for direction (E2E-782): directed vs undirected distinction via marker-end config.
- [ ] Task 2.5 — Handle size parity with Schematic (E2E-943, E2E-967): Schematic uses 10px; Architecture must match or exceed.
- [ ] Task 2.6 — Real pointer drag-from-handle Playwright (E2E-755, E2E-681 pattern): create architecture edge via real mouse events.
- [ ] Task 2.7 — Tests + commit.

### Wave 3 — Edge labels, protocol tags, auto-color, active-sim (E2E-783-784, E2E-821-822, E2E-787-788)

- [ ] Task 3.1 — Edge labels (E2E-783, E2E-821): click edge → inline editor with free text + type-tag dropdown (I2C/SPI/UART/Power/GPIO/Ethernet/USB) + bidirectional arrows toggle + protocol inline icon (Lucide `ArrowLeftRight` for bidir).
- [ ] Task 3.2 — Auto-color edges by type (E2E-784, E2E-822): Power=amber, Ground=grey, Signal=cyan, Data bus=purple, etc. Map from token system (16 Phase 1 domain tokens).
- [ ] Task 3.3 — Active-during-sim edge state (E2E-822): simulation running → flashing cyan edges = transmitting; dim grey = idle; red = error. Stub render for now; wire to sim engine when ready.
- [ ] Task 3.4 — Multi-handle parallel connect (E2E-787): hold Shift + drag → spawn parallel edges for a bus signal group.
- [ ] Task 3.5 — AI wire-from-suggest (E2E-788): select 2 nodes + click "Suggest connections" → AI proposes typical edges ("ESP32 → BME280 via SDA/SCL + VCC/GND"). Uses `GatedAIButton` from 16 Phase 5.
- [ ] Task 3.6 — Node category legend in toolbar (E2E-749).
- [ ] Task 3.7 — Mini map edge tracing (E2E-751).
- [ ] Task 3.8 — Tests + commit.

### Wave 4 — Node manipulation + align + group-as-subsystem + auto-layout (E2E-747-748, E2E-768-770, E2E-789-795, E2E-823-826, E2E-830-831, E2E-758-759)

- [ ] Task 4.1 — Auto-layout button `tool-auto-layout` (E2E-747, E2E-768): run elkjs or d3-force on current nodes → re-arrange with fade animation. `advisor()` on algorithm choice.
- [ ] Task 4.2 — Add text annotation `tool-add-text` (E2E-769).
- [ ] Task 4.3 — Group region `tool-group-region` (E2E-770): select N nodes → "Group" → labeled colored region ("Power section", "MCU subsystem"). Collapsed subsystem node shows mini preview of internals (E2E-826).
- [ ] Task 4.4 — Multi-select marquee + Shift/Ctrl click + select-by-category + select-by-degree (E2E-791, E2E-824).
- [ ] Task 4.5 — Align tools in contextual mini-toolbar (E2E-792, E2E-825): Figma pattern — small toolbar above selection with align-left/center/right/distribute-horizontal/vertical.
- [ ] Task 4.6 — Snap to grid + smart-snap to other node edges within 8px (E2E-789, E2E-823).
- [ ] Task 4.7 — Pin-mode lock (E2E-795): lock a node so it can't be moved.
- [ ] Task 4.8 — Hide/show non-critical nodes filter (E2E-794): show only Power / Data / etc.
- [ ] Task 4.9 — Regenerate CTA always accessible (E2E-758): `Generate Architecture` from empty-state remains as toolbar button post-first-node; keyboard `G`.
- [ ] Task 4.10 — Drop at click-location on `+` (E2E-759): current `+` drops at fixed offset causing overlap; auto-find empty canvas region OR require a click after `+`.
- [ ] Task 4.11 — Zoom-to-issue on DRC toast (E2E-830) + mini-map rectangle drag (E2E-831).
- [ ] Task 4.12 — Tests + commit.

### Wave 5 — Net browser + dependency + smart suggestions + cost/power overlay + lints (E2E-796-800, E2E-827-829, E2E-835-836, E2E-842, E2E-801-805, E2E-771-775)

- [ ] Task 5.1 — Net browser for architecture (E2E-796, E2E-827): dual-pane sidebar — nets on left, nodes/edges in selected net on right.
- [ ] Task 5.2 — Dependency trace tool (E2E-797, E2E-800): `tool-dependency-trace` → AI marks longest signal path; also highlights upstream of selected node.
- [ ] Task 5.3 — Show-me-X modes (E2E-798): "Show me power" / "Show me data" / "Show me GPIO" — highlight filter.
- [ ] Task 5.4 — Node degree heatmap (E2E-799).
- [ ] Task 5.5 — Try alternate component (E2E-801, E2E-828): side-by-side delta panel with cost/efficiency diff.
- [ ] Task 5.6 — Smart suggestion ghost nodes (E2E-829): AI proposes 2 nodes off to side ("Add decoupling cap") as ghost; click to accept + auto-wire.
- [ ] Task 5.7 — Live cost overlay (E2E-835, E2E-813): each node shows `$2.45`; total in corner; realtime recalc.
- [ ] Task 5.8 — Power-budget bar (E2E-836): top-of-canvas progress bar `12mA / 500mA budget` — fills red as exceeded.
- [ ] Task 5.9 — Architecture lints (E2E-842): rule set: "Every MCU needs decoupling cap on VCC", "Power chain ≤4 hops", etc. Live warnings in canvas.
- [ ] Task 5.10 — Audience polish (E2E-771-775): onboarding callout for drag-vs-`+`; AI-first hint on empty state; keyboard-only architecture creation (`N` add, arrows move, `E` edge); saved layout templates via Copy JSON + My Templates.
- [ ] Task 5.11 — What-if branching (E2E-802) + Arch templates DSL (E2E-803) + AI critique (E2E-805) → scoped: ship `AI critique` here; branching + DSL move to 18.
- [ ] Task 5.12 — Architecture diff vs Schematic diff (E2E-804): visually highlight nodes in arch but not schematic (or vice versa). Consumes cross-tab state.
- [ ] Task 5.13 — Tests + commit.

## Team Execution Checklist

```
□ Prereqs merged: 01, 02 (tool-analyze fix), 03, 16, 17
□ npm run check / test / eslint / prettier clean
□ Playwright architecture-* suites pass
□ advisor() ≥3×
```

## Research log

- Context7 `reactflow` handles + edges — pending
- Context7 `elkjs` or `d3-force` — pending Wave 4
- WebSearch "Lucidchart smart connector" — pending Wave 3
- advisor() calls pending

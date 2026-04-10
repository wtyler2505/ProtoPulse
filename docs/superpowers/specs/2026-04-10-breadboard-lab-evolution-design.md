# Breadboard Lab Evolution — Design Specification

> Companion to `scribe/breadboard-lab/FINAL.md` (vision layer).
> This document is the implementation-ready spec — file paths, acceptance criteria, test expectations, dependency ordering.
> Generated 2026-04-10 after a full audit of 20+ breadboard files, 383 passing tests, and 9 knowledge vault notes.

## Goal

Transform the Breadboard Lab from a grid-only component canvas into a full maker's workbench — a bench surface with smart snapping, expanded component realism, proactive AI coaching, tactile interaction, and seamless cross-tool coherence. The target audience is hobbyists, students, and indie makers who need an intuitive, physically accurate bench experience augmented by AI safety nets.

## Foundational Decision: The Bench Surface Spatial Model

**Decision:** Hybrid Bench Surface + Smart Snapping (Option C).

The breadboard view currently treats canvas = breadboard grid. Every component is forced onto a tie-point hole. This breaks for boards that don't fit (Arduino Mega 2560 at 101.6mm x 53.34mm), boards the user wants beside the breadboard (Arduino Uno with jumper wires), and bench peripherals (power supplies, motor controllers, scopes).

**The new model:** The canvas becomes a workbench surface. The breadboard is an interactive zone on that surface. Components can be placed in two modes:

- **On-board:** Dragged near the breadboard, snaps to holes, subject to grid constraints and collision detection. Electrically connected via breadboard rows.
- **On-bench:** Dragged to the bench area, free-positioned. Connected to the breadboard via explicit jumper wires. Boards marked `not_breadboard_friendly` (Mega 2560) auto-suggest bench placement.

**Smart snapping behavior:** Within a configurable proximity threshold of the breadboard bounds, placement snaps to holes. Beyond that threshold, placement is free-form on the bench surface. Visual cue: the breadboard zone glows subtly when a component is within snap range.

**Schema impact:** The existing `breadboardX`/`breadboardY` fields on `circuit_instances` continue to store on-board positions. A new `benchX`/`benchY` pair (or a unified `placementMode: 'board' | 'bench'` with `posX`/`posY`) represents bench-surface positions. Wire endpoints gain a `target` discriminator: `{ type: 'hole', coord }` vs `{ type: 'bench-pin', instanceId, pinId }`.

**This decision is load-bearing.** Everything below assumes the bench surface model. Spec items are tagged with `[bench]` when they depend on or interact with this model.

---

## Existing Infrastructure (Verified 2026-04-10)

| Subsystem | Key Files | Status |
|-----------|-----------|--------|
| Photorealistic SVGs | `breadboard-components/` (7 types: Resistor, Capacitor, LED, IC, Diode, Transistor, Wire) | Production |
| Bendable legs | `bendable-legs.ts` + `BendableLegRenderer.tsx` (bezier curves, per-type coloring) | Production |
| Grid model | `breadboard-model.ts` (830-point, a-j columns, rows 1-63, power rails) | Production |
| Hole collision | `breadboard-model.ts → checkCollision()` | Production |
| Board audit | `breadboard-board-audit.ts` (whole-board health, severity categories) | Production |
| Layout quality | `breadboard-layout-quality.ts` (4-band scoring) | Production |
| Coach plan | `breadboard-coach-plan.ts` (hookups, bridges, corridors, suggestions) | Production |
| Coach overlay | `BreadboardCoachOverlay.tsx` (visual rendering of plan) | Production |
| Part inspector | `breadboard-part-inspector.ts` (pin map, trust, confidence) | Production |
| Trust gating | `component-trust.ts` (verification levels, authoritative wiring) | Production |
| AI prompts | `breadboard-ai-prompts.ts` (chat, planner, selection prompts) | Production |
| View sync | `view-sync.ts` (716 lines, bidirectional delta sync) | Production |
| Verified boards | `shared/verified-boards/` (ESP32, Mega 2560, RioRand) | Production |
| Starter shelf | `BreadboardStarterShelf.tsx` (7 starter parts) | Production |
| Inventory dialog | `BreadboardInventoryDialog.tsx` (track/filter/update) | Production |
| FZPZ import | `server/export/fzz-handler.ts` (699 lines) | Production |
| FZPZ export | `server/component-export.ts` (535 lines) | Production |
| Fritzing export | `server/export/fritzing-exporter.ts` (73 lines) | Skeletal |
| Wire colors | `BreadboardView.tsx` (presets, right-click menu, color-by-net) | Production |
| Keyboard shortcuts | `BreadboardView.tsx` (3 tool keys: 1/2/3, Escape, Delete) | Basic |
| Drag-to-place | `BreadboardView.tsx` (handleDragOver/handleDrop with snap preview) | Production |

---

## Section 0: Bench Surface Foundation `[bench]`

### S0-01: Bench surface canvas with breadboard zone

**Files:** `BreadboardView.tsx` (major refactor), `BreadboardGrid.tsx` (becomes a child zone), new: `BenchSurface.tsx`
**Accept:** The SVG canvas is a larger surface. The breadboard grid renders at a defined position within it. Components can exist at any position on the surface. The breadboard zone has a subtle boundary indicator. Pan/zoom applies to the entire surface.
**Test:** Unit: component at bench coords renders outside grid. Chrome: drag component to bench area, verify free placement. Drag component near breadboard, verify grid snap.
**Depends on:** Nothing — this is the foundation.

### S0-02: Dual placement mode (on-board vs. on-bench)

**Files:** `BreadboardView.tsx` (handleDrop refactor), `breadboard-model.ts` (extend placement types), schema: add `placementMode` or `benchX`/`benchY` to circuit_instances
**Accept:** Drop within snap threshold → grid-snapped, `breadboardX`/`breadboardY` set. Drop outside threshold → free-placed, `benchX`/`benchY` set. Visual distinction: on-board components have hole-connected legs, bench components show as standalone with labeled connection points.
**Test:** Unit: placement mode correctly determined by distance from breadboard bounds. Integration: create instance at bench coords, verify renders outside grid.
**Depends on:** S0-01

### S0-03: Bench-to-board jumper wires

**Files:** `BreadboardView.tsx` (wire drawing), `breadboard-model.ts` (new wire endpoint type), `BreadboardWireEditor.tsx`
**Accept:** User can draw a wire from a bench-placed component's pin to a breadboard hole (or to another bench component's pin). Wire renders as a jumper cable (thicker, colored, with visible connectors at both ends). Wire endpoint schema: `{ type: 'hole', coord }` or `{ type: 'bench-pin', instanceId, pinId }`.
**Test:** Unit: wire with mixed endpoints (bench → board) serializes/deserializes correctly. Chrome: draw wire from bench-placed Mega pin to breadboard row, verify visual connection.
**Depends on:** S0-02

### S0-04: Auto-placement suggestions for non-breadboard-friendly boards

**Files:** `BreadboardView.tsx` (drop handler), `breadboard-bench.ts` (fit classification)
**Accept:** When dropping a `not_breadboard_friendly` component, automatically place it on the bench surface adjacent to the breadboard (not on the grid). Show a toast: "Arduino Mega placed on the bench — it's too wide for the breadboard. Draw jumper wires to connect." When dropping a `requires_jumpers` component (ESP32), offer a choice: "Plug into breadboard (tight fit) or place on bench?"
**Test:** Unit: Mega drop auto-routes to bench. ESP32 drop shows choice dialog. Chrome: verify both flows visually.
**Depends on:** S0-02

---

## Section 1: Visual Rendering & Physical Realism

### S1-01: Expand SVG component library (7 → 20+ families)

**Files:** `client/src/components/circuit-editor/breadboard-components/` — new files: `PotentiometerSvg.tsx`, `ButtonSvg.tsx`, `SwitchSvg.tsx`, `HeaderSvg.tsx`, `RegulatorSvg.tsx`, `CrystalSvg.tsx`, `BuzzerSvg.tsx`, `FuseSvg.tsx`, `SensorSvg.tsx`, `DisplaySvg.tsx`, `RelaySvg.tsx`, `MotorSvg.tsx`, `ConnectorSvg.tsx`. Modify: `BreadboardComponentRenderer.tsx` (extend `detectFamily` and family routing)
**Accept:** Each SVG renders value-driven artwork at 0.1" pitch. Potentiometer shows dial position. Regulator shows voltage marking. Button/switch shows on/off state. `detectFamily()` correctly routes 20+ type strings to the right renderer.
**Test:** Snapshot test per new component. Chrome visual verification of each.

### S1-02: Expand verified board profiles (3 → 10+)

**Files:** `shared/verified-boards/` — new: `arduino-uno-r3.ts`, `arduino-nano.ts`, `rpi-pico.ts`, `stm32-nucleo-64.ts`, `adafruit-feather.ts`, `sparkfun-thing-plus.ts`, `teensy-40.ts`
**Accept:** Each board has: physical dimensions (mm), full pin map with electrical roles, `breadboardFit` classification, hardware traps (strapping pins, restricted pins, boot warnings), `breadboardNotes`. All data sourced from official datasheets. Pin count matches datasheet exactly.
**Test:** Unit test per board: pin count assertion, fit classification, trap detection, dimension validation.
**Depends on:** S0-04 (bench placement uses fit classification)

### S1-03: Physical body collision detection

**Files:** `client/src/lib/circuit-editor/breadboard-model.ts` (new `checkBodyCollision()`), new: body-bounds registry per component type
**Accept:** `checkBodyCollision()` checks physical body overlap, not just hole overlap. Body dimensions derived from component type + pin count + known package dimensions. Two tall electrolytic caps in adjacent rows = collision. Two axial resistors in adjacent rows = no collision (flat profile).
**Test:** Unit: tall cap + relay adjacent = collision. Two flat resistors adjacent = pass. IC straddling channel + component in gap = collision.

### S1-04: Real-time drag collision feedback `[bench]`

**Files:** `BreadboardView.tsx` (handleDragOver), `BreadboardGrid.tsx` (visual feedback)
**Accept:** During drag over the breadboard zone, snap preview turns red (body or hole collision) or green (valid). On the bench surface, no collision checking (free placement). Visual feedback is immediate — no perceptible delay.
**Test:** Chrome: drag component over occupied area, verify red indicator. Drag to empty area, verify green.
**Depends on:** S0-01, S1-03

### S1-05: Fit-zone overlay for large boards

**Files:** `BreadboardView.tsx` (new overlay), `breadboard-model.ts` (new `getAvailableZones()`)
**Accept:** After placing an ESP32 on the breadboard, remaining usable holes are highlighted in a subtle color. Occupied/blocked holes are dimmed. Overlay is togglable via toolbar button. Updates live when components are added/removed.
**Test:** Unit: ESP32 at row 10 → compute exact available hole set. Chrome: place ESP32, verify overlay renders correctly.

---

## Section 2: The "Bench Coach" & AI Intelligence

### S2-01: Heuristic trap inference for unverified parts

**Files:** New: `client/src/lib/heuristic-trap-inference.ts`. Modify: `breadboard-board-audit.ts`, `breadboard-coach-plan.ts`
**Accept:** Unverified parts get inferred warnings based on family + title/MPN pattern matching. An unverified ESP32-family part inherits flash GPIO, strapping, and ADC2 warnings at "inferred" confidence. An unverified ATmega328 gets voltage/reset warnings. Generic passives get zero inferred traps. Confidence clearly labeled: "inferred from family" vs "verified from datasheet."
**Test:** Unit: unverified ESP32 clone → 3+ warnings. Unverified ATmega328 → voltage/reset. Generic 1kΩ resistor → zero traps.

### S2-02: Whole-board pre-flight safety scan `[bench]`

**Files:** New: `client/src/lib/breadboard-preflight.ts`. Modify: `BreadboardBoardAuditPanel.tsx` (add "Ready to Build?" button)
**Accept:** Scans ALL instances (both on-board and on-bench) + wires + nets together. Detects: ADC2+WiFi conflict, voltage rail mismatch (3.3V part on 5V rail), missing decoupling on ICs, power budget overrun, unconnected required pins, bench-to-board jumper wire validation. Results shown in a pre-flight checklist UI.
**Test:** Unit: ESP32 + WiFi + ADC2 pin = conflict. IC without decoupling = warning. Total draw > 500mA on USB = overrun.
**Depends on:** S0-02 (needs to scan both placement modes)

### S2-03: Motor controller behavioral traps

**Files:** Extend `shared/verified-boards/riorand-kjl01.ts` (add behavioral traps field). Extend `heuristic-trap-inference.ts` (motor family rules)
**Accept:** BLDC/H-bridge parts trigger: STOP/BRAKE polarity warning (HIGH = coast, LOW = brake on many controllers), PWM frequency range advisory, back-EMF protection check (flyback diode presence), shoot-through dead-zone warning for complementary PWM.
**Test:** Unit: RioRand + PWM pin = polarity advisory. H-bridge IC + no flyback diode = back-EMF warning.

### S2-04: One-click coach remediation

**Files:** Extend `BreadboardCoachOverlay.tsx` (add "Apply" buttons per suggestion). Modify `breadboard-coach-plan.ts` (add `remediation` field to suggestions/hookups)
**Accept:** Coach suggestions include a concrete remediation action (rewire, place component, add jumper). "Apply" button creates the wire/instance/connection at the suggested coordinates. Action is undo-able. Preview tooltip shows what will change before applying.
**Test:** Integration: click "Apply" on decoupling cap suggestion → instance + wires created at correct coordinates. Chrome: verify the Apply flow end-to-end.
**Depends on:** S6-05 (undo/redo must be connected first)

### S2-05: Contextual "why this matters" learning cards

**Files:** New: `client/src/components/circuit-editor/CoachLearnMoreCard.tsx`. Extend: `BreadboardCoachOverlay.tsx`, `BreadboardBoardAuditPanel.tsx`
**Accept:** Each coach warning has an expandable "Why?" card. Content extracted from knowledge vault markdown files at build time (or lazy-loaded). Cards explain the trap in beginner-friendly language with a "what could happen" scenario (e.g., "GPIO12 controls the flash voltage at boot. If a sensor pulls it HIGH, the module will crash every time you power on.").
**Test:** Snapshot tests for card rendering. Content accuracy verified against knowledge vault source files.

---

## Section 3: Cross-Tool Coherence (Netlist & Sync)

### S3-01: Wire provenance badges `[bench]`

**Files:** `BreadboardView.tsx` (wire rendering), schema: add `provenance` field to `circuit_wires` (`'manual' | 'synced' | 'coach' | 'jumper'`)
**Accept:** Each wire renders a small origin indicator on hover: "placed by you," "synced from schematic," "suggested by coach," or "bench jumper." Wire visual style differentiates provenance at a glance (solid = manual, dashed = synced, dotted = coach, thick with connectors = jumper).
**Test:** Unit: wire with each provenance value renders correct style. Chrome: hover wire, verify badge appears.
**Depends on:** S0-03 (jumper wire type must exist)

### S3-02: Delta sync hardening

**Files:** `client/src/lib/circuit-editor/view-sync.ts`, new: `client/src/lib/circuit-editor/__tests__/view-sync-stress.test.ts`
**Accept:** 20+ edge case tests: concurrent edits in both views, delete-while-wiring, bulk paste (20 components at once), rapid view toggle, partial net deletion. Each conflict produces a user-visible `SyncConflict` with clear description. Zero silent wire drops or duplications.
**Test:** Stress test suite with deterministic scenarios. Each test asserts exact wire create/delete counts and conflict messages.

### S3-03: Shared netlist model architecture spec (BL-0571 — Epic C)

**Output:** Architecture Decision Record in `docs/adr/` defining: canonical netlist data model, migration path from dual-wire storage to shared model, view adapter interfaces, rollback strategy, intermediate milestones.
**Accept:** ADR reviewed and approved. Data model prototyped as commented-out schema additions in `shared/schema.ts`. Migration path has 4-6 numbered milestones. NOT implementation — this item produces the plan for a dedicated Epic C cycle.
**Depends on:** S3-01, S3-02 (provenance and sync hardening inform the unified model design)

---

## Section 4: Stash Management & Inventory

### S4-01: Inline quick-intake in workbench sidebar

**Files:** New section in `BreadboardWorkbenchSidebar.tsx`
**Accept:** Inline "quick add" row: part name (with autocomplete from BOM/library), quantity, storage location. Submit adds to inventory without opening a modal or leaving the breadboard view. Barcode scan button triggers existing scan flow and pre-fills the part name field.
**Test:** Unit: submit creates/updates BOM item with correct quantities. Chrome: verify inline flow without modal.

### S4-02: Camera receipt/bag import for breadboard inventory

**Files:** Wire existing multimodal AI input (Wave 36) + barcode scanning (Wave 33) into breadboard inventory flow
**Accept:** "Scan parts" button in sidebar opens camera. AI extracts part numbers + quantities from receipt/bag photo. Pre-fills a confirmation form. User reviews and accepts. Items added to inventory.
**Test:** Unit: mock AI response → correct pre-filled form. Chrome: verify camera → extraction → confirmation flow.
**Depends on:** S4-01 (intake form is the target for extracted data)

### S4-03: Build-time stash reconciliation `[bench]`

**Files:** New: `client/src/components/circuit-editor/BreadboardReconciliationPanel.tsx`. Extend: `breadboard-preflight.ts`
**Accept:** Triggered by "Ready to Build?" button (same as S2-02 preflight). Shows a "Have / Need" table for every component on the board (both on-board and on-bench). Missing parts flagged with red. Surplus noted. Each missing part links to shopping action (S4-04).
**Test:** Unit: board with 3 resistors owned, 5 needed → "have 3, need 2 more" row. Chrome: verify table renders with correct data.
**Depends on:** S2-02 (preflight scan provides the trigger)

### S4-04: Shopping list generation from missing parts

**Files:** Wire existing supplier API integration (Wave 36) into reconciliation panel
**Accept:** "Shop for Missing" button generates a consolidated list with cheapest available source per part. Each row shows: part, quantity needed, best price, distributor link. Export as CSV or shareable link.
**Test:** Unit: mock supplier API → correct price/link per part. Chrome: verify shopping list UI.
**Depends on:** S4-03

---

## Section 5: Fritzing Interop & Export Quality

### S5-01: 9px grid SVG compliance in FZPZ export

**Files:** `server/component-export.ts`
**Accept:** All connector positions in exported SVGs snap to exact 9px multiples (0.1" at 90 DPI). New validation function `validateFritzingGrid()` rejects off-grid positions with descriptive error. Tolerance: 0 — sub-pixel accuracy required.
**Test:** Unit: export a 14-pin DIP IC, verify all connector coords are 9px multiples. Export a 2-pin resistor, verify. Off-grid position → validation error.

### S5-02: XML/SVG connector ID matching validation

**Files:** `server/component-export.ts` (add pre-package validation pass)
**Accept:** Before creating the FZPZ ZIP, validate that every connector ID in the FZP XML has a matching element ID in each SVG layer. Mismatch = hard error, not warning. Error message identifies the mismatched connector by name and ID.
**Test:** Unit: valid part passes. Part with connector "pin5" in XML but "pin_5" in SVG → error naming the mismatch.

### S5-03: Enrich .fzz project exporter

**Files:** `server/export/fritzing-exporter.ts` (major expansion from 73 lines to ~300+)
**Accept:** Exports: accurate breadboard and schematic view coordinates per instance, wire routing data with color, net connectivity, embedded part references (inline or as FZPZ sub-archives). A user should be able to open the exported .fzz in Fritzing 0.9.x and see their circuit reproduced with correct placement and wiring.
**Test:** Export a test circuit with 5 components + 8 wires. Verify XML structure matches Fritzing schema. Roundtrip test: export → parse → verify all instances and nets present.

### S5-04: Import validation pipeline for community FZPZ parts

**Files:** `server/export/fzz-handler.ts` (add validation pass before accepting)
**Accept:** Imported FZPZ parts validated for: 9px grid compliance, XML/SVG connector ID match, presence of breadboard + schematic views, reasonable pin count (< 200). Issues surfaced to user in a "import report" dialog before adding to library. Fixable issues (off-grid by 1px) offer auto-correction.
**Test:** Unit: valid community part passes. Off-grid part → flagged with detail. Missing breadboard view → flagged.

---

## Section 6: UI/UX Quality of Life

### S6-01: Keyboard-driven breadboard navigation `[bench]`

**Files:** `BreadboardView.tsx` (handleKeyDown expansion), new: `client/src/lib/circuit-editor/useBreadboardCursor.ts`
**Accept:** Arrow keys move a visible cursor between holes on the breadboard. On the bench surface, arrow keys move in free-form increments. Tab cycles through placed components (both on-board and on-bench). Enter starts a wire from cursor position, arrows route it, Enter finishes. Shift+arrows for 5x movement. Escape cancels current operation.
**Test:** Unit: arrow key at a1 → a2 (down), b1 (right). Tab with 3 components → cycles through all 3. Chrome: verify cursor visibility and wire drawing without mouse.
**Depends on:** S0-01 (bench surface affects cursor behavior)

### S6-02: Tactile snap animation

**Files:** `BreadboardGrid.tsx` (add CSS animation classes), `BreadboardView.tsx` (trigger on snap)
**Accept:** When a component snaps to a hole during drag, a subtle scale pulse (1.0 → 1.05 → 1.0, 120ms) + shadow shift sells the "click into place" feeling. When a wire endpoint lands on a connected row, the row's 5-hole highlight flashes once (opacity 0 → 1 → 0, 200ms). Animations are CSS-only (no JS timers), respect `prefers-reduced-motion`.
**Test:** Chrome: drag component to hole, verify animation fires. Check `prefers-reduced-motion` disables it.

### S6-03: Wire T-junction forking

**Files:** `BreadboardView.tsx` (wire interaction handler), `breadboard-model.ts` (wire split logic)
**Accept:** Clicking on an existing wire starts a new wire branching from the nearest point on that wire. The original wire is split into two segments at the junction point. The new branch inherits the parent wire's net assignment. Visual T-junction marker rendered at the branch point.
**Test:** Unit: wire from a1→a10, click at a5 → wire splits into a1→a5 + a5→a10, new branch starts at a5. Net preserved on all three segments.

### S6-04: Drag-to-move placed components `[bench]`

**Files:** `BreadboardView.tsx` (new drag mode on existing components), `BreadboardComponentRenderer.tsx`
**Accept:** Click and drag a placed component to move it. On the breadboard, movement snaps to holes with collision checking. On the bench surface, movement is free-form. Connected wires stretch/follow as the component moves (rubber-band effect). Release triggers wire re-routing.
**Test:** Unit: move component from a1 to a5, verify connected wires update endpoints. Chrome: drag component, verify wire follow and collision feedback.
**Depends on:** S0-02 (dual placement modes), S1-03 (body collision during move)

### S6-05: Breadboard undo/redo

**Files:** `BreadboardView.tsx` (connect to existing `client/src/lib/undo-redo.ts`)
**Accept:** Ctrl+Z undoes the last breadboard action (place component, draw wire, delete wire, move component). Ctrl+Shift+Z / Ctrl+Y redoes. Undo stack preserves: instance create/delete, wire create/delete, instance position changes. Stack depth: 50 actions minimum.
**Test:** Unit: place → undo → instance removed. Wire → undo → wire removed. Move → undo → original position restored.

### S6-06: Starter circuit templates

**Files:** New: `client/src/lib/circuit-editor/starter-circuits.ts`. Modify: `BreadboardView.tsx` (empty state)
**Accept:** When the breadboard is empty, show a "Build your first circuit" prompt with 4 pre-wired templates: LED + current-limiting resistor, voltage divider, button + LED with pull-down, H-bridge motor control. One click populates the board with working circuit + explanatory labels on each component. Templates work on the bench surface (motor controller template uses bench placement).
**Test:** Unit: each template produces valid instances + wires with correct coordinates. Chrome: click template, verify complete circuit renders.
**Depends on:** S0-01 (templates use bench surface for complex circuits)

### S6-07: Breadboard connectivity explainer overlay

**Files:** New: `client/src/components/circuit-editor/BreadboardConnectivityExplainer.tsx`, toolbar toggle
**Accept:** Togglable overlay rendering internal bus connections: 5-hole row groups colored and labeled, power rail paths marked with + / - symbols, center channel shown as a clear break. Aimed at first-timers. Does not interfere with component rendering (renders behind components). Includes brief text annotations: "These 5 holes are connected" pointing to a row group.
**Test:** Snapshot test for overlay structure. Chrome: toggle on/off, verify renders behind components.

---

## Implementation Ordering

Phases are ordered by dependency. Items within a phase can be parallelized.

### Phase 0: Foundation (blocks everything)
`S0-01` → `S0-02` → `S0-03` → `S0-04`

### Phase 1: Visual Expansion (independent of bench surface details)
`S1-01` (SVG library), `S1-02` (board profiles) — can start in parallel with Phase 0 since these are new files

### Phase 2: Interaction & Feel (depends on Phase 0)
`S1-03` (body collision) → `S1-04` (drag feedback)
`S1-05` (fit zones)
`S6-01` (keyboard nav), `S6-02` (snap animation), `S6-03` (T-junctions)
`S6-05` (undo/redo) → `S6-04` (drag-to-move)
`S6-06` (starter circuits), `S6-07` (connectivity explainer)

### Phase 3: Intelligence (depends on Phase 0 + Phase 1 board profiles)
`S2-01` (heuristic traps) → `S2-02` (preflight scan)
`S2-03` (motor traps)
`S2-04` (one-click remediation) — depends on S6-05
`S2-05` (learning cards)

### Phase 4: Inventory (depends on Phase 3 preflight)
`S4-01` (quick intake) → `S4-02` (camera import)
`S4-03` (reconciliation) → `S4-04` (shopping list)

### Phase 5: Sync & Interop (can run parallel to Phase 3-4)
`S3-01` (wire provenance) — depends on S0-03
`S3-02` (sync hardening)
`S3-03` (BL-0571 architecture spec) — depends on S3-01 + S3-02
`S5-01` (9px grid), `S5-02` (ID matching), `S5-03` (enrich exporter), `S5-04` (import validation)

---

## Total Scope

- **32 spec items** across 7 sections (S0-S6)
- **Phase 0 (Foundation):** 4 items — the bench surface model
- **Phase 1-2 (Visual + Interaction):** 14 items
- **Phase 3-4 (Intelligence + Inventory):** 9 items
- **Phase 5 (Sync + Interop):** 7 items (including 1 architecture-spec-only)
- **Estimated effort:** Substantial multi-wave initiative. Phase 0 is the critical path.

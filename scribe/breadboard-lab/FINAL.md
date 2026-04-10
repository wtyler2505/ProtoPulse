# Breadboard Lab Comprehensive Plan

To systematically document and plan enhancements for ProtoPulse's Breadboard 
Lab, making it the only tool a hobbyist needs from concept to physical build 
through physical realism, AI coaching, and seamless cross-tool coherence.

## Target Audience
Hobbyists, students, indie makers, and educational institutions who rely on 
visual-first feedback and need an intuitive, physically accurate bench 
experience augmented by proactive AI safety nets.

## Foundational Decision: The Bench Surface Model

The breadboard view must represent a physical workbench, not just a breadboard 
grid. A real maker's bench has a breadboard, boards sitting beside it, a power 
supply, jumper wires running between them. The digital version must match.

Components can exist in two modes: **on-board** (plugged into breadboard holes, 
snapped to the 0.1" grid, electrically connected via rows) and **on-bench** 
(free-positioned on the workspace surface, connected via explicit jumper wires). 
Smart snapping determines the mode: drag near the breadboard and it snaps to 
holes; drag away and it free-places on the bench.

This model solves three critical problems: boards that don't fit (Arduino Mega 
at 101.6mm x 53.34mm), boards the user wants beside the breadboard (Arduino 
Uno with jumper wires), and bench peripherals (power supplies, motor 
controllers, measurement tools) that have no representation today.

**Implementation spec:** `docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md` §S0

## Section 1: Visual Rendering & Physical Realism

A maker looks at their bench and sees a specific green resistor with 
brown-black-red-gold bands, not an abstract rectangle labeled "1kΩ." The 
breadboard view must match that reality — when a user places a part, they 
should recognize what they're holding. Components that *look* right build 
confidence; components that look generic create doubt.

Today 7 component families render photorealistically (resistors with real color 
bands, capacitors, LEDs, ICs, diodes, transistors, wires) and 3 dev boards 
have verified physical profiles (ESP32, Mega 2560, RioRand). Bendable legs with 
per-type metallic coloring are complete. Hole-level collision detection prevents 
double-placement.

**Action Items:**
*   Expand the component artwork library to 20+ families: Potentiometers, 
    voltage regulators, relays, buttons/switches, headers, crystals, buzzers, 
    fuses, sensors, and displays are common on any maker's bench but render as 
    generic rectangles today.
*   Expand verified board profiles to 10+ common dev boards: Arduino Uno R3, 
    Nano, Raspberry Pi Pico, STM32 Nucleo-64, Adafruit Feather, SparkFun 
    Thing Plus, and Teensy 4.0. Each needs physical dimensions, pin maps, 
    breadboard fit classification, and known hardware traps.
*   Add physical body collision detection: Current collision checks only 
    compare occupied holes. Two tall components can overlap physically even 
    when their pins don't conflict.
*   Show collision feedback during drag, not after: A beginner should see 
    "this won't fit here" while dragging, not discover it in a post-placement 
    audit.
*   Visualize remaining usable space after placing large boards: When an ESP32 
    occupies all but 1 column per side, a "fit zone" overlay should make that 
    constraint visible.

**Implementation spec:** §S1-01 through §S1-05

## Section 2: The "Bench Coach" & AI Intelligence

The bench coach's job is to prevent a beginner from spending $40 on components, 
wiring them up, and watching magic smoke escape. Today the coach already 
delivers layout quality scorecards, rail hookup suggestions, bridge overlays, 
and exact-part trust gating — the foundational safety net is in place.

But that safety net has blind spots. It only catches traps on 3 verified 
boards. A beginner placing an unverified ESP32 clone, a motor controller from 
Amazon, or a sensor breakout from AliExpress gets zero hardware warnings. The 
coach reacts to the selected part — it doesn't scan the whole board looking for 
cross-component patterns. And when it catches something, it tells you what's 
wrong but not why it matters or how to fix it.

**Action Items:**
*   Heuristic trap inference for unverified parts: Infer likely traps from 
    family and metadata when a verified profile doesn't exist. An ESP32-family 
    part should inherit flash GPIO and strapping pin warnings even without a 
    verified profile.
*   Whole-board pre-flight safety scan: A "ready to build?" check that scans 
    ALL placed instances and wires together — detecting cross-component traps 
    (ADC2 + WiFi conflict, voltage rail mismatches, missing decoupling on ICs, 
    power budget overrun).
*   Motor controller behavioral traps: Inverted STOP/BRAKE logic (HIGH = coast, 
    LOW = brake on many BLDCs), PWM frequency sensitivity, H-bridge 
    shoot-through dead zones, and back-EMF protection requirements.
*   One-click coach remediation: When the coach identifies a problem, offer a 
    concrete fix with an "Apply" button — rewire to a safe pin, place a 
    decoupling cap, add a pull-down resistor.
*   Contextual "why this matters" learning mode: Surface knowledge vault 
    explanations as expandable inline cards on coach warnings. A beginner who 
    understands *why* something is dangerous learns faster than one who just 
    sees a red icon.

**Implementation spec:** §S2-01 through §S2-05

## Section 3: Cross-Tool Coherence (Netlist & Sync)

The "one tool" promise means the schematic and breadboard are two views of the 
same circuit — not two separate editors that happen to share a database. Today, 
`view-sync.ts` (716 lines) provides bidirectional delta synchronization: when 
one view changes, it computes wires to create and wires to delete in the other. 
Conflict detection identifies where views disagree.

But delta sync is a bridge, not a foundation. The schematic and breadboard 
still maintain independent wire state. Epic C (BL-0571) targets the real goal: 
a shared netlist model where both views read from and write to the same source 
of truth.

**Action Items:**
*   Wire provenance visibility: Every wire should show its origin — "placed by 
    you," "synced from schematic," "suggested by coach," or "bench jumper." 
    This makes auto-generated wires transparent rather than mysterious.
*   Harden delta sync reliability: 20+ edge case tests for concurrent edits, 
    delete-while-wiring, bulk operations. Each conflict should resolve 
    predictably with clear user feedback — never silently drop a wire.
*   Shared netlist model (BL-0571): Architecture spec defining the canonical 
    netlist data model, migration path, and intermediate milestones. This is 
    C5 complexity — the spec produces the plan for a dedicated implementation 
    cycle, not the implementation itself.

**Implementation spec:** §S3-01 through §S3-03

## Section 4: Stash Management & Inventory

The breadboard lab's "build readiness" only means something if it knows what 
the maker actually owns. Today the BreadboardInventoryDialog lets users track 
parts with owned/missing quantities, storage locations, and minimum stock 
levels. The bench sidebar filters by owned/ready/verified status, and Gemini 
ER "build from stash" is live.

**Action Items:**
*   Quick-intake mode in breadboard context: A streamlined "I just bought 
    these" flow — type or scan a part, set quantity, done. Inline in the 
    workbench sidebar, no modal required.
*   Camera receipt/bag import: Point the camera at a parts bag label or 
    receipt. AI extracts part numbers and quantities. Leverages existing 
    multimodal AI and barcode scanning.
*   Stash reconciliation at build time: A clear "you have / you need" 
    comparison for every component on the board. Missing parts link directly 
    to shopping.
*   "Shop for missing parts" flow: Generate a consolidated shopping list with 
    distributor links and best prices.

**Implementation spec:** §S4-01 through §S4-04

## Section 5: Fritzing Interop & Export Quality

Fritzing is largely unmaintained, but its community parts library is enormous 
and irreplaceable. FZPZ import (699 lines) and basic .fzz export (73 lines) 
exist, along with FZPZ component export (535 lines). The gap is in export 
quality.

FZPZ generation requires exact 9px multiples (0.1" at 90 DPI) and matched XML 
connector IDs to prevent "ghost pins" — pins that visually exist but don't 
electrically connect. The current exporter doesn't enforce either requirement.

**Action Items:**
*   Harden FZPZ SVG generation with 9px grid compliance: Every connector 
    position must snap to the 9px grid with sub-pixel accuracy.
*   Match XML connector IDs between FZP metadata and SVG layers: Mismatches 
    create invisible broken pins. Validate before packaging.
*   Enrich the .fzz project exporter: Accurate view coordinates, wire routing, 
    net connectivity, and embedded parts. Users should open the file in 
    Fritzing and see their circuit reproduced.
*   Community part validation pipeline: Validate imported FZPZ parts against 
    grid standards before accepting into the library.

**Implementation spec:** §S5-01 through §S5-04

## Section 6: UI/UX Quality of Life

Breadboarding on a physical bench has a rhythm — pick up a component, feel it 
click into the board, route a wire with your fingers. The digital version must 
chase that same tactile satisfaction. Today the breadboard tab has 
drag-to-place with grid snapping, 3 keyboard tool shortcuts, wire color coding, 
and connected-row highlighting. A starter shelf offers 7 component types.

**Action Items:**
*   Keyboard-driven breadboard navigation: Arrow keys move a visible cursor 
    between holes. Tab cycles through placed components. Enter starts/finishes 
    wires. A power user should wire an entire circuit without the mouse.
*   Tactile snap feedback: A subtle scale pulse when a component snaps to a 
    hole. A row highlight flash when a wire endpoint lands. Small animations 
    that make placement feel physical.
*   Wire T-junction forking: Click on an existing wire to branch a new wire 
    from that point — true T-junctions, not just point-to-point wiring.
*   Drag-to-move placed components: Let the user drag a placed component to a 
    new location with live wire-follow. This is how every physical breadboard 
    works.
*   Breadboard undo/redo: Connect the existing undo system to breadboard 
    placement, wiring, and deletion actions.
*   Guided first-circuit experience: Pre-wired starter circuits (LED + 
    resistor, voltage divider, button + LED, H-bridge motor) that populate 
    the board in one click. Kills blank-canvas anxiety and teaches by example.
*   Breadboard connectivity explainer overlay: A togglable "how this board 
    works" mode showing internal bus connections for first-timers who don't 
    yet understand breadboard connectivity.

**Implementation spec:** §S6-01 through §S6-07

## Next Steps

Review the implementation spec at 
`docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md` and 
authorize implementation phases. Phase 0 (Bench Surface Foundation) is the 
critical path — everything else builds on it.

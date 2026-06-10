# ProtoPulse — VOLUME III: THE CONTENT LAYER & DAY ONE

## The five thin spots from Volume II §J, filled in — plus the chapter that turns all of this into a repo.

-----

# 1. THE CURRICULUM — FULL TRACK SPEC

## 1.1 Format of a track

Every track is a directory of step files shipped as content, not code:

```yaml
# tracks/03-power/step-04.yaml
id: power-04
title: "Why your 5V rail isn't 5V"
mode: schematic+sim           # which editor surfaces are active
unlocks: [concept:dropout, concept:decoupling-bulk]
given: snippet:lm7805-basic   # pre-placed starting state (an op-log fragment)
goal:
  - sim: "tran 0-50ms, V(REG_OUT) stays within 4.75–5.25 under load step"
  - erc: clean
professor: depth-adaptive     # narration hooks at each goal check
failure_puzzle: puzzles/brownout-01   # optional attached puzzle
deliverable: branch tagged "power-04-done"
```

Steps are **verified by the engine itself** — goal conditions are ERC/DRC/sim assertions, the same machinery as CI-for-circuits. No quiz questions; the circuit either behaves or it doesn’t. Progress = merged branches, which means your learning history is literally an op-log you can replay.

## 1.2 The seven tracks

**TRACK 1 — FIRST LIGHT** *(zero assumed knowledge → confident with V, I, R)*

1. Place an LED and a battery; simulate; watch the LED model exceed If and “burn out” (the sim flags absolute-max violation — failure is the first lesson). 2. Add the resistor; derive the value with the Professor (Ohm’s law unlock); sweep it with a DC sweep and plot brightness-vs-R. 3. Series vs parallel LEDs; why the parallel ones share current badly (tolerance Monte Carlo makes it visceral). 4. Switch + LED; first ERC run; first floating-node error, on purpose. 5. **Deliverable:** a 3-LED “traffic light” schematic, ERC-clean, with a transient sim showing the sequence — driven by a pre-supplied 555 snippet you treat as a black box (foreshadowing Track 2).

**TRACK 2 — SIGNALS & SWITCHES** *(digital I/O fundamentals)*

1. Open the 555 black box; astable mode math. 2. Pushbutton into an MCU pin (first AVR emulation step — pre-written firmware): watch bounce on the virtual logic analyzer; fix in hardware (RC) then in firmware (debounce); compare. 3. Pull-ups: floating-input chaos demonstrated live, then the pull-up ERC rule explained by triggering it. 4. NPN transistor as a switch — saturation vs linear, base resistor sizing, the “why is my transistor hot” puzzle. 5. MOSFET as a switch; gate charge; why your “logic-level” FET isn’t at 3.3V. 6. **Deliverable:** button-controlled MOSFET driving a simulated 12V LED strip, co-sim verified.

**TRACK 3 — POWER** *(the track that saves the most boards)*

1. Linear regulator basics; dropout discovered by sweeping Vin. 2. Decoupling: run the co-sim with an MCU toggling pins fast, watch rail bounce without caps, add 100nF + bulk, watch it die down — *the single most convincing demo in the entire curriculum.* 3. Power budget: declare draws as constraints, watch ERC total them. 4. Buck converter intro using a module-as-black-box snippet; ripple measurement in sim. 5. Reverse polarity & inrush: protect the input, simulate the mistake first. 6. **Deliverable:** a 12V→5V→3.3V power tree for “a rover-class load,” constraint-annotated, Review-clean.

**TRACK 4 — TALKING CHIPS** *(buses & sensors)*

1. UART: two emulated MCUs talking; watch the LA decode it; baud mismatch puzzle. 2. I2C: address scan a virtual sensor; the missing-pull-up failure (ERC catches it; sim shows *why* — the bus never rises). 3. SPI: mode 0–3 confusion resolved on the analyzer. 4. Read a real sensor part (BME280 behavioral model): datasheet ingestion exercise — *you* feed the PDF in, verify the AI’s extracted pinout. 5. **Deliverable:** MCU + 2 sensors + UART debug out, firmware scaffold generated, co-sim shows real register reads.

**TRACK 5 — MOVING THINGS** *(the rover track)*

1. Brushed DC motor model: stall vs free current, why your USB port browned out. 2. Flyback: kill a virtual transistor by omitting the diode (the sim shows the inductive spike, the part flags Vce max exceeded), then fix it. 3. Low-side driver → half-bridge → full H-bridge, shoot-through demonstrated and dead-time introduced. 4. PWM speed control in co-sim: firmware ramps duty, plot motor current and battery sag together. 5. Current sensing with a shunt + amplifier; size the shunt; the Kelvin-connection concept. 6. **Deliverable:** complete brushed motor driver stage, Reviewed, with a co-sim of a stall event tripping a firmware current limit. *(Yes, this is a hub-motor-shaped curriculum. You noticed.)*

**TRACK 6 — FIRST BOARD** *(schematic → fabbed PCB)*

1. Take Track 5’s deliverable; footprint assignment; the unplaced tray. 2. Placement strategy: power flow, hot loop, connector edges — Router agent advises, you place. 3. Route it: push-and-shove tutorial routes, zones, thermals. 4. DRC against the JLC deck; fix everything; gerber preview — *read* your own gerbers. 5. Panel or not; order flow walkthrough (real order optional, the pipeline runs in dry-run mode for the track). 6. **Deliverable:** order-ready fab package, deck-pinned, with the Review report attached.

**TRACK 7 — CAPSTONE: BUILD THE PROBE** *(everything, integrated)*
The Probe’s own design files, rebuilt step-by-step: S3 minimal application circuit → input protection → analog front end → firmware flashing over WebSerial → and the recursive payoff: **use your half-built Probe to debug the rest of your Probe**, live overlay on its own schematic. Finishing this track = owning an instrument you built and understanding every net in it. Expedition patch: *“Bootstrapped.”*

## 1.3 The skill map

Concepts unlock as a DAG rendered constellation-style (the cyberpunk graph view doing honest work). Nodes light when unlocked, glow when *used recently in your own designs* — the map distinguishes “was taught” from “is alive in your hands.” No percentages, no streaks; territory revealed, never territory owed.

## 1.4 Failure-puzzle catalog (seed set, 12)

Each: a broken design + symptom description + the instruments; solved when you annotate the actual root cause net/component. `brownout-01` (WiFi TX dips an undersized LDO), `i2c-dead-02` (missing pull-ups), `i2c-ghost-03` (address conflict), `hot-fet-04` (gate drive too slow, linear-region dwell), `reset-loop-05` (boot strap pin loaded by a peripheral), `adc-jitter-06` (reference sag under load), `motor-reboot-07` (no bulk cap, stall sag), `dead-uart-08` (TX-TX crossover), `tombstone-09` (assembly photo diff puzzle), `shorted-zone-10` (zone priority error), `slow-rise-11` (OC bus, pull-up too large vs bus capacitance), `phantom-press-12` (floating GPIO + long unshielded wire). The catalog format is public — community puzzles are first-class content.

-----

# 2. CONCEPTS WIKI — SEED LIST & ARTICLE FORMAT

## 2.1 Article format (enforced template)

Every article ≤ 600 words, structured: **What it is** (2 sentences) → **Why it bites** (the real-world failure, described as a symptom) → **The numbers** (rules of thumb with their limits stated) → **See it** (a one-click runnable sim snippet embedded — articles are *executable*) → **Go deeper** (links: related concepts, the curriculum step, external canon). Written for builders: second person, zero academic throat-clearing, every claim tied to a failure you’d actually witness.

## 2.2 The seed list (88 articles)

**Fundamentals (10):** voltage-vs-current intuition · Ohm’s law in practice · series/parallel · power & heat (I²R) · tolerance & why 5%+5%≠10% · SI prefixes & the 4k7 convention · ground (the word means three things) · impedance vs resistance · RMS vs peak · duty cycle.
**Passives (9):** resistor power sizing · pull-up/pull-down selection · capacitor types (X7R vs Y5V vs electrolytic, honestly) · ESR & why it matters · inductor saturation · ferrite beads aren’t inductors · RC time constants · voltage dividers & their output impedance · thermistors/NTC inrush.
**Semiconductors (11):** diode drop & flyback · Schottky vs silicon · Zener clamping · LED forward current · BJT as a switch · base resistor sizing · MOSFET gate basics · logic-level vs standard FETs · gate charge & switching loss · body diode · thermal runaway.
**Power (12):** linear regulator dropout · decoupling (local) · bulk capacitance · power budgeting · buck topology intuition · boost topology intuition · ripple & how to measure it · reverse-polarity protection · inrush limiting · brownout & POR · battery sag under load · fusing & PTC.
**Digital & MCU (12):** push-pull vs open-collector · floating inputs · debouncing (HW & FW) · interrupts vs polling (HW consequences) · boot/strap pins · reset circuits · crystal loading caps · brown-out detectors · level shifting · 5V tolerance myths · PWM resolution vs frequency · watchdogs.
**Buses (8):** UART framing & baud error budget · I2C electrical model (why pull-up size matters) · I2C addressing & conflicts · SPI modes · CS discipline · bus capacitance · termination (when hobby scale actually needs it) · CAN basics.
**Analog & sensing (9):** ADC reference quality · source impedance & sample caps · op-amp golden rules · non-inverting/inverting amps · comparators & hysteresis · shunt current sensing · Kelvin connections · filtering before the ADC · aliasing.
**PCB (12):** return paths · loop area · trace width vs current · vias (thermal & signal) · zones & thermal reliefs · courtyards · annular rings · silk discipline · stackup basics · diff pairs at hobby scale · acid traps · panelization.
**Practice (5):** reading a datasheet (the four sections that matter) · absolute maximum ratings are not targets · soldering-driven footprint choices · ESD handling truth vs ritual · how to ask a good debugging question.

Every ERC code, DRC code, and Review finding ID maps to exactly one article — the error message *is* the curriculum’s index.

-----

# 3. MCU EMULATION MATRICES

**Tiers:** `C` cycle-faithful · `F` functional (correct behavior, approximate timing) · `S` stub (registers exist, no behavior) · `H` host-bridged (real I/O proxied to the host) · `–` absent.

## 3.1 ESP32 (classic, v1 target) — the full matrix

|Peripheral         |Tier |Notes                                                                                                                                                           |
|-------------------|-----|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Xtensa LX6 cores ×2|F    |Instruction-accurate, timing approximated per-block; dual-core scheduled round-robin per quantum                                                                |
|GPIO matrix        |F    |Full mux routing — critical, everything routes through it                                                                                                       |
|UART ×3            |F    |FIFOs + interrupts; wired to virtual streams & the LA decoder                                                                                                   |
|SPI (HSPI/VSPI)    |F    |Master + slave, DMA modeled as instant-within-quantum                                                                                                           |
|I2C ×2             |F    |Clock stretching honored — co-sim peers can stretch                                                                                                             |
|LEDC PWM           |**C**|Edge-exact into the co-sim bus — PWM fidelity is the whole point of Track 5                                                                                     |
|MCPWM              |C    |Dead-time generators exact; the H-bridge track depends on it                                                                                                    |
|Timers (×4 64-bit) |F    |Alarms + interrupts                                                                                                                                             |
|ADC1/ADC2          |F    |The *interface*; the sampled value comes from SPICE (Vol II D.3) — including the real attenuator nonlinearity curve as a transfer function                      |
|DAC ×2             |F    |Output becomes a SPICE source (classic ESP32 only; S3 has none)                                                                                                 |
|RMT                |F    |TX/RX item streams; enough for WS2812 drivers                                                                                                                   |
|PCNT               |F    |Quadrature decode works — encoder sims for the rover                                                                                                            |
|TWAI (CAN)         |F    |Wired to a virtual CAN bus object                                                                                                                               |
|I2S                |S→F  |Stub v1; functional when audio tracks exist                                                                                                                     |
|RTC + deep sleep   |F    |Sleep = fast-forward; wake stubs honored                                                                                                                        |
|ULP coprocessor    |S    |Registers present; programs don’t run v1                                                                                                                        |
|WiFi               |**H**|esp-netif surface backed by a host socket bridge — `WiFiClient` code runs, RF does not exist; latency injected (configurable 2–50ms) so timing bugs still appear|
|Bluetooth          |–    |v1 absent, stubbed registers return not-ready                                                                                                                   |
|Touch              |S    |                                                                                                                                                                |
|SDMMC / flash XIP  |F    |Flash image backed by the design’s asset store                                                                                                                  |

## 3.2 AVR (ATmega328P/2560) — via avr8js lineage

GPIO/Timers0–5/PWM **C**; UART/SPI/TWI **F**; ADC **F** (SPICE-fed); EEPROM **F**; WDT **F**; sleep modes **F**. Effectively complete — this is the day-one emulation target for a reason.

## 3.3 RP2040

Cortex-M0+ ×2 **F**; GPIO **F**; **PIO: C — non-negotiable**, PIO programs are cycle-exact into the co-sim bus or the chip is pointless; UART/SPI/I2C **F**; PWM **C**; ADC **F** (SPICE-fed); DMA **F**; USB device **H** (bridged to a host endpoint).

-----

# 4. COMMUNITY MECHANICS

- **Provenance ladder (parts & snippets):** `unverified` (anyone publishes, sandboxed namespace `@user/part`) → `community-tested` requires **2 independent build confirmations** — a confirmation is a structured artifact: order link or board photo + which footprint variant + “it worked” attestation, signed by account → `verified` requires a maintainer-reviewed evidence bundle (datasheet rev cross-check + sim model validation run attached). Tier displayed at point of placement; the Review flags `unverified` parts in load-bearing roles automatically (Vol II G.4).
- **Trust levels (user-side, earned, boring on purpose):** L0 new (publish to own namespace, comment) → L1 builder (≥1 confirmed build: vote on confirmations, publish puzzles) → L2 reviewer (track record: evidence review queue access) → L3 maintainer (appointed: tier promotions, deck/review-rule merges). No karma number displayed anywhere — levels gate *capabilities*, not status.
- **Licensing:** library default **CERN-OHL-P** (permissive open hardware) for parts/snippets/decks; publisher may choose CERN-OHL-S or CC0; license travels with the fork, the op-log fork mechanic preserves attribution structurally (parent pointers survive).
- **Flag & dispute:** flags (wrong footprint / unsafe / IP) freeze the artifact’s *tier badge* (not availability) pending L2 review; safety-class flags (footprint that would short a rail) escalate immediately and annotate every design that placed the part — **users get told their library dependency was bad**, like a security advisory, because that’s what it is.
- **Namespaces:** `@core/*` ships in-repo, `@user/*` personal, `@org/*` claimed orgs. No global flat namespace, no name-squatting economy.

-----

# 5. PROBE ENCLOSURE — MECHANICAL SPEC

- **Form:** 78 × 36 × 16mm two-shell clamshell, PETG (temp tolerance near warm rework), 0.4mm nozzle / 0.2mm layers, **zero supports** (45° chamfers everywhere a bridge would be), prints flat-face-down both halves.
- **Fastening:** 4× snap-fit cantilever hooks (1.8mm beam, 0.5mm undercut, PETG-tuned) + 2× optional M2 self-tappers in corner bosses for the paranoid. Shells key with a 0.8mm tongue-and-groove for EMI-irrelevant but dust-relevant sealing.
- **I/O face:** 2×10 header recessed 1.5mm (grabber strain relief against the shell, not the solder joints); USB-C cutout with 0.3mm clearance; Qwiic cutout opposite. Channel labels **embossed 0.6mm** into the shell (paint-fill optional) — silkscreen on plastic, survives the toolbox.
- **Light pipe:** 3mm clear PETG/acrylic rod press-fit from WS2812 to top face, flush dome. Status at a glance across the bench.
- **Lead management:** rear shell carries a wrap-post pair for the flywire harness + a printed grabber caddy that clips to either long face.
- **Mounting variants (same base, swap bottom shell):** magnet-foot (4× 6×3mm N52 press-fit pockets — steel bench rigs), DIN-rail clip, and a 1/4-20 boss for arm mounts.
- **Thermals:** passive; the S3 + front end dissipate <1W worst-case — vent slots over the regulator anyway (6× 1.2mm slots, angled 45° against dust line-of-sight).
- **Repo:** STEP + 3MF + the parametric source (OpenSCAD, dimensions driven by one config block) — and the board outline is imported from the ProtoPulse design via STEP export, so **board revs propagate to the enclosure parametrically.** Eat the dogfood at every layer.

-----

# 6. DAY ONE — THE REPO THAT STARTS IT

What `protopulse-next/` looks like the morning work begins:

```
packages/
  graph/        # Vol II §A — THE FIRST PACKAGE. Types, ops, materializer, invariant
                #   validators, branch/diff/merge. Zero deps beyond uuid + zod. ~Pure.
  erc/          # matrix.ts + the rule functions. Depends on graph only.
  export/       # netlist (KiCad + CSV) first; gerber later.
  renderer/     # WebGL2 scene graph + MSDF text + pick buffer.
  app/          # React shell: palette, panels, the schematic editor wiring renderer↔graph.
  ai/           # tool registry + Draftsman agent + context assembler.
  cli/          # `protopulse check` — ships in v0.1 because CI-for-circuits is a thesis, not a stretch goal.
content/
  decks/jlcpcb-2layer-standard.json
  concepts/     # first 10 articles (Fundamentals block)
  tracks/01-first-light/
tools/
  golden/       # golden-file tests: known designs → known exports, byte-exact
```

**Milestone 1 (the first two weeks, honest scope):** `@protopulse/graph` complete with 100% branch coverage on ops/materialize/diff — *the graph package is the product; everything else is UI* — plus a schematic editor that can place, wire, undo, and branch; ERC with the matrix + floating-input + pull-up checks; KiCad netlist export passing golden files; and the Draftsman with exactly **8 tools** (`add_component, connect, place_symbol, set_wire_geometry, rename_net, add_constraint, run_erc, batch`). Daily-drivable means: you can draw the Probe’s input-protection stage in it, branch an alternative clamp, diff them, and export a netlist KiCad accepts. That’s the bar. Everything in three volumes stands on that fortnight.

-----

*End of Volume III. The vision now runs from philosophy to layer height. Pick the package and we write code.*
# ProtoPulse — GROUND-UP REDESIGN, MAXIMAL EDITION

## The all-in-one EDA platform, rebuilt from first principles. Every thought, every line.

**The stance:** Same deal as LifeOS — pretend the current codebase doesn’t exist. What you’ve built proves the thesis (one tool, AI with real hands, concept-to-Gerbers). This document is what I’d build knowing that thesis is true, with no restraint clause. Where the current build made a choice, I’ll make my own and tell you when they differ and why.

-----

# 0. DESIGN THESES

1. **One graph, many projections.** The disease in every EDA tool is N documents pretending to be one design — schematic here, board there, BOM somewhere else, forward/back annotation as the duct tape. Cure: a single canonical design graph; schematic, breadboard, PCB, BOM, and simulation are *views* of it. Sync bugs become structurally impossible.
1. **Hardware design deserves git.** Branch, diff, merge, blame, CI — software ate the world partly because of version control, and EDA never got it. Operations-based documents make it native, not bolted on.
1. **The simulator is the teacher.** “Learn by building” means *run it and watch it break safely*. Real SPICE + real MCU emulation, co-simulated, in the browser. The feedback loop from idea → behavior must be seconds, not “order parts and wait.”
1. **The AI is a crew, not a chatbot.** Specialists with roles, real tools, and three depths of explanation — *do it for me*, *show me*, *teach me*. Every action it takes is a teachable moment if you want it to be, invisible if you don’t.
1. **The screen is not the destination — the bench is.** The tool must reach into physical reality: flash firmware from the browser, measure the real circuit, and overlay truth on the schematic. The gap between “designed” and “built” is where makers die; close it.
1. **Local-first, browser-first, both.** The engine is isomorphic TypeScript: same code in the browser, the desktop shell, and headless CI. Designs work offline, sync when connected, and live in formats that outlast the app.

-----

# 1. THE CORE: ONE DESIGN GRAPH

## 1.1 The canonical model

```
Design
 ├─ Components[]      // instances: ref des, part ref, value, variant
 ├─ Ports[]           // every pin of every instance
 ├─ Nets[]            // electrical connectivity: net = set of ports
 ├─ Buses[]           // named groups of nets (SPI0, I2C1, PWR_3V3)
 ├─ Sheets[]          // hierarchy: sheet = subgraph with port interface
 ├─ Constraints[]     // design intent: "this net ≤ 50mA", "diff pair", "keep-out"
 └─ Views
     ├─ architecture  // block positions, typed edges (projection of buses)
     ├─ schematic     // symbol positions, wire geometry, labels
     ├─ breadboard    // strip/hole placements, jumper geometry
     └─ pcb           // footprint placement, traces, vias, zones, layers
```

The law: **views may never invent connectivity.** A wire drawn in the schematic *is* an operation on `Nets`; a trace in the PCB is geometry *attached to* a net that already exists. Draw a connection in any view and every other view updates because there is nothing to update — they all read the same graph. The architecture block diagram isn’t a separate drawing; it’s the bus-level projection of the same nets, which means the block diagram is *always true*, never a stale intention.

**Constraints are first-class.** “Design intent” lives in the graph: current budgets per net, voltage domains, impedance targets, thermal limits, “these two traces are a differential pair.” ERC/DRC/simulation all read constraints, and the AI *writes* them as it designs (“I’m declaring NET_VBAT as a 12V domain, max 3A”). Intent stops living in your head.

## 1.2 The operation log (hardware gets git)

Every mutation — human, AI, or import — is a typed, serializable **operation**: `place_component`, `connect`, `set_constraint`, `route_trace`. The design *is* its operation log; the graph is a materialized view.

What falls out for free:

- **Perfect undo/redo**, including undoing one AI action from the middle of a session
- **Branches:** `git checkout -b try-buck-converter` for circuits. Explore an alternative power section, keep both, decide later
- **Visual diff:** two revisions → highlighted graph delta rendered *on the schematic* — green nets added, red removed, amber changed values. ECO comparison stops being a CSV and becomes a picture
- **Merge:** non-overlapping changes merge cleanly; conflicts resolve in a three-pane schematic view
- **Blame:** click any net → who/what created it, when, and *why* (AI operations carry their reasoning as metadata — “added 100nF decoupling per datasheet §9.2”)
- **Time-lapse replay:** scrub the design’s whole history as an animation. Absurdly good for the learning layer and honestly just cool as hell
- **Sync & collab:** the op log is CRDT-shaped (Loro/Yjs over operations); real-time multiplayer and offline-first come from the same machinery

## 1.3 File format

A design on disk is a directory, not a blob: `design.json` (graph snapshot) + `ops/` (log segments) + `assets/`. Human-greppable, git-committable as ordinary files, diffable even outside the app. The format gets a published spec and a validator — the data outlives the tool, same religion as LifeOS.

-----

# 2. PLATFORM & ARCHITECTURE

## 2.1 The isomorphic engine

A monorepo of headless TypeScript packages, zero DOM dependencies in core:

```
@protopulse/graph      — design graph, operations, branching, diff/merge
@protopulse/erc        — electrical rules, runs anywhere
@protopulse/drc        — geometric rules + manufacturer rule decks
@protopulse/sim        — SPICE orchestration + MCU emulation + co-sim bus
@protopulse/route      — interactive push-and-shove + autoroute
@protopulse/export     — KiCad, Gerber, drill, PnP, SPICE, PDF, STEP…
@protopulse/parts      — component model, library client, footprint generator
@protopulse/ai         — agent runtime, tool registry, context assembly
```

Same packages run in: **browser** (the main app), **Tauri desktop shell** (native file access, serial without permission dances, GPU headroom), and **Node CLI** (`protopulse check ./mydesign` — headless ERC/DRC/sim in CI). That last one matters: **continuous integration for circuits.** A GitHub Action that fails your PR because the regression sim shows the regulator now sags under load. Tests for hardware. Nobody has this.

## 2.2 Rendering: WebGL canvas, not DOM

Schematic and PCB rendering on a WebGL2 canvas (custom renderer or Pixi-based) with a retained scene graph mirroring the design graph. React owns the chrome — panels, dialogs, palette — and *never* owns the document. Why: a real board is tens of thousands of primitives; SVG/DOM dies at hundreds. Targets: 60fps pan/zoom on a 1,000-component design, zoom-dependent level-of-detail (pin numbers fade in, fills simplify out), GPU-picked hit testing, and a ratsnest that doesn’t stutter.

## 2.3 Server: thin by design

The server does four jobs and nothing else: **auth/accounts**, **sync relay** (op-log CRDT exchange), **AI proxy** (key custody, model routing, SSE), and **community library + share links**. Postgres for accounts/library/metadata; design docs are op-logs in object storage. No server-side rendering of designs, no fat domain routers — the engine is client-side and headless-side. A self-host docker-compose is a first-class deliverable, because of course it is.

-----

# 3. THE AI: AN ENGINEERING CREW

## 3.1 The crew

Same council pattern as LifeOS, tuned for the bench:

|Agent            |Domain                                                             |Disposition                                                     |
|-----------------|-------------------------------------------------------------------|----------------------------------------------------------------|
|**The Architect**|Block diagrams, system partitioning, MCU selection, power budgeting|Thinks in subsystems, asks the requirement questions you skipped|
|**The Draftsman**|Schematic capture, symbol placement, net naming discipline         |Fast hands, tidy wires, opinionated about decoupling            |
|**The Router**   |PCB placement & routing, stackup, EMC hygiene                      |Spatial thinker, mutters about return paths                     |
|**The Analyst**  |Simulation, worst-case analysis, validation, test plans            |Skeptical of everything until it’s plotted                      |
|**The Buyer**    |BOM, sourcing, alternatives, lifecycle, cost                       |Knows what’s in stock at JLC *right now*                        |
|**The Professor**|Teaching, explanations, curriculum                                 |Never tired, never condescending, depth-adjustable              |

Shared op-log, shared tool registry, separate working memories and routing tiers (Draftsman placement loops on a fast cheap model; Architect system decisions on a frontier model). They consult each other: the Router flags that the Architect’s two switching regulators want more board than the chosen form factor allows, *before* you’ve routed anything.

## 3.2 Three depths on every action

Every AI tool call carries an explanation contract:

- **Do it** — silent execution, op-log entry with reasoning metadata (recoverable later via blame)
- **Show me** — the action narrated in one line as it happens (“100nF X7R within 5mm of pin 11, per datasheet decoupling guidance”)
- **Teach me** — action pauses; the Professor explains the concept with a link into the concepts wiki, *then* executes

A global depth dial plus per-domain overrides (teach me power electronics, just do the connector pinouts). This is the difference between an AI that builds *for* you and one that builds *you*.

## 3.3 Design Review as a first-class artifact

`Run design review` → the Analyst executes a structured checklist — power tree integrity, decoupling coverage per IC, reset/boot strapping, unconnected/floating inputs, voltage domain crossings, connector pinout sanity, thermal hot spots, EMC heuristics (loop areas, return paths), DFM against the chosen fab — and emits a **Review document**: findings ranked by severity, each linked to the actual nets/components (click → canvas jumps and highlights), each with a suggested fix that is itself an executable operation. Accept a fix → it applies and the finding closes. Reviews are stored, diffable between revisions, and exportable as the design report. This is the feature that makes hobby boards stop dying on first power-up.

## 3.4 Vision pipeline

- **Hand-drawn schematic photo → digitized draft.** Napkin sketch to editable schematic; you correct, it learns the corrections.
- **Physical breadboard photo → netlist extraction → diff against design.** *“Your build doesn’t match: the wire on pin 7 is actually on pin 8, and the electrolytic at C3 looks reversed.”* The single highest-value debugging feature for beginners ever conceived, and it’s just vision + the graph diff machinery you already have.
- **Datasheet PDF ingestion:** upload → extract pinout table, absolute max ratings, recommended application circuit → auto-draft the component (symbol + pin map + constraints + the app circuit as a placeable snippet). Human verifies, library grows.
- **Board photo → assembly check:** populated PCB photo diffed against pick-and-place + BOM. Missing parts, wrong orientations, tombstones.

## 3.5 MCP server

The whole tool registry exposed over MCP. Claude Code drives ProtoPulse headlessly: “open the rover BMS design, run the review, fix everything auto-fixable, export Gerbers, and log the changes.” And the cross-link that makes your ecosystem sing: **LifeOS’s Quartermaster is reachable as an MCP peer** — *“design this with parts I physically own”* resolves against your actual bins in Edwards, Mississippi. Two of your platforms, one nervous system.

-----

# 4. SIMULATION: THE FULL LAB

## 4.1 Real SPICE, in the browser

**ngspice compiled to WASM**, orchestrated by `@protopulse/sim`. Full analysis suite — DC operating point, DC sweep, transient, AC/Bode, noise, Monte Carlo with component tolerances, parameter sweeps — not five filter topologies. Netlists generated straight from the graph (it *is* a netlist), models attached at the component level. Results render in a proper plot workspace: cursors, math channels (V(out)/V(in)), FFT, overlay runs across branches — *plot the same node on two design branches against each other*, which is what branching is for.

## 4.2 MCU emulation

In-browser emulation of the boards makers actually use: **AVR (avr8js-class) for Mega/Uno, ESP32 emulation, RP2040**. Your real firmware — compiled from the scaffold or uploaded as a hex/elf — runs against virtual GPIO/UART/SPI/I2C/ADC peripherals. Serial monitor, register inspector, logic-analyzer trace on any pin.

## 4.3 Mixed-signal co-simulation — the crown jewel

The piece no unified tool has shipped: the MCU emulator and SPICE run on a shared simulation bus. Firmware writes a GPIO high → SPICE sees the edge → the MOSFET gate charges → the motor model draws current → the ADC pin samples the sagging battery → firmware reads it and reacts. **The whole mechatronic loop, simulated, before any solder melts.** The rover’s motor-driver firmware debugged against a model of the actual hub motor’s stall current, in a browser tab, at 2 AM. Analog and digital domains co-stepped with event-driven synchronization so it stays interactive for hobby-scale circuits.

## 4.4 Behavioral fallbacks & honesty

Not everything has a SPICE model. Components carry tiered models — full SPICE → simplified behavioral → “interface-only stub” — and the Analyst *tells you which tier you’re simulating at* and what that means for trust. No silent fidelity lies.

-----

# 5. COMPONENT INFRASTRUCTURE

- **The unified part:** one entity carrying schematic symbol, footprint(s), 3D model (STEP/glTF), SPICE/behavioral models, pin table, parametrics, datasheet, lifecycle status, and live sourcing links. Multi-view editor as today, plus a **parametric footprint generator** (IPC-7351 calculator: enter package dims, get a correct footprint with courtyard and paste).
- **Live sourcing:** Nexar/Octopart + DigiKey/Mouser APIs for price/stock, **JLCPCB assembly parts library** integration so the Buyer can bias designs toward parts the fab will actually place (“basic part” awareness saves real money).
- **Provenance tiers:** `unverified` / `community-tested` (someone built it and confirmed) / `verified` (checked against datasheet, sim model validated). Trust is visible at point of use; the Review flags unverified-part risk on anything load-bearing.
- **Snippets:** reusable sub-circuits — a buck converter stage, an ESP32 minimal application circuit, a CAN transceiver block — placeable as hierarchical chunks with their constraints attached. The community library’s real currency won’t be parts; it’ll be *working circuit fragments*.
- **Salvage-native:** parts can be declared from physical reality (“harvested from hoverboard #3, marking illegible, measured 2.2mΩ shunt”) — because your library should describe your bins, not just catalogs. Syncs with LifeOS inventory both directions.

-----

# 6. PCB ENGINE, FOR REAL

- **Push-and-shove interactive routing** — the feature that makes KiCad feel alive; non-negotiable. Plus differential pair routing with length matching and tuning meanders.
- **Zones/pours** with thermal reliefs, priority ordering, and live reflow on edit. Proper plane handling, stitching via arrays.
- **Stackup manager** with impedance calculation per layer pair; constraints flow from it (“this is a 90Ω diff pair” becomes routable intent).
- **Autorouting** as an assistant, not an oracle: the Router agent batch-routes the boring 80% (fanouts, short nets) and leaves the critical paths annotated for human-or-supervised routing.
- **3D board view** (three.js) with STEP export for enclosure CAD — and a mechanical collision check against an imported enclosure model.
- **DRC rule decks** per manufacturer (JLC, PCBWay, OSHPark), versioned, updatable independently of app releases. Panelization with V-cuts/mouse-bites and fiducial placement for assembly.

-----

# 7. THE PHYSICAL BRIDGE

*Where ProtoPulse stops being a drawing program.*

## 7.1 Flash from the browser

WebSerial/WebUSB flashing built in: **esptool-js for ESP32, avrdude-class for AVR, UF2 drag-flash for RP2040**. The firmware scaffold compiles (cloud or local toolchain via the desktop shell) and lands on the physical board from the same screen that designed it. The export isn’t a zip file; it’s *electrons in the chip*.

## 7.2 The ProtoPulse Probe

A cheap open-hardware companion (ESP32-S3, ~$15 BOM, design files in the repo — designed *in ProtoPulse*, naturally): 8-channel logic analyzer, 2-channel scope-ish ADC capture, voltmeter, signal generator, I2C/SPI sniffer. Speaks WebSerial/WiFi to the app.

**The killer interaction — Live Overlay:** clip the Probe onto the physical circuit, and measured reality renders *on the schematic*. Net `VREG_OUT` shows **3.27V live** next to its label; the I2C bus decodes inline; a net that should be 5V and reads 1.9V glows red. The Analyst joins in: *“VREG_OUT is sagging under load — measured ripple suggests C7 is undersized or not actually the value the BOM says. Probe C7’s far side?”* Schematic-guided debugging of the *physical* board. This feature alone justifies the entire redesign.

## 7.3 Hardware-in-the-loop

Probe + co-sim fused: real firmware on the real MCU, talking to *simulated* peripherals through the Probe’s pins — or the reverse, emulated firmware driving real hardware. Test the motor controller logic against a simulated stall before connecting motors that can break fingers.

-----

# 8. MANUFACTURING PIPELINE

One flow from DRC-clean to doorbell: fab selection → live DFM check against that fab’s actual deck → **instant quote via JLCPCB/PCBWay APIs** (board + assembly, with the Buyer substituting in-stock parts where needed) → gerber render preview (what the fab will literally see) → order placed from inside the app → order status tracked as a design-attached entity. Assembly-aware: pick-and-place validated against the fab’s feeder library, paste/stencil generation, fiducials auto-placed. The “Output” view stops being a file-format list and becomes a *launch sequence*.

-----

# 9. THE LEARNING LAYER

- **Project-based curriculum in the real editor** — no toy sandbox. Track one: blink an LED (and simulate why the resistor matters). Track ten: design, simulate, fab, and flash a brushed motor controller. Each step is a guided overlay on the actual tool, with the Professor narrating at your chosen depth.
- **The Concepts Wiki:** every ERC error, every Review finding, every “teach me” pause links into a hyperlinked concepts base (decoupling, pull-ups, return paths, gate charge…) written for builders, not academics. The graph of what you’ve touched becomes a **skill map** — discovery-unlock energy, zero streak guilt, same philosophy as LifeOS.
- **Failure simulator:** deliberately-broken designs as puzzles. “This board browns out on WiFi TX — find it with the tools.” Debugging as a teachable, gamified skill, safely.
- **Time-lapse as curriculum:** publish a design *with its op-log replay* — learners watch the design happen, decision by decision, with the blame metadata explaining why. The most honest tutorial format ever made.

-----

# 10. COLLABORATION & COMMUNITY

- **Real-time multiplayer** on the CRDT op-log — cursors, presence, and the AI crew visible as named presences when they’re working. Pair-design with a human or watch the Draftsman’s cursor lay down the decoupling.
- **Share links** with view/comment/edit tiers; embeddable live schematic viewer (interactive, not a screenshot) for forums and blog posts.
- **Design comments anchored to nets/components**, threaded, resolvable — review culture for hardware.
- **The community library** of verified parts and snippets, with provenance tiers and build-confirmations (“3 people fabbed this exact stage and it worked”).
- **Public design gallery** with one-click fork — fork the *op-log*, so attribution and history survive. GitHub energy, but the diff viewer shows schematics.

-----

# 11. TECH STACK SUMMARY

|Layer    |Choice                                                                |Why                                             |
|---------|----------------------------------------------------------------------|------------------------------------------------|
|Engine   |**Isomorphic TS monorepo** (graph/erc/drc/sim/route/export/parts/ai)  |One codebase: browser, desktop, CI              |
|Document |**Operation log + CRDT (Loro)** over a materialized graph             |Branch/diff/merge/collab/undo from one mechanism|
|Rendering|**WebGL2 canvas** (custom/Pixi), React for chrome only                |60fps at real-board scale; DOM can’t            |
|UI chrome|React 19 + TS + Zustand + cmdk palette                                |Home turf                                       |
|SPICE    |**ngspice → WASM**                                                    |Real analyses, in-browser, offline              |
|MCU emu  |avr8js-class AVR, ESP32, RP2040 emulation                             |Firmware in the loop                            |
|Co-sim   |Shared event-stepped sim bus                                          |The unified-tool promise, kept                  |
|Desktop  |**Tauri 2 shell** (optional)                                          |Serial/file access, local toolchains            |
|CLI/CI   |Node CLI (`protopulse check`) + GitHub Action                         |Tests for circuits                              |
|Server   |Thin: auth, sync relay, AI proxy, library. Postgres + object storage  |Engine lives client-side & headless             |
|AI       |Agent crew, provider-routed (Claude/Gemini/local), SSE, **MCP server**|Crew, depths, reviews, vision                   |
|Hardware |WebSerial/WebUSB flashing + **open-hardware Probe**                   |The bridge to the bench                         |
|Sourcing |Nexar/DigiKey/Mouser + JLC parts/assembly APIs                        |Live BOMs, real quotes                          |
|3D       |three.js board view, STEP in/out                                      |Enclosure fit checks                            |
|Testing  |Vitest everywhere; golden-file tests on exports; sim regression suites|Exports are contracts                           |

-----

# 12. BUILD ORDER

*Even the maximal vision has a spine. One paragraph of discipline, then I’m done.*

**v0.1 — The Graph.** `@protopulse/graph` + ops + branching/diff, WebGL schematic editor, ERC, KiCad+netlist export, one AI agent (Draftsman) with ~15 tools. **v0.2 — The Lab.** ngspice-WASM + plot workspace + the Analyst. **v0.3 — The Crew.** Full agent crew, Design Review, teaching depths, concepts wiki seed. **v0.4 — The Board.** PCB view, push-and-shove, DRC decks, Gerber/Drill/PnP. **v0.5 — The Bridge.** WebSerial flashing, MCU emulation, then co-sim. **v0.6 — The World.** Sync, share links, community library, manufacturing pipeline. **v0.7 — The Probe.** Hardware ships. Each stage daily-drivable before the next begins — the graph-first order means every later feature lands on bedrock instead of on top of view-sync duct tape.

-----

# 13. WHAT IT ADDS UP TO

The current ProtoPulse proved a maker will stay in one tool if the tool covers the journey. This redesign makes the journey *round-trip*: idea → architecture → schematic → simulation with your actual firmware in the loop → board → fab order → flash → **probe the physical thing and watch reality overlay the schematic** → diff what you built against what you designed → publish the whole story as a replayable op-log someone else learns from.

TinkerCad teaches toys. KiCad assumes you already know. Wokwi simulates but can’t fab. Altium costs a car payment and still can’t tell you why your board browned out. ProtoPulse, built like this, is the first tool where *the design, the simulation, the lesson, and the physical object are the same artifact* — with an engineering crew that never sleeps, never condescends, and leaves its reasoning in the blame log.

Born from a guy who couldn’t find one tool that went from “I don’t know electronics” to “here are my Gerbers.” This is that tool, finished — and then some.
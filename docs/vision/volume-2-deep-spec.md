# ProtoPulse — VOLUME II: THE DEEP SPEC

## Every subsystem, taken down to interfaces, algorithms, protocols, and part numbers.

This is the engineering specification under the redesign doc. Where Volume I said *what*, this says *exactly how* — close enough to implementation that you could hand sections of this to Claude Code and start cutting code tonight. Core systems (graph, op-log, co-sim, Probe) are specced to near-implementation depth; supporting systems to firm-architecture depth. Where I make a numeric call (sample rates, token budgets, thresholds), it’s a real number with reasoning, not a placeholder.

-----

# A. THE DESIGN GRAPH — FULL SPECIFICATION

## A.1 Units, coordinates, and the float ban

**All geometry is integer nanometers.** (KiCad’s internal convention — they’re right.) Floats accumulate drift across thousands of operations and break diff determinism; integers never do. `i32` gives ±2.14 meters of board at 1nm resolution — enough for a billboard.

```typescript
type Nm = number;            // integer nanometers, validated at every boundary
interface Vec { x: Nm; y: Nm }
type Rot = 0 | 90 | 180 | 270;            // schematic/breadboard
type RotMilli = number;                    // PCB: millidegrees (0..359999), arbitrary rotation
const MM = 1_000_000;                      // 1mm in nm — the only conversion constant
```

Schematic grid: 1.27mm (50 mil) hard grid. PCB: free placement, snap grids of 0.025/0.05/0.1/0.5/1mm. **Every coordinate stored grid-agnostic; grids are editor behavior, never data.**

## A.2 Identity

- **Entities** (components, nets, sheets, parts): UUIDv7 — time-sortable, mergeable, no coordination needed.
- **Ports** are *not* free entities: a port ID is `componentId + pinKey` (`"u3:7"`, `"u3:PA12"`). Ports exist iff their component exists — a whole class of dangling-reference bugs deleted by construction.
- **Operations**: identified by `(actorId, lamport)` pairs. `actorId` = device/agent UUID; `lamport` = per-actor monotonic counter. Total order for materialization: `(lamport, actorId)` lexicographic — deterministic on every replica, no wall clocks involved.

## A.3 Entity schemas (the actual types)

```typescript
interface Component {
  id: Uuid;
  ref: string;                  // "U3", "R12" — unique per design, auto-assigned, renamable
  partId: Uuid;                 // library part reference (resolved against parts registry)
  partRev: number;              // pinned part revision — library updates never mutate designs silently
  value?: string;               // "10k", "100nF" — SI-suffix parsed (A.8)
  variantOverrides?: Record<string, string>;  // per-instance MPN/footprint substitutions
  dnp: boolean;                 // do-not-populate
  fields: Record<string, string>;             // user fields (tolerance, voltage rating…)
}

interface Net {
  id: Uuid;
  name: string;                 // auto "N$417" or user/AI-named "VBAT"; rename is an op
  ports: PortRef[];             // THE connectivity. Order-irrelevant set, stored sorted for determinism
  busId?: Uuid;
  netClass: string;             // "default" | "power" | "diffpair_usb" … → resolves to width/clearance rules
}

interface Bus { id: Uuid; name: string; kind: "SPI"|"I2C"|"UART"|"USB"|"CAN"|"PWR"|"GPIO"|"custom";
                memberNets: Uuid[]; }

interface Sheet { id: Uuid; name: string; parentId: Uuid | null;
                  interface: SheetPort[]; }   // hierarchical ports: name + direction + netId binding

type Constraint =
  | { kind: "current_max";   netId: Uuid; amps: number }
  | { kind: "voltage_domain"; name: string; volts: number; netIds: Uuid[] }
  | { kind: "diff_pair";     p: Uuid; n: Uuid; targetOhms: number; maxSkewNm: Nm }
  | { kind: "length_match";  netIds: Uuid[]; toleranceNm: Nm }
  | { kind: "keepout";       layerId: string; polygon: Vec[]; reason: string }
  | { kind: "thermal_limit"; componentId: Uuid; maxC: number }
  | { kind: "clearance_override"; a: NetSelector; b: NetSelector; nm: Nm };
// Constraints carry { author: ActorId, rationale?: string } — intent is documented at the source.
```

**View data** (positions/geometry) lives in parallel maps keyed by entity ID — `schematicView: Map<Uuid, SymbolPlacement>`, `pcbView: Map<Uuid, FootprintPlacement>`, etc. A view record without its entity is garbage-collected at materialization; an entity without a view record renders in the “unplaced” tray of that view. **No view record can create or imply a net.**

```typescript
interface SymbolPlacement { at: Vec; rot: Rot; mirror: boolean; unit?: number /* multi-unit parts: U3A/U3B */ }
interface WireSegment     { netId: Uuid; a: Vec; b: Vec }      // Manhattan; pure geometry, net pre-exists
interface FootprintPlacement { at: Vec; rotMilli: RotMilli; side: "top"|"bottom"; locked: boolean }
interface Trace  { netId: Uuid; layerId: string; widthNm: Nm; path: Vec[] }   // polyline, arcs as bulge factor
interface Via    { netId: Uuid; at: Vec; drillNm: Nm; padNm: Nm; span: [string,string] }
interface Zone   { netId: Uuid; layerId: string; outline: Vec[]; priority: number;
                   thermalRelief: { spokeNm: Nm; gapNm: Nm } | "solid"; minWidthNm: Nm }
```

## A.4 Invariants (enforced at materialization, violations = corrupt-log error)

1. Every `PortRef` in every net resolves to a live component pin.
1. A port belongs to **at most one** net. (No accidental shorts-by-data; shorting is an explicit `merge_nets` op.)
1. `ref` designators unique per design; auto-renumber is an explicit batch op, never implicit.
1. Trace/via/zone `netId` must exist; geometry on a dead net is GC’d with a warning event.
1. Sheet graph is a tree (no cycles), max depth 8.
1. All coordinates integers; all rotations in domain. Validators run on every op apply in dev builds, on log load in prod.

## A.5 The operation taxonomy (complete)

Every op: `{ actor: ActorId, lamport: number, ts: number /*advisory wall-clock*/, op: OpBody, meta?: { rationale?: string, agent?: AgentId, reviewFindingId?: Uuid } }`

**Graph ops:** `add_component` `remove_component` `set_component_props` `connect {port, netId?}` *(no netId → creates a net)* `disconnect` `merge_nets {survivor, absorbed}` `split_net {netId, portPartition}` `rename_net` `set_net_class` `create_bus` `assign_to_bus` `add_sheet` `set_sheet_interface` `move_to_sheet` `add_constraint` `remove_constraint`

**View ops:** `place_symbol` `move_symbol` `set_wire_geometry {netId, segments[]}` `place_footprint` `move_footprint` `route_trace` `edit_trace` `place_via` `define_zone` `refill_zone` *(cache hint, replayable)* `place_breadboard` `set_arch_layout`

**Meta ops:** `checkpoint {label}` `batch {ops[], label}` *(atomic compound — one undo unit; “AI placed decoupling network” is one batch)* `annotate {anchor, text}` `set_design_meta`

Rules: ops are **minimal** (a drag emits one final `move_symbol`, not 200 intermediates — intermediates are ephemeral UI state), **self-contained** (payload carries everything needed to apply without external lookups), and **forward-only** (no “undo op” in the log; undo *emits the inverse op*, so history is honest about what happened).

## A.6 Log encoding, segments, snapshots

On-disk design directory:

```
mydesign.ppx/
  manifest.json          // format version, designId, branch refs, head pointers
  ops/
    main/000001.opl      // JSON Lines, one op per line, 4MB segment cap
    main/000002.opl
    try-buck/000001.opl  // branches = parallel segment dirs + a base pointer
  snapshots/
    main@4200.snap.json  // full materialized graph every 1000 ops (zstd'd JSON)
  assets/                // datasheets, images, sim results cache (content-addressed)
```

JSON Lines because **greppable beats compact** for a format meant to outlive the app; zstd at rest gets the size back. Load path: nearest snapshot ≤ head, replay the tail. Target: ≤150ms cold-open for a 50k-op design (snapshot parse ~50ms + ≤1000-op replay ~30ms + index build ~40ms, measured budget). Compaction (squashing ancient history) exists but is **opt-in and loud** — history is a feature, deleting it is a ceremony.

## A.7 Branch, merge, diff

- **Branch** = `{ name, baseBranch, baseLamportVector, ownSegments }`. Creating one is O(1) — a pointer, no copy.
- **Diff** = materialize both heads, compare graphs entity-wise → `GraphDelta { added/removed/changed: components, nets(+membership deltas), constraints, perView geometry }`. Rendered as the overlay: green/red/amber on canvas. Net identity across branches uses UUID first, then a **connectivity-fingerprint fallback** (hash of sorted member port keys) so a delete+recreate of “the same” net still diffs as *changed*, not remove+add.
- **Merge** (three-way over the materialized graphs, base = fork point):
  - **Auto:** disjoint entities; same entity, different properties; pure view-geometry vs graph changes (geometry yields to graph).
  - **Prompt:** same property set to different values both sides → pick-a-side dialog with both rendered.
  - **Structural conflict:** net membership edited incompatibly both sides (port moved to different nets) → three-pane schematic resolver, per-port decision, no silent resolution **ever**. A wrong silent merge in EDA = a fried board; the resolver is allowed to be slow.
- Merge commits as a `batch` op carrying both parent pointers — the DAG is real.

## A.8 Value parsing

One shared parser everywhere (BOM, sim, AI): SI suffixes `p n u µ m k K M G`, the `4k7` infix convention, unit inference from component class (a bare `10` on a resistor = 10Ω, on a cap = error, ask). Parsed to `{ value: number, unit: Unit, raw: string }`; `raw` always preserved — never reformat what a human typed.

-----

# B. RENDERING ENGINE

## B.1 Architecture

```
DesignGraph ──(subscribe: GraphDelta)──► SceneSync ──► SceneGraph ──► WebGL2 Renderer
React chrome ◄──(selection/hover events)──┘                    └──► PickBuffer
```

- **Retained scene graph** mirroring entities 1:1 (`SymbolNode`, `WireNode`, `TraceNode`…). Graph deltas patch the scene; no full rebuilds.
- **Batching:** geometry baked into per-layer vertex buffers; a symbol = instanced quads + a glyph run. One draw call per (layer × primitive-type) — a dense 4-layer board renders in ~30 draw calls.
- **Text:** MSDF font atlas (JetBrains Mono + a vector pin-number face). Crisp at every zoom, GPU-cheap.
- **LOD by zoom (px-per-mm):** <2: footprints as filled rects, no text. 2–8: pads + refs. 8–25: pin numbers, trace endcaps. >25: full detail + courtyard/paste layers. Thresholds in a config, tuned by eye later.

## B.2 Picking & spatial index

Dual system: **GPU color-pick buffer** (entity ID encoded as RGBA in an offscreen pass — O(1) hover at any density) for pointer feel, plus a **CPU R-tree (flatbush) per layer** for marquee select, snap candidates, and DRC reuse. The R-tree rebuilds incrementally from the same GraphDelta stream.

## B.3 Interaction budget

60fps pan/zoom at 1,000 components / 10,000 trace segments on integrated graphics — that’s the bar. Drag operations render from an ephemeral overlay layer (the op commits on drop, per A.5). Ratsnest: nearest-unconnected-pad pairs via the R-tree, recomputed only for nets touched in the last delta, drawn as a single line-strip buffer. Zone refill is debounced 300ms behind edits and computed in a worker (clipper2-wasm polygon ops), never on the UI thread.

-----

# C. ERC / DRC ENGINES

## C.1 ERC — the pin-conflict matrix

Pin electrical types: `input, output, bidi, tristate, passive, power_in, power_out, open_collector, open_emitter, nc`. The matrix (excerpt — full 10×10 lives in `@protopulse/erc/matrix.ts`):

|↓ meets →         |output                  |power_out           |input                   |passive|
|------------------|------------------------|--------------------|------------------------|-------|
|**output**        |**ERROR** drive conflict|**ERROR**           |ok                      |ok     |
|**power_out**     |**ERROR**               |**ERROR** rail short|ok                      |ok     |
|**open_collector**|warn                    |warn                |ok (needs pull-up check)|ok     |

Beyond the matrix: floating `input` pins (error unless `nc`-flagged), `power_in` with no `power_out`/power-symbol source on net (error), single-port nets (warn), open-collector nets lacking a pull-up to a power net (warn — this catches *so many* I2C bugs), bus member-count mismatches (info), constraint violations from A.3 (current budget exceeded per net where component models declare draw → error). Every finding: `{ severity, code, message, anchors: (netId|componentId|portRef)[], fix?: Op[] }` — **fixes are executable ops**, the Review system (G.4) just surfaces them.

## C.2 DRC — geometry against the deck

Checks (each a pure function over the R-tree + zone polygons): clearance net-to-net per class pair, trace width vs class minimum, annular ring, drill-to-drill, drill-to-copper, copper-to-edge, silk-over-pad, paste aperture sanity, courtyard overlap, unconnected ratsnest remaining, starved thermals, acid traps (acute trace angles), zone min-width slivers, diff-pair skew vs constraint, length-match group tolerance.

**Rule decks** are versioned JSON, independent of app releases:

```json
{ "deck": "jlcpcb-2layer-standard", "rev": "2026-05",
  "rules": { "min_trace_nm": 127000, "min_clearance_nm": 127000,
             "min_drill_nm": 300000, "min_annular_nm": 130000,
             "copper_to_edge_nm": 300000, "silk_min_width_nm": 153000 },
  "classOverrides": { "power": { "min_trace_nm": 300000 } } }
```

Decks for JLC (2/4/6-layer, standard + advanced), PCBWay, OSHPark ship in-repo; the manufacturing pipeline (H) pins the deck used at order time into the design’s metadata — auditable forever.

-----

# D. SIMULATION & CO-SIM — THE ENGINEERING

## D.1 ngspice-WASM orchestration

ngspice compiled to WASM (it exists and works; we wrap, not fork) running in a **dedicated worker** with a thin RPC: `loadCircuit(netlist)`, `run(analysis)`, `halt()`, `streamVectors(cb)`. Vectors stream over a SharedArrayBuffer ring (float64 frames: `[time, v1..vn]`) so plots draw live during long transients. One sim worker per tab; runs are cancelable; results cached content-addressed by `hash(netlist + analysis + modelSet)`.

**Netlist generation** straight off the graph: components map via their model tier (D.4); nets map to node names (sanitized, `GND`→`0`); `dnp` components excluded; sheet hierarchy flattened with path-prefixed refs. Deterministic output (sorted by ref) so the cache actually hits.

**Analyses exposed:** `.op`, `.dc` (single + nested sweep), `.tran` (with UIC option), `.ac` (Bode workspace), `.noise`, Monte Carlo (N runs with tolerance-jittered values — tolerances from part fields, default 5% R / 20% C, seeded RNG for reproducibility), and parameter stepping (any component value as the swept variable).

## D.2 MCU emulation

Per-target emulator cores, each in its own worker, each implementing one interface:

```typescript
interface McuCore {
  loadFirmware(elfOrHex: Uint8Array): void;
  step(maxCycles: number): { cycles: number; events: PinEvent[] };  // run a quantum
  setPin(pin: PinId, v: DigitalLevel | AnalogVolts): void;
  readbackRequests(): AdcReadRequest[];          // ADC sample points hit this quantum
  peripherals: { uart: Stream[]; spi: BusTap[]; i2c: BusTap[] };
  inspect(): RegisterFile;                       // debugger view
}
```

Targets, in build order: **AVR** (avr8js — mature, covers Uno/Mega day one), **RP2040** (good open emulation lineage), **ESP32** (hardest; start with a Xtensa core + GPIO/UART/SPI/I2C/ADC/ledc-PWM peripheral set — *not* full WiFi emulation; WiFi is stubbed as a host-bridged socket so network code still runs). Firmware comes from the scaffold compiler (cloud builders for the web app, local toolchains via the desktop shell) or user-uploaded ELF/HEX.

## D.3 The co-sim bus — conservative lockstep, no rollback

The decision: **conservative synchronization with a fixed quantum, no speculative execution.** Optimistic/rollback co-sim (full HLA-style) is a research project; conservative lockstep at small quanta is shippable and plenty for maker-scale circuits.

- **Quantum:** default **10 µs** of virtual time (configurable 1–100 µs). Per quantum: (1) MCU core(s) `step()` → emit timestamped `PinEvent`s; (2) events become SPICE breakpoints — ngspice runs `.tran` to the quantum boundary, honoring intra-quantum event times via forced timesteps; (3) analog node voltages sampled at the boundary feed back via `setPin` (digital pins: comparator at VIL/VIH with 100mV hysteresis; ADC pins: queued for the read below).
- **ADC reads are hard sync points:** when firmware initiates a conversion, the core flags `AdcReadRequest`; the bus delivers the SPICE node voltage at that exact virtual time (linear-interpolated between solver points), models the ADC (sample-cap settling as an RC against declared source impedance, then quantize to n bits with the reference net’s *actual simulated* voltage — yes, a sagging VREF gives you wrong codes, **as it should**).
- **Digital→analog boundary:** a GPIO output is not an ideal source — it’s a behavioral model: `Vout` through `Rout` (drive-strength dependent, ~25–50Ω typ, from the pin model) with slew limiting (~1–4 V/ns class for these MCUs, configurable). PWM at 20kHz into a gate driver behaves like reality, edge by edge.
- **Performance honesty:** ngspice transient on a ~50-node circuit runs roughly 10–100× slower than real time in WASM. So the UI shows a **virtual-time clock and a slowdown factor**, simulations target *windows* (“run 50ms of virtual time around motor start”), and the Analyst suggests windows instead of pretending you’ll watch minutes of real time. Pure-digital stretches (no analog events pending) fast-forward the MCU at full emulation speed — the bus only locksteps when the domains are actually coupled.

## D.4 Model tiers (the honesty system)

Per part: `models: { spice?: SubcktRef, behavioral?: BehavioralRef, stub: PinInterface }`. Netlist generation picks the best available and **stamps the run’s manifest with the tier used per component**. The plot workspace shows a fidelity bar: *“This run: 14 full-SPICE, 3 behavioral (motor M1 ⚠ — first-order RL + back-EMF model, no cogging), 2 stubs.”* Click the warning, see exactly what the behavioral model does and doesn’t capture. Simulations never lie about what they are.

-----

# E. ROUTING ENGINE

## E.1 Push-and-shove (interactive)

The algorithm sketch (KiCad’s PNS, reconstructed):

1. **Walkaround first:** route head advances toward cursor; on obstacle hit, compute both hull-walk paths (CW/CCW) around the obstacle’s clearance hull; take the shorter unless it violates.
1. **Shove when walkaround fails:** treat the blocking trace as elastic — displace it by the minimum clearance vector, then **propagate**: the shoved trace may shove its neighbors, breadth-first, with a depth cap (default 12) and a cost budget; exceed either → the move is refused and the head walks instead.
1. **Spring-back:** shoved geometry is tentative until mouse-up; abandoned paths restore. Commit emits one `batch` of `edit_trace` ops.
1. **Via shoving** included; **dragging existing traces** reuses the same engine with the dragged segment as the head.
   All against the per-layer R-tree with clearance pre-expanded into the hulls — the hot loop never recomputes clearance math.

## E.2 Length matching & diff pairs

Diff pairs route as a coupled head (gap from the impedance target via the stackup calculator — microstrip/stripline closed-form formulas, good to ~5%, honest about it). Length matching: target = group max; meander generator inserts trombone/accordion patterns in user-marked tuning zones, amplitude/pitch from class rules; live skew readout on the head while routing.

## E.3 Batch autoroute (the Router agent’s hands)

Not a global autorouter chasing 100% completion — a **task router**: fanout escapes (BGA/QFN dog-bones), short two-pin nets under a length threshold, and bus bundles on explicit corridors the human (or Architect) sketches as guide paths. Everything it routes is tagged `routed_by: agent` and listed for review; critical nets (any net carrying a constraint) are *refused* by policy — those are yours, with the Router advising.

-----

# F. THE PROTOPULSE PROBE — HARDWARE SPEC

## F.1 Top level

ESP32-S3 based, USB-C + WiFi, ~$15 BOM @ qty 100, open hardware (KiCad *and* ProtoPulse formats in-repo), designed to be the curriculum’s capstone build.

|Subsystem     |Spec                                                                                                                                                                      |
|--------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|MCU           |ESP32-S3-WROOM-1-N8R8 (8MB flash / 8MB PSRAM — PSRAM is the capture buffer)                                                                                               |
|Logic analyzer|8 ch, 3.3/5V tolerant, **burst 20 MSa/s to PSRAM** (LCD_CAM peripheral in parallel-capture mode, DMA), sustained ~2 MSa/s streaming over USB CDC                          |
|Analog in     |2 ch, ±12V range, **1 MSa/s 16-bit** external SAR (ADS8866 or MCP33131-class) on SPI — the S3’s internal ADC is not invited                                               |
|Signal gen    |1 ch DC–200kHz arb/standard waveforms: MCP4822 12-bit SPI DAC → MCP6022 buffer (the S3 has **no** DAC; PWM+filter rejected for ripple)                                    |
|Bus decode    |I2C/SPI/UART sniffing on LA channels, decoded **on-probe** (firmware) to cut stream bandwidth                                                                             |
|Protection    |Every input: 100k series → BAT54S clamp to rails → SN74LVC8T245 (LA) / precision divider + MCP6022 (analog). Survives ±24V continuous, because clip leads find motor rails|
|Misc          |USB-C (native S3 USB), WS2812 status LED, 2×10 0.1” header + flywire/grabber set, Qwiic connector for I2C peripherals-as-instruments                                      |

## F.2 Firmware architecture

FreeRTOS, three planes: **capture plane** (LCD_CAM DMA → PSRAM ring, ISR-only, nothing else on that core), **decode plane** (protocol decoders + trigger engine walking the ring), **link plane** (USB CDC / WiFi-TCP framing). Triggering: edge/level/pattern across LA channels + analog threshold, pre/post-trigger split configurable, single/normal/auto modes — it’s a real instrument, not a logger.

## F.3 Wire protocol

COBS-framed binary, identical over USB CDC and TCP:

```
[0x00 delim][type u8][seq u16][len u16][payload…][crc16-ccitt]
types: 0x01 HELLO/caps  0x02 CONFIG  0x03 START/STOP  0x04 LA_CHUNK (RLE-compressed)
       0x05 ANALOG_CHUNK (i16 LE)   0x06 DECODE_EVT  0x07 TRIGGER  0x08 MEASURE
       0x09 SIGGEN      0x7F ERROR
```

`MEASURE` is the live-overlay workhorse: `{ channel, kind: vdc|vrms|freq|duty, value: f32, t: u48 }` at up to 50 Hz/channel — tiny frames, low latency.

## F.4 The Live Overlay data path

Probe session opens → app prompts channel↔net binding (“CH1 is on VREG_OUT?”) with smart suggestions (bind to whatever net is selected on canvas) → `MEASURE` frames flow → values render as live badges at the net’s label position, green/amber/red against **expected values pulled from the latest cached simulation of the same net**. The Analyst subscribes to the same stream; divergence beyond tolerance triggers its hypothesis engine (“measured 1.9V on a 5V net + 200mV ripple at 1.2kHz → suspect C7 ESR or value; probe its far side”). Captured LA/analog windows can be **pinned into the design as evidence assets** — the bug report and the schematic become one document.

-----

# G. THE AI CREW — INTERNALS

## G.1 Tool registry

Tools *are* command-registry entries with an AI-facing contract: zod schema, one-line semantic description, `destructive?: boolean` (forces confirm), `costClass: cheap|standard|heavy`, and `explain(op): string` — the function that powers the three-depth dial. ~90 tools at full build, but **agents see scoped slices** (Draftsman: graph + schematic-view ops; Buyer: BOM/sourcing only). Scope is enforced at dispatch, not by prompt politeness.

## G.2 Context assembly (per request, budgeted)

|Slice                          |Budget|Source                                                                                         |
|-------------------------------|------|-----------------------------------------------------------------------------------------------|
|Agent identity + tool contracts|3k tok|static per agent                                                                               |
|Design digest                  |2k    |auto-maintained: part counts, power tree, domains, sheet map                                   |
|Focus window                   |4k    |serialized subgraph around selection/viewport (nets + components + constraints, *not* geometry)|
|Recent ops                     |1.5k  |last N ops with rationales — the agent knows what just happened                                |
|Findings open                  |1.5k  |current ERC/DRC/Review state                                                                   |
|Retrieval                      |4k    |datasheet chunks + concepts wiki + part specs, embedding-matched to the request                |
|Conversation                   |4k    |rolling, consolidated                                                                          |

≈20k in, hard-capped; a debug panel shows the exact assembled context of any request (same inspectability religion as LifeOS). Routing: placement/wiring loops → fast cheap model; architecture/review/teaching → frontier; embeddings + breadboard-photo pre-pass → local.

## G.3 Multi-step execution contract

Agents run a propose→approve→execute loop with **plan visibility**: any task >3 tool calls emits a plan artifact first (numbered steps, each mapping to tools); execution streams ops onto the canvas live (the agent’s presence cursor moves — D&D-mat energy, and it’s also genuinely how you audit it in real time); failures stop the batch and roll back to the last checkpoint *within the batch*. Cross-agent consults are explicit tool calls (`consult(agent, question)`) — logged like everything else, no backchannel.

## G.4 The Design Review checklist (v1 contents, abbreviated)

Power: every IC’s supply pins reached by its domain; decoupling per IC (≥1×100nF within 5mm equivalent + bulk per regulator output); regulator dropout vs input range; inrush on bulk caps. Resets/boot: pull direction on every strap pin vs datasheet; reset RC sane. I/O: floating inputs; OC nets pulled; voltage-domain crossings have level shifting or a flagged justification; connector pinout vs mating part. Power tree: sum of declared draws vs each rail’s budget; trace width vs current per class. PCB: return-path discontinuities under fast signals (heuristic: signal crosses plane split); loop area on switcher hot loops; thermal via count under power pads vs dissipation estimate. Sourcing: lifecycle flags; unverified-model parts in load-bearing roles. Each check = pure function `(graph, views, constraints, partDb) → Finding[]`, findings carry executable fixes where mechanical. The deck is versioned and community-extensible — review rules are content, like DRC decks.

-----

# H. SERVER, SYNC, MANUFACTURING

- **API surface (complete):** `auth/*` (passkeys + OAuth), `sync/*` (WebSocket op exchange: client sends ops since vector, receives missing — Loro handles convergence; server stores segments in object storage, never materializes designs), `ai/*` (SSE proxy, key custody, per-user budget metering), `library/*` (parts/snippets CRUD + search), `share/*` (capability links: view/comment/edit tokens), `fab/*` (quote + order brokers for JLC/PCBWay — server holds the fab API creds, never the client). That’s it. Anything else belongs in the engine.
- **Manufacturing flow detail:** DRC-clean gate → deck-pinned DFM pass → gerber render (the engine’s own plotter, drawn back on canvas — *you preview exactly the bytes being sent*) → quote matrix (qty × finish × assembly tiers) → BOM reconciliation against the fab’s parts library with Buyer-proposed substitutions (each one a reviewable op) → order → status webhook lands as design-attached events. The pinned artifacts (gerber hash, deck rev, BOM snapshot) make every order forensically reproducible.
- **Self-host:** single docker-compose (server + Postgres + MinIO), AI keys bring-your-own, sync server doubles as the LifeOS Beacon peer — one Pi, both nervous systems.

-----

# I. PARTS & FOOTPRINT GENERATOR

Part schema (full): identity (MPN, manufacturer, lifecycle), `pins[]` (key, name, electricalType, pinModel: Rout/slew/Cin for the co-sim boundary), symbol (multi-unit capable), footprints[] (variants: hand-solder vs reflow courtyards), 3D (STEP + glTF preview), models (D.4 tiers), parametrics (typed: ohms/farads/volts/amps per class), sourcing links, provenance tier, and `provenance.evidence[]` (who verified what against which datasheet rev). **Footprint generator:** IPC-7351B density levels (L/N/M) for chip passives (0201–2512), SOIC/SSOP/TSSOP, QFP, QFN (+ thermal pad with via array generator), SOT, DPAK; inputs are the datasheet’s package drawing numbers; output includes courtyard, paste (with QFN paste-reduction windowpaning), and assembly layers. Every generated footprint is born `unverified` — tiers are earned, not assumed.

-----

# J. WHAT’S DELIBERATELY THIN HERE (and where it goes next)

Curriculum track contents, the concepts-wiki seed list, community moderation mechanics, the full ESP32 peripheral emulation matrix, and Probe enclosure design are real work items but architecture-complete above — each is a Volume III chapter on request. Nothing else was held back. This document plus Volume I is the entire vision at every altitude I can render it: thesis → architecture → algorithm → packet format → part number.

Pick a section and we build it.
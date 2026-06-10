# ProtoPulse Roadmap

The canonical home of the build order from
[the vision](./docs/vision/README.md) (Vol I §12). Other docs link here
instead of restating it. Each stage must be **daily-drivable before the
next begins** — the graph-first order means every later feature lands on
bedrock instead of view-sync duct tape.

Status legend: ✅ shipped · 🔨 in progress · ⬜ not started

## v0.1 — The Graph ✅ *(Milestone 1, landed 2026-06-10)*

- [x] `@protopulse/graph` — op-log design graph, branch/diff/merge,
      `.ppx` format (100%-branch coverage gate on the core)
- [x] WebGL2 schematic editor (`@protopulse/app`, place/wire/undo/branch/diff)
- [x] ERC — pin matrix + floating-input + pull-up checks, executable fixes
- [x] KiCad netlist + BOM export passing byte-exact golden files
- [x] `protopulse check` CLI — CI for circuits
- [x] Draftsman agent with exactly 8 tools (`@protopulse/ai`)
- [x] Content seeds: JLC rule deck, concepts wiki (14 articles), Track 1 steps
- [ ] M1 stragglers: pcbnew import manually verified once
      (`tools/golden/README.md`), interactive merge-resolver UI, MSDF
      text + GPU picking, ESP32-S3 verified part

## v0.2 — The Lab 🔨

- [x] `@protopulse/sim` — graph→SPICE netlist with model tiers, ngspice-WASM
      engine (eecircuit-engine), analyses: op/tran/dc/ac (48 tests incl.
      real-WASM integration)
- [x] Fidelity bar (Vol II §D.4) — per-component tier chips; simulations
      never lie about what they are
- [x] Plot workspace v1 — canvas plot, eng-notation axes, crosshair
      cursors, dB/log-x for AC (math channels, FFT, branch overlays ⬜)
- [x] The Analyst — run_simulation/measure/read_design tools on the shared
      agent loop; first live Anthropic panel in the app
- [x] Monte Carlo (seeded, per-class tolerances, spaghetti plots) +
      parameter stepping + noise analysis (engine supports .noise;
      graph-driven noise needs an AC-capable source emitter ⬜)
- [x] Math channels (safe expression evaluator) + branch overlay —
      'plot the same node on two design branches against each other'
- [x] NE555 behavioral macromodel — the traffic-light fixture oscillates
      at 0.719s measured vs 0.721s theory
- [ ] Dedicated sim worker + result streaming (currently run-to-completion
      on the main thread via lazy chunk)
- [ ] Plot FFT; AC-source emitter for graph-driven noise runs

## v0.3 — The Crew 🔨

- [x] Design Review as a first-class artifact (`@protopulse/review`,
      Vol II §G.4): six checks, executable fixes, stored/diffable
      reports with opened/closed deltas, ReviewPanel in the app
- [x] The Professor — third crew member: lookup_concept/explain_finding
      grounded in the wiki; "Ask the Professor" handoff from any finding
- [x] The three teaching depths (do-it/show-me/teach-me): persisted dial,
      show-me status narration, teach-me concept pauses
- [ ] Architect / Router / Buyer (need buses+sheets, PCB, and sourcing —
      v0.4+ substrates)
- [ ] Concepts wiki growth toward the 88-article seed list
- [ ] Review deck versioning + community-extensible review rules

## v0.4 — The Board 🔨

- [x] PCB ops in the graph (footprints/traces/vias as identified entities,
      inverse/diff/merge closure, coverage gate held)
- [x] Footprint model + generic IPC-class seeds (0805/SOT-23/DIP-8 —
      unverified, replace per-MPN before fab)
- [x] `@protopulse/drc` — width/clearance/annular/drill/unrouted against
      the JLC deck (flatbush broad phase + exact distance math)
- [x] PCB view in the app: Schematic|PCB toggle, unplaced tray, trace
      tool (octilinear, cross-net refusal), vias, ratsnest, DRC panel
- [x] In-browser visual QA pass of PCB mode (footprint render, tray
      with footprint-less parts disabled, trace preview, live cross-net
      refusal, DRC against the deck — verified 2026-06-10)
- [x] Stroked trace widths + filled pads/vias in the GL layer (triangle
      pipeline), pcb scene delta sync, side-flip UI (F key + Inspector)
- [x] Gerber X2 / Excellon drill / pick-and-place export with byte-exact
      golden fixtures (routed-led)
- [ ] Push-and-shove routing (Vol II §E.1); zones/pours; panelization

## v0.5 — The Bridge 🔨

- [x] `@protopulse/emu` — ATmega328P core on avr8js (Vol II §D.2 McuCore
      contract): cycle-stamped pin events, external pin drive, UART
      queues, Intel-HEX parser, hand-assembler test rig — the assembled
      blink toggles B5 at ~1206-cycle spacing in test
- [x] Firmware panel: HEX load, run/pause with frame-budgeted stepping,
      serial monitor with input, logic-analyzer-lite stacked pin traces
- [ ] The co-sim bus (Vol II §D.3): conservative lockstep, ADC as hard
      sync point, GPIO behavioral boundary into SPICE
- [ ] WebSerial/WebUSB flashing (needs real hardware to verify)
- [ ] RP2040 / ESP32 cores; timers 1/2, SPI, TWI, ADC peripherals

## v0.6 — The World ⬜

Sync relay, share links, community library with provenance tiers
(Vol III §4), manufacturing pipeline (Vol II §H).

## v0.7 — The Probe ⬜

The open-hardware companion ships (Vol II §F): 8-ch LA, 2-ch analog,
live overlay on the schematic. Curriculum capstone: Track 7.

## Off-vision work items

- Repair legacy main CI: `tauri-build.yml` missing
  `tauri:prepare-sidecars` script, legacy lint debt (~9.7k errors),
  flaky env-dependent legacy tests (failing on main since ≥2026-05-12).
- Migrate the legacy app onto the engine (begins post-v0.2 at the
  earliest; the legacy app remains the shipping product until then).
- Root-directory doc cleanup (move `CODEX_*`/`CLAUDE_RESPONSE_*` collab
  artifacts into `docs/collab/`).

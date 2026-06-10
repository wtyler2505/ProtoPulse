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

## v0.3 — The Crew ⬜

Full agent crew (Architect/Router/Analyst/Buyer/Professor), Design
Review as a first-class artifact (Vol II §G.4), the three teaching
depths, concepts wiki growth toward the 88-article seed list.

## v0.4 — The Board ⬜

PCB view, push-and-shove routing (Vol II §E.1), DRC rule decks
(the JLC deck ships already — the checker doesn't), Gerber/drill/PnP.

## v0.5 — The Bridge ⬜

WebSerial/WebUSB flashing, MCU emulation (AVR first per Vol III §3.2),
then the co-sim bus (Vol II §D.3).

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

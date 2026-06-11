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
- [x] Time-lapse replay (M1 stretch, landed 2026-06-10): History tab
      scrubs the op-log — prefix materialization on the canvas, play/
      pause, read-only while in the past; doubles as the demo-GIF
      generator (`tools/screenshots/capture-replay-gif.ts`)
- [x] Interactive merge resolver (M1 straggler, landed 2026-06-10):
      merge any branch into the current one from the Branches panel —
      auto-merged changes listed, every conflict an explicit ours/theirs
      pick (engine: `mergeBaseOps` + `resolveConflict`), lands as one
      undoable batch with both parents recorded
- [ ] M1 stragglers: pcbnew import manually verified once
      (`tools/golden/README.md`), MSDF text + GPU picking, ESP32-S3
      verified part

## v0.2 — The Lab ✅ *(complete 2026-06-11)*

- [x] `@protopulse/sim` — graph→SPICE netlist with model tiers, ngspice-WASM
      engine (eecircuit-engine), analyses: op/tran/dc/ac (48 tests incl.
      real-WASM integration)
- [x] Fidelity bar (Vol II §D.4) — per-component tier chips; simulations
      never lie about what they are
- [x] Plot workspace v1 — canvas plot, eng-notation axes, crosshair
      cursors, dB/log-x for AC (math channels, FFT, and branch
      overlays all landed later in v0.2 — see below)
- [x] The Analyst — run_simulation/measure/read_design tools on the shared
      agent loop; first live Anthropic panel in the app
- [x] Monte Carlo (seeded, per-class tolerances, spaghetti plots) +
      parameter stepping + noise analysis (graph-driven .noise runs
      via the AC-source emitter below; Noise is a SimPanel analysis)
- [x] Math channels (safe expression evaluator) + branch overlay —
      'plot the same node on two design branches against each other'
- [x] NE555 behavioral macromodel — the traffic-light fixture oscillates
      at 0.719s measured vs 0.721s theory
- [x] Sim worker — ngspice off the main thread (node fallback kept)
- [x] Sim worker streaming (landed 2026-06-11, the Lab's last piece):
      batch runs (Monte Carlo / parameter step) stream one progress
      frame per completed deck — the panel shows "Run 7/20 complete…"
      instead of a frozen spinner. Honest scope: single-deck runs
      can't stream (ngspice-WASM runs a deck to completion)
- [x] Plot FFT (radix-2, Hann, resampled) + AC-source emitter
      (fields.ac) unlocking graph-driven .ac/.noise runs
- [x] Sim ghost overlay (landed 2026-06-10): after op/tran runs the
      schematic wires tint by solved voltage (cold→warm), gradient
      legend in the panel, (branch, opsVersion)-stamped so stale
      ghosts never draw — the Probe's live-overlay UX, sim-fed today

## v0.3 — The Crew ✅ *(complete 2026-06-11)*

- [x] Design Review as a first-class artifact (`@protopulse/review`,
      Vol II §G.4): six checks, executable fixes, stored/diffable
      reports with opened/closed deltas, ReviewPanel in the app
- [x] The Professor — third crew member: lookup_concept/explain_finding
      grounded in the wiki; "Ask the Professor" handoff from any finding
- [x] The three teaching depths (do-it/show-me/teach-me): persisted dial,
      show-me status narration, teach-me concept pauses
- [x] The Router (landed 2026-06-11) — fourth crew member on the shared
      agent loop: read_board / route_connection (walk-first, shove when
      cornered) / run_drc / remove_trace over the REAL routing stack;
      routes land in the session as one undoable batch with
      meta {agent: 'router'}. Its substrate (PCB + DRC + walkaround +
      shove) made it an assembly job — exactly the vision's bet
- [x] Buses + sheets in the graph core (landed 2026-06-11): the
      vision's create_bus/assign_to_bus/add_sheet/set_sheet_interface/
      move_to_sheet ops (+ the remove ops the inverse algebra demands),
      full closure incl. GC/merge_nets maintenance, bidirectional
      bus-membership invariants, sheet-parent cycle detection. The
      Architect's substrate exists; UI surfaces are a later slice
- [x] The Architect (landed 2026-06-11) — fifth crew member on the
      shared agent loop: read_structure / create_bus / create_sheet /
      move_components, resolving nets and components by NAME. The
      purest assembly job yet: its tools need zero host hooks — buses
      and sheets are graph entities, so the loop's working copy is the
      whole substrate. Structure lands in the session as one undoable
      batch with meta {agent: 'architect'}
- [x] The Buyer (landed 2026-06-11) — SIXTH crew member: the crew is
      complete. read_bom / find_offers / assign_sourcing /
      sourcing_report over a rev-stamped catalog snapshot
      (content/catalog/jlc-assembly-seed.json: 9 hand-web-verified
      LCSC numbers with basic/extended class, findings in inbox/). No
      prices or stock BY DESIGN — a static catalog quoting those would
      be lying within a week; the Buyer reasons in assembly classes
      and says "verify at order time". Assignments are reviewable ops
      (fields.lcsc/mpn), one undoable batch, meta {agent: 'buyer'}.
      Live vendor APIs (the vision's "in stock at JLC right now")
      remain v0.6+ work on the manufacturing pipeline
- [x] Concepts wiki COMPLETE at 88/88 (final PCB tranche landed
      2026-06-11): all nine categories of the Vol III §2 seed list.
      DRC codes now deep-link to real PCB articles (trace-width,
      annular-rings, zones) instead of fundamentals placeholders, via
      the new optional drcCodes frontmatter field
- [x] Review deck versioning + community-extensible review rules
      (landed 2026-06-11): runReview takes a named, versioned deck
      (enable/disable checks, severity overrides — a deck states its
      deviations) and extraChecks (pure functions over public types;
      the deck configures them exactly like built-ins). Reports pin
      deck name + rev; content/review-decks/protopulse-standard.json
      is the copyable template. Honest cut: the ReviewPanel still runs
      the builtin deck — a deck picker UI is later work.
      v0.3 IS COMPLETE.

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
- [x] Walkaround interactive routing (`@protopulse/route`, E.1 step 1):
      CW/CCW hull walks over DRC-grade obstacle hulls, same-net copper
      legal, 'manual | walk' toggle on the trace tool (toggle actually
      wired to the tool 2026-06-10 — the engine landed first)
- [x] Shove + spring-back (E.1 steps 2-3, landed 2026-06-10): shove
      mode routes the new trace straight and re-routes blocking traces
      around it (cluster-merged hulls; pads/vias never move; cascades
      refuse honestly); deleting the shover springs victims back to
      their pre-shove paths when still legal — the op-log IS the memory
- [x] Zones/pours (landed 2026-06-11, four gated phases): place_zone/
      remove_zone through the graph core with full closure (the 100%
      coverage gate caught merge_nets not re-pointing zones); computePour
      in @protopulse/route (martinez clipping, integer-nm boundary,
      exact-area tests); pours render under copper + Zone drawing tool;
      DRC zone-overlap error + isolated-island warn; Gerber G36/G37
      regions frozen in the new zoned-led golden. Honest cuts: solid
      connects (thermal reliefs later), square-corner keep-outs
      (conservative)
- [x] Thermal reliefs (landed 2026-06-11): zones carry a per-zone pad
      connect style (solid | thermal) through the full graph closure;
      thermal pours carve an annular gap around same-net pads bridged
      by 4 orthogonal spokes (computePour, exact-area tested); toggle
      lives in the Inspector as one undoable batch. Honest cuts: fixed
      spoke width (0.4mm), same-net vias stay solid-connect. Goldens
      untouched — solid is still the default
- [x] Cascading shove (landed 2026-06-11): when a victim's detour is
      cornered, shovable traces in its corridor join the victim set and
      the WHOLE plan re-runs — every round stays mutually consistent by
      construction, capped at MAX_CASCADE_ROUNDS. The corridor
      heuristic can over-shove a neighbor that didn't strictly need to
      move — safe churn, and spring-back undoes it
- [x] Board outline in the graph core (landed 2026-06-11,
      panelization's prerequisite): set_board_outline (singleton,
      null clears) with full closure — inverse restores the previous
      polygon, diff flags outlineChanged, merge replays theirs-only
      changes (ours wins races), JSON round-trips, the 100% gate held.
      Gerber Edge.Cuts profile layer (0.1mm stroke, KiCad convention;
      null when no outline — honest absence). Substrate-first like
      buses+sheets: outline drawing tool, renderer display, and the
      DRC copper-to-edge check are the open surfaces
- [x] Outline UI + DRC copper-to-edge (landed 2026-06-11): Outline
      toolbar tool (click corners, close on the first corner —
      replaces the previous outline, singleton semantics), yellow
      Edge.Cuts render in the PCB scene (context, never a selection
      target), and DRC-EDGE-CLEARANCE — copper must sit INSIDE the
      outline and keep the deck's copper_to_edge_nm from every edge.
      Browser-verified end to end against the JLC deck
- [ ] Panelization (outline substrate now exists)

## v0.5 — The Bridge 🔨

- [x] `@protopulse/emu` — ATmega328P core on avr8js (Vol II §D.2 McuCore
      contract): cycle-stamped pin events, external pin drive, UART
      queues, Intel-HEX parser, hand-assembler test rig — the assembled
      blink toggles B5 at ~1206-cycle spacing in test
- [x] Firmware panel: HEX load, run/pause with frame-budgeted stepping,
      serial monitor with input, logic-analyzer-lite stacked pin traces
- [x] The co-sim bus, first slice (Vol II §D.3): MCU→SPICE one-way —
      GPIO edges as PWL sources behind the 30Ω behavioral boundary; the
      thesis test measures 0.94Vpp RC ripple vs ~0.9Vpp theory; Co-sim
      panel with bindings, slowdown-honesty readout, square-wave-over-
      analog money plot
- [x] Co-sim feedback direction (the loop is CLOSED): ADC peripheral
      with conversion-completion hard sync, comparator-fed digital
      inputs with hysteresis, quantum loop with honest from-zero
      re-solves — bang-bang firmware regulates its own RC node in test
      (136 conversions, sustained oscillation 1.83-3.20V around the
      2.5V threshold)
- [ ] WebSerial/WebUSB flashing (needs real hardware to verify)
- [x] RP2040 core (landed 2026-06-11): second McuCore, on wokwi's
      rp2040js — Cortex-M0+ with SIO GPIO (cycle-stamped pin events +
      external drive), PL011 UART0 both ways, and the SAR ADC wired to
      the host sampler (12-bit @ 3.3 V; the AVR is 10-bit @ 5 V — each
      core states its own truth). Tests are hand-assembled Thumb
      (thumb-asm.ts, the asm.ts sibling) poking real registers. Honest
      cuts: raw-code entry (no bootrom/UF2), instant ADC conversions
- [x] Firmware-panel core picker (landed 2026-06-11): choose
      ATmega328P or RP2040 at load time; the session rebuilds the core
      on a kind switch (serial monitor + logic analyzer work for both;
      co-sim bindings remain AVR-flavored pin names)
- [ ] ESP32 core; AVR timers 1/2, SPI, TWI peripherals

## v0.6 — The World 🔨 *(first slice landed early)*

Sync relay, community library with provenance tiers (Vol III §4),
manufacturing pipeline (Vol II §H).

- [x] Serverless share links (landed 2026-06-10): the whole design —
      op-log, branches and all — deflate-compressed into the URL
      fragment (`#d=…`). No server, no upload; Copy-share-link in the
      Export panel, confirm-guarded load on the receiving end. The
      67-op 555 fixture travels as a ~2.1k-char URL.
- [x] Sync relay, first slice (landed 2026-06-10): `@protopulse/relay`
      (in-memory WebSocket rooms that union envelopes by (actor,
      lamport) — the relay carries, never owns) + the Sync tab in the
      editor. Two browsers converge live; materialize's total order IS
      the merge. Honest v1: main branch only, in-memory rooms, one tab
      per design per profile
- [x] Sync relay hardening, round 2 (landed 2026-06-11): room
      persistence (append-only JSONL per room via PP_RELAY_DATA — a
      restarted relay re-seeds before anyone rejoins; still a cache,
      never the authority) + shared-token auth (PP_RELAY_TOKEN; the
      Sync panel grew a token field; a rejected client stops cleanly
      instead of retry-looping). Reconnect/backoff and per-tab actor
      identity landed earlier
- [ ] Sync branch sync (non-main branches stay local for now)
- [ ] Community library with provenance tiers
- [ ] Manufacturing pipeline (Vol II §H)

## Migration milestone — legacy retirement (between v0.6 and v0.7) ⬜

The answer to "when do we weed out the old codebase": not by date, by
checklist. A legacy area is deletable only when (1) the engine covers
its user-visible function at equal-or-better quality, (2) the
legacy-Postgres → .ppx op-log importer exists and has moved Tyler's
real projects, (3) nothing depends on it (the Tauri shell wraps the
legacy server; Codex works in legacy/Tauri on main), and (4) Tyler has
stopped using it. Sequence: v0.6 gives the engine its server/persistence
→ build the importer → flip the default UI to the engine app with
legacy read-only for a grace period → delete area-by-area in deliberate
PRs, biggest-dependency-last, one ADR per removal.

- [ ] Legacy → .ppx importer (projects, designs, nets, placements)
- [ ] Default-UI flip + legacy read-only grace period
- [ ] Area-by-area retirement with ADRs (server core + Tauri last)
- [ ] Early safe weeding (independent of the above): root collab
      artifacts → docs/collab/ (coordinate with Codex), fix-or-disable
      the permanently-red legacy CI jobs, legacy dead-code audit

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

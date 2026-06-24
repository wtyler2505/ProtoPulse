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
- [x] ESP32-S3 verified part (M1 straggler, landed 2026-06-11):
      core:esp32-s3-wroom-1 — all 41 module pins verified against the
      Espressif datasheet pin table, cross-checked against an
      independent community pinout (sources in inbox/). Strapping
      pins and EN noted; schematic-usable. Honest cut: no footprint
      yet — the land pattern is a later datasheet-exact slice
- [x] SDF text + GPU picking (M1 straggler/renderer epic, landed
      2026-06-11): the glyph atlas is now a signed distance field
      (exact Felzenszwalb EDT with TinySDF sub-pixel seeding,
      smoothstep shader) — text crisp at every zoom; a GPU color-pick
      buffer (24-bit node IDs, offscreen ID pass + readPixels) drives
      a hover highlight, with the flatbush index as tolerance
      fallback for line art — the Vol II §B.2 dual picking system
      complete (ADR-0015, ADR-0016). Honest cut: single-channel SDF,
      not multi-channel MSDF — corners round ≤1 source pixel at
      extreme zoom
- [ ] M1 straggler: pcbnew import manually verified once
      (`tools/golden/README.md` — Tyler)

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
      is the copyable template. The ReviewPanel's deck picker (landed
      2026-06-11) offers builtin + every bundled deck; report history
      (the opened/closed delta) is kept per (branch, deck).
      v0.3 IS COMPLETE.

## v0.4 — The Board ✅ *(complete 2026-06-11)*

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
- [x] Panelization (landed 2026-06-11): panelizeGraph — the panel is
      a TRANSFORMED GRAPH (rows×cols copies with suffixed ids/refs,
      offset copper, optional top/bottom rails, panel outline), so
      every existing exporter and even DRC work on it unchanged.
      V-cut lines ride Edge.Cuts. Honest cuts: rectangular outlines
      only (a V-cut is a straight full-panel score), no panel
      fiducials (graph can't hold bare copper; fabs add their own).
      v0.4 IS COMPLETE.
- [x] Mouse-bites + fab/panel UI (landed 2026-06-11): mouse-bite
      separation — copies part by a routed channel (default 2mm)
      bridged by tabs (default 5mm, two per copy edge at 25%/75%)
      with 0.5mm perforations at 0.75mm pitch along BOTH channel
      edges; per-piece outlines ride Edge.Cuts, bites join the drill
      file (one Excellon file — KiCad would split PTH/NPTH; the
      default stays byte-identical to the golden contract). The
      Export tab gains Fab outputs (board fab set: F/B copper,
      Edge.Cuts, drill, pick-and-place) and Panelize (rows/cols/
      rail/separation/gap/tab → panel fab set) — browser-verified:
      a 2×2 mouse-bite panel downloads with exactly the engine's
      224 perforations. Honest cut: outline-overlay Edge.Cuts
      (outer rect + piece rects + bites), not a kikit-style routed
      contour polygon

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
      co-sim bindings became core-aware on 2026-06-20 — see the ESP32-S3
      base completion gate below)
- [x] AVR timers 1/2, SPI, TWI (landed 2026-06-11): timers 1/2 drive
      their OC pins through the existing port listeners (CTC toggles
      land cycle-exact in the pin-event stream); SPI master against a
      host byte handler (no handler = bus floats 0xFF, like real
      disconnected MISO); TWI master against a host bus handler with
      synchronous acks (no handler = NACK, an empty bus, never a
      hang). Honest gap: SPI/TWI slave mode not modeled
- [x] AVR EEPROM + watchdog (landed 2026-06-11): 1 KiB EEPROM against
      a persistent backend — nonvolatile across reset(), like the
      silicon (eepromMemory() for bench pre-seeding/inspection);
      watchdog with the real WDCE arm window — WDE timeout resets the
      CPU and sets MCUSR.WDRF, WDR feeds it. Honest note: avr8js's
      watchdog reset preserves I/O registers (real silicon clears
      them); SRAM surviving is faithful. Co-sim ADC channel candidates
      now come from the borrowed core (RP2040 offers ADC0–3, not the
      AVR's 0–7), and the panel names the core it borrowed
- [x] ESP32-S3 core v0 (landed 2026-06-11 — the "a build, not a
      wire-up" epic's first slice): a FROM-SCRATCH Xtensa LX7
      interpreter (24-bit call0-ABI subset, ~32 instructions) plus
      the GPIO matrix (both banks, IO0–IO48, W1TS/W1TC semantics,
      cycle-stamped pin events) and UART0 (FIFO + STATUS) at the real
      S3 addresses — every encoding and register verified against the
      Espressif ISA overview, the ida-xtensa2 disassembler tables,
      and esp-idf v5.2's own headers (sources in inbox/). Tests are
      hand-assembled machine code (xtensa-asm.ts, the asm.ts sibling)
      with byte fixtures pinned against independent disassemblies:
      zero-jitter blink, input mirror, high-bank pins, UART echo,
      CALL0/RET subroutines. The Firmware panel loads raw .bin images
      for it. Honest cuts, stated in the core header: single core,
      1 instr = 1 cycle, no 16-bit density forms or register windows
      (ESP-IDF app images will NOT run), no interrupts, no ADC (the
      co-sim panel offers no channels), no bootloader
- [x] ESP32-S3 core slice 2 — code-density instructions (landed
      2026-06-11): the 16-bit .N forms GCC emits densely (MOV.N,
      MOVI.N with its asymmetric −32..95 encoding, ADD.N, ADDI.N
      with the t=0→−1 rule, L32I.N/S32I.N, BEQZ.N/BNEZ.N
      zero-extended forward-only, RET.N/NOP.N), settled against the
      full Cadence ISA RM where the Espressif overview's text
      extraction garbled operand order and signedness (addendum in
      the inbox note). The assembler grew narrow builders, true
      mixed-width layout, and index-based *_TO control-flow
      placeholders — hand-counted branch offsets are how today's two
      assembler bugs happened, so the layout engine resolves targets
      now. RETW.N (windowed) refuses loudly
- [x] ESP32-S3 core slice 3 — the windowed ABI (landed 2026-06-11):
      CALL4/8/12, CALLX4/8/12, ENTRY, RETW/RETW.N over a 64-entry
      physical register file with WindowBase/WindowStart, per the
      Cadence ISA RM's quoted mechanics. Overflow/underflow is MAGIC
      SPILL/FILL — the RM's reference handlers' documented net effect
      performed directly (a0..a3 to [nextSP−16..−4], extras to
      [prevSP−32/−48..−20], prevSP from [sp−12]) — byte-for-byte the
      layout compiled code expects, no exception machinery. Proven by
      14 live frames of call8 recursion over the 64-register file:
      multiple spill rounds down, fills on the unwind, every frame's
      saved registers surviving (the test's own first draft violated
      the ABI's entry-32 rule and the emulator caught it). Honest
      cuts: spill/fill costs no cycles; MOVSP and the handler-only
      L32E/S32E refuse; PS not modeled
- [x] ESP32-S3 core slice 4 — exceptions + level-1 interrupts + the
      core timer (landed 2026-06-11): RSR/WSR/RSIL/RFE over a real
      special-register file (PS with INTLEVEL/EXCM gating, EPC1,
      EXCSAVE1, EXCCAUSE, VECBASE, INTENABLE, INTERRUPT, CCOUNT,
      CCOMPARE0 — numbers verified against the RM, including catching
      its own index typo on EXCSAVE1), the CCOUNT/CCOMPARE timer
      latching INT6 per ESP32-S3's core-isa.h, and level-1 dispatch
      to VECBASE+0x340 with EXCCAUSE=Level1Interrupt. Proven
      end-to-end: a periodic timer interrupt vectors into a handler
      that does the architectural EXCSAVE1 save dance, re-arms
      CCOMPARE0 (which clears the pending bit, per the RM), and RFEs
      while main counts the ticks; RSIL latching + masked-delivery;
      CCOUNT cycle-exactness. The assembler grew RSR/WSR/RSIL/RFE,
      the SR name map, and PAD_TO (placing handlers at architectural
      offsets). Honest cuts: timer line only, level-1 only, UM/WOE
      stored not acted on, vectoring costs no cycles
- [x] ESP32-S3 core slice 5 — MOVSP + the ESP-IDF app-image loader
      (landed 2026-06-11): MOVSP with the Alloca handler's net effect
      (callers live → plain sp move; all three WindowStart bits below
      clear → the 4-word base save area moves with the stack pointer,
      per the RM's reference handler — both paths proven by tests
      that hide and restore WindowStart via WSR); and the emulator
      now boots real esptool-shaped .bin app images — the 24-byte
      header (magic 0xE9, entry_addr, chip_id) validated against
      esp-idf's esp_app_format.h, per-segment loading into the SRAM
      window, the trailing XOR-0xEF checksum verified, and reset()
      replaying segments from the image's entry point. Wrong-chip,
      flash-mapped-segment, and corrupted-checksum images refuse
      with clear messages
- [x] ESP32-S3 core slice 6 — peripheral interrupt lines through the
      interrupt matrix (landed 2026-06-11): the matrix at 0x600C2000
      with per-source 5-bit map registers (GPIO at +0x040, UART0 at
      +0x06C, reset 16 = silent, per the headers), GPIO pin
      interrupts (GPIO_PINn INT_TYPE posedge/negedge/anyedge/level +
      INT_ENA bit 13, STATUS/W1TC latching — level types re-assert
      after W1TC while the level holds, like hardware), and UART0's
      RXFIFO_FULL (against the CONF1 threshold) + TX_DONE through
      INT_RAW/ST/ENA/CLR. The CPU grew level-triggered external
      level-1 lines (driven by the SoC, masked to core-isa.h's
      level-1 externals, immune to INTCLEAR per the RM). Proven: a
      rising-edge pin interrupt counts 2 of 3 edges (falling ignored),
      a high-level interrupt re-fires until the pin drops, and a
      fully interrupt-driven UART echo with main parked on a jump
- [x] ESP32-S3 core slice 7 — SAR ADC1 oneshot (landed 2026-06-11):
      the SENS_SAR_MEAS1_CTRL2 register dance the oneshot driver and
      analogRead perform (one-hot channel select in SAR1_EN_PAD, the
      MEAS1_START_SAR 0→1 pulse, MEAS1_DONE_SAR poll, 12-bit
      MEAS1_DATA_SAR), wired to the McuCore co-sim sampler surface
      (setAdcSampler/drainAdcReads — the ESP32-S3 was the only core
      without analog channels; the co-sim panel now offers ADC1's
      channels 0–9 = GPIO1–10). Cuts: instant conversions, no
      attenuation (3.3 V full scale), no ADC2/DMA mode
- [x] ESP32-S3 core slice 8 — TIMG0 timer 0 (landed 2026-06-11): the
      54-bit general-purpose timer over the 80 MHz APB clock with its
      16-bit prescaler (field 0 = ÷65536, per the HAL),
      UPDATE-latched LO/HI reads, LOAD, up/down counting, and the
      alarm that hardware auto-disables on fire — exactly the
      behavior gptimer's ISR re-arms around — routed through the
      interrupt matrix (TG_T0 map at +0x0C8). The counter is virtual
      (derived from elapsed cycles, no per-cycle cost). Proven:
      cycle-exact tick counting through UPDATE, a periodic
      autoreload alarm counting 3 with the gptimer re-arm dance, and
      a one-shot alarm firing exactly once. Cuts: T0 only (no
      T1/TIMG1/watchdogs), APB source only
- [x] ESP32-S3 core slice 9 — flash-mapped IROM/DROM segments
      (landed 2026-06-11): app-image segments in the cache windows
      (IROM 0x42000000–0x44000000, DROM 0x3C000000–0x3E000000, per
      soc.h/ext_mem_defs.h) are served read-only at their vaddrs —
      the net effect of the bootloader's MMU setup plus a warmed
      cache, which is exactly what those segment headers mean
      (.flash.text/.flash.rodata are mapped, not copied). Proven: an
      XIP image with NO SRAM segment boots from IROM, reads a const
      from DROM, and survives reset; cache-window writes and
      unmapped-window reads refuse loudly. Cuts: 1-cycle XIP reads
      (no cache-miss timing), no MMU registers (no runtime remap)
- [x] ESP32-S3 core slices 10–13 — IDF startup runway (landed
      2026-06-12): host-intercepted ROM functions, RTC/eFuse/SYSTEM
      startup registers, second-core release/reset behavior, all four
      general-purpose TIMG timers, MWDT watchdogs, and the RTC RWDT.
      Cuts: ROM is semantic traps rather than redistributable mask
      ROM, no peripheral interrupts route to core 1, watchdog reset
      routing is simplified, and RTC watchdog interrupt delivery is
      not modeled yet
- [x] ESP32-S3 core slice 14 — SAR ADC2 oneshot (landed 2026-06-12):
      SENS_SAR_MEAS2_CTRL2 now mirrors ADC1's oneshot flow
      (one-hot SAR2_EN_PAD select, MEAS2_START_SAR pulse,
      MEAS2_DONE_SAR poll, 12-bit MEAS2_DATA_SAR). ADC2 channel n
      maps to GPIO n+11 and is exposed to the one-dimensional co-sim
      sampler/read-log surface as channel 10+n, so ADC1 and ADC2 mux
      numbers cannot collide. Cuts: instant conversions, no
      attenuation; the APB_SARADC continuous substrate starts in
      slice 15
- [x] ESP32-S3 core slice 15 — APB_SARADC digital-controller
      substrate (landed 2026-06-12): the register block at
      0x60040000 now stores CTRL/CTRL2/FSM_WAIT/pattern tables/
      DMA_CONF/CLKM/threshold config, exposes ADC1/ADC2 DATA_STATUS
      and INT_RAW/ST/CLR, decodes packed 6-bit pattern entries, and
      runs instant timer/start-triggered conversions through the same
      host sampler/read-log surface. Clearing ADC1_DONE while timer
      mode is enabled advances the running pattern table. Cuts at
      landing: no GDMA descriptor engine yet; slice 16 fills that gap
- [x] ESP32-S3 core slice 16 — ADC continuous GDMA frame delivery
      (landed 2026-06-12): GDMA RX channel registers at 0x6003F000
      now model the in-link path IDF's ADC continuous driver uses.
      A channel whose IN_PERI_SEL is ADC_DAC consumes APB_SARADC
      result words into real 12-byte DMA descriptors in SRAM,
      updating descriptor length, owner, SUC_EOF, RX DONE/SUC_EOF
      raw status, and EOF descriptor address. The frame word uses
      ESP32-S3's 32-bit ADC_DIGI_OUTPUT_FORMAT_TYPE2 layout
      (12-bit data, 4-bit channel, unit bit). Proven by hand-
      assembled firmware that builds a descriptor, starts GDMA, runs
      two ADC1 channel-2 conversions, and reads the frame back from
      the DMA buffer. Cut at landing: no GDMA interrupt-matrix route
      yet; slice 17 fills that wakeup path
- [x] ESP32-S3 core slice 17 — GDMA RX interrupt delivery for ADC
      continuous mode (landed 2026-06-12): DMA_IN_CH0..4 interrupt-
      matrix map registers at 0x600C2108..0x600C2118 now feed enabled
      GDMA RX raw bits into the same level-1 external line surface as
      GPIO/UART/TIMG. GDMA IN_INT_ENA/CLR and in-link errors recompute
      the CPU line mask, so RX DONE/SUC_EOF can vector firmware into a
      handler. Proven by hand-assembled firmware that maps DMA_IN_CH0
      to CPU line 0, enables DONE|SUC_EOF, completes an ADC continuous
      descriptor, increments an ISR counter, clears GDMA raw status,
      and returns to read the DMA frame. Cuts: no driver-pool/
      backpressure timing, only simple next-pointer descriptor
      advancement
- [x] ESP32-S3 core slice 18 — GDMA descriptor-starvation visibility
      (landed 2026-06-12): ADC continuous samples that arrive after
      the DMA-owned descriptor pool is exhausted now latch
      IN_DSCR_EMPTY instead of disappearing silently. Proven by
      hand-assembled firmware that fills a one-frame descriptor,
      clears DONE/SUC_EOF, triggers another ADC sample, and observes
      DSCR_EMPTY while the original frame remains intact. Honest cut:
      this is starvation visibility, not the full ESP-IDF driver pool
      model; flush policy and real backpressure timing remain open
- [x] ESP32-S3 core slice 19 — eFuse programming substrate
      (landed 2026-06-12): eFuse BLOCK0..10 readback is modeled, with
      BLOCK1 still serving the documented synthetic MAC and v0.0 chip
      revision. PGM_DATA0..7, PGM_CHECK_VALUE0..2, CONF, CMD,
      INT_RAW/ST/ENA/CLR, and timing/control registers now match the
      ESP-IDF v5.2 ESP32-S3 register shape closely enough for
      firmware to stage writes, issue CMD.PGM_CMD for a selected
      block, observe PGM_DONE, and read back one-way ORed eFuse bits.
      Proven by hand-assembled firmware that burns BLK2 word 0,
      verifies program-register clear, clears PGM_DONE, then burns a
      second value to prove one-way OR semantics. Cuts: no read/write
      protection policy, no RS-code validation, and no security-key
      side effects yet
- [x] ESP32-S3 core slice 20 — APB_SARADC interrupt delivery
      (landed 2026-06-12): the APB_ADC interrupt-matrix source at
      +0x104 now routes APB_SARADC INT_RAW&INT_ENA into core 0's
      level-1 external interrupt surface, so ADC digital-controller
      firmware can wake from ADC1/ADC2 DONE instead of polling
      INT_ST forever. Proven by hand-assembled firmware that maps
      APB_ADC to CPU line 0, enables ADC1_DONE, starts a digital ADC1
      conversion, vectors into a handler, clears INT_CLR, and returns
      with DATA_STATUS intact. Cuts: core-0 only; threshold interrupt
      delivery waits on threshold comparator modeling in slice 21
- [x] ESP32-S3 core slice 21 — APB_SARADC threshold comparators
      (landed 2026-06-13): the two ESP-IDF digital monitor threshold
      comparators now consume THRES0/1_CTRL and THRES_CTRL, use the
      adc_ll channel encoding `adc_unit << 3 | channel & 0x7`, and
      latch THRES0/1_HIGH or THRES0/1_LOW raw bits when ADC digital
      samples cross `raw_result > high` or `raw_result < low`.
      Proven by hand-assembled firmware that routes a monitor-0 high
      crossing through APB_ADC_INT_MAP into a level-1 handler, clears
      THRES0_HIGH, preserves DATA_STATUS, and separately latches/
      clears a monitor-1 low crossing. Cuts: instant compare at sample
      time; monitor 0/1 only; no sleep/wake integration yet
- [x] ESP32-S3 core slice 22 — WAITI sleep/wake substrate
      (landed 2026-06-13): the Xtensa core now implements WAITI's
      `0x007000 | imm4 << 8` encoding, sets PS.INTLEVEL, parks the
      core without retiring further instructions, continues CCOUNT
      ticks while idle, and resumes at the post-WAITI PC when an
      enabled modeled level-1 interrupt wakes it. Proven by hand-
      assembled firmware that arms CCOMPARE0, executes WAITI(0),
      vectors into the level-1 timer handler, clears/re-arms the
      timer, returns through RFE, and only then emits the post-WAITI
      UART byte. Cuts: level-1 wakeups only; no light/deep sleep
      register policy, clock gating, or RTC wake sources yet
- [x] ESP32-S3 core slice 23 — GDMA RX pool backpressure recovery
      (landed 2026-06-13): CPU-owned descriptors in an ADC continuous
      circular pool now behave like driver-pool backpressure instead
      of fatal descriptor errors: the channel latches DSCR_EMPTY,
      parks without dropping its current descriptor, and resumes when
      firmware returns OWNER_DMA before the next sample. Proven by
      hand-assembled firmware that fills a circular descriptor, hits
      DSCR_EMPTY while firmware owns it, restores DMA ownership, and
      observes the next sample overwrite the DMA buffer cleanly.
      Cuts: instant sample-time pressure; no timed flush/drop policy
      or esp_adc_continuous_flush_pool policy knob yet
- [x] ESP32-S3 core slice 24 — ADC continuous overflow policy knob
      (landed 2026-06-13): the emulator now exposes
      setAdcContinuousFlushPool(true) to mirror ESP-IDF's
      `adc_continuous_handle_cfg_t.flags.flush_pool`: the default
      policy records a drop-new overflow event and leaves old frame
      data intact; flush mode records a flush-old overflow event,
      recycles the CPU-owned GDMA frame, and overwrites it with the
      new ADC sample. Proven by hand-assembled circular-pool firmware
      for both policies. Cuts: host-side policy knob only — full
      esp_adc driver ringbuffer/callback behavior still belongs with
      unmodified IDF/FreeRTOS bring-up
- [x] ESP32-S3 core slice 25 — LEDC low-speed PWM first cut
      (landed 2026-06-13): LEDC's low-speed register block at
      0x60019000 now models the one-group ESP32-S3 shape: 8
      channels, 4 timers, driver-style duty writes (`duty << 4`),
      duty-start readback, timer divider/resolution counters, and GPIO
      matrix output routing via LEDC_LS_SIG_OUT0..7. Proven by
      hand-assembled firmware that routes channel 0 through
      GPIO_FUNC5_OUT_SEL_CFG and observes cycle-stamped 50% PWM edges
      on IO5, plus a readback test for ESP-IDF integer-duty semantics.
      Cuts: no fade engine, LEDC interrupts, clock-source switching,
      sleep behavior, or high-level driver API shim yet
- [x] ESP32-S3 core slice 26 — LEDC interrupt delivery
      (landed 2026-06-13): the LEDC interrupt-matrix map at
      0x600C208C now routes enabled LEDC INT_RAW bits into core 0's
      level-1 external interrupt surface, including the ESP-IDF
      duty-change-end bits at `BIT(4 + channel)`. LEDC INT_ENA/CLR and
      duty-start writes recompute the CPU line mask, so firmware can
      clear and re-arm duty-change interrupts without polling. Proven
      by hand-assembled firmware that maps LEDC to CPU line 0, enables
      channel-0 duty-change-end, vectors twice through a handler, clears
      INT_CLR, and reports the ISR count over UART. Cuts: duty-change
      end only; no fade engine, timer/overflow interrupt generation,
      clock-source switching, sleep behavior, or high-level driver API
      shim yet
- [x] ESP32-S3 core slice 27 — LEDC low-speed timer overflow IRQs
      (landed 2026-06-13): low-speed timer overflow bits
      `LEDC_LSTIMERn_OVF_INT_RAW` (`BIT(0..3)`) now latch as virtual
      LEDC time advances, route through the existing LEDC interrupt
      matrix source, and clear via `LEDC_INT_CLR`. LEDC timers resync
      when the global LEDC clock is toggled so disabled-clock time does
      not replay. Proven by hand-assembled firmware that maps LEDC to
      CPU line 0, enables timer0 overflow interrupts, clears each ISR,
      and reports three overflow interrupts over UART. Cuts: no fade
      engine, channel overflow-count interrupts (`BIT(12 + channel)`),
      clock-source switching, sleep behavior, or high-level driver API
      shim yet
- [x] ESP32-S3 core slice 28 — LEDC channel overflow-count IRQs
      (landed 2026-06-13): low-speed channel overflow-count bits
      `LEDC_OVF_CNT_LSCHn_INT_RAW` (`BIT(12 + channel)`) now latch when
      an enabled channel's selected timer crosses its programmed
      overflow-count threshold. CONF0 writes model ESP-IDF's
      `ovf_num = max_count - 1`, `ovf_cnt_en`, and write-only
      `ovf_cnt_rst`; timer/global-clock changes resync channel counters
      so stale elapsed time is not replayed. Proven by hand-assembled
      firmware that maps LEDC to CPU line 0, enables channel-0
      overflow-count interrupts every two timer overflows, clears
      INT_CLR in the ISR, and reports three interrupts over UART. Cuts:
      no fade engine, clock-source switching, sleep behavior, or
      high-level driver API shim yet
- [x] ESP32-S3 core slice 29 — LEDC shared clock-source selection
      (landed 2026-06-13): the shared low-speed LEDC clock selector in
      `LEDC_CONF.apb_clk_sel` now preserves APB/RC_FAST/XTAL writes,
      reads back like ESP-IDF's `ledc_ll_get_slow_clk_sel`, and drives
      the timer counter rate for all low-speed timers. Clock-source
      changes resync timer and channel overflow epochs so elapsed time
      from the old source is not replayed under the new source. Proven
      by hand-assembled firmware that selects XTAL, reads back selector
      value 3 over UART, and observes the same 2-bit PWM configuration
      double its half-period from APB's 6 cycles to XTAL's 12 cycles.
      Cuts: no fade engine, sleep behavior, or high-level driver API
      shim yet
- [x] ESP32-S3 core slice 30 — LEDC single-range hardware fade
      (landed 2026-06-13): `LEDC_LSCHn_CONF1` now models the common
      ESP-IDF fade path for one hardware range: `duty_scale`,
      `duty_cycle`, `duty_num`, `duty_inc`, and `duty_start` advance
      `DUTY_R` over selected-timer PWM overflows instead of treating
      every `DUTY_START` as an immediate update. Fixed-duty updates
      with zero fade scale/cycle/steps still apply immediately for
      `ledc_update_duty()`. Fade completion latches the existing
      duty-change-end interrupt bit. Proven by hand-assembled firmware
      that starts at duty 1, fades upward by two single-cycle steps,
      waits for `LEDC_DUTY_CHNG_END_LSCH0_INT_ST`, and reads back duty
      3 over UART. Cuts: no gamma/multi-fade ranges, sleep behavior, or
      high-level driver API shim yet
- [x] ESP32-S3 core slice 31 — LEDC fade-stop fixed-duty abort
      (landed 2026-06-13): the fixed-duty update path now explicitly
      aborts any active single-range fade, matching the register writes
      used by ESP-IDF's `ledc_fade_stop()` after it snapshots the
      current duty. Proven by hand-assembled firmware that starts a
      longer fade, waits until `DUTY_R` has partially advanced, writes
      that raw duty back through `DUTY`, sends a zero-param
      `DUTY_START`, and verifies the duty stays pinned instead of
      drifting to the original fade target. Cuts: no blocking
      `LEDC_FADE_WAIT_DONE` driver shim or gamma/multi-fade stop path yet
- [x] ESP32-S3 core slice 32 — RMT TX GPIO waveform substrate
      (landed 2026-06-13): RMT TX channels 0..3 now accept APB FIFO
      `rmt_symbol_word_t` writes, honor the group/channel dividers for
      APB/XTAL/RC_FAST clocks, drive GPIO-matrix signals 81..84, apply
      idle output level, and latch TX_END INT_RAW/ST/ENA/CLR through
      the core-0 RMT interrupt-map source. Proven by hand-assembled
      firmware that routes RMT channel 0 to IO5, emits high/low symbols
      with 6/9/3-cycle edge spacing at APB/divider 1, and reads TX_END
      bit 0 back over UART. Cuts: no RMT RX, DMA/direct-memory mode,
      carrier modulation, loop mode, threshold events, or high-level
      driver queue shim yet
- [x] ESP32-S3 core slice 33 — RMT TX threshold + finite loop events
      (landed 2026-06-13): TX channels now expose `CHn_TX_LIM`
      read/write state, latch `TX_THR_EVENT` when the programmed symbol
      threshold is reached, and model finite `TX_CONTI_MODE` loop
      counting with `TX_LOOP` plus loop-stop autostop into `TX_END`.
      Proven by hand-assembled firmware that loops one RMT symbol twice,
      routes it to IO5, observes the repeated waveform, and reads
      TX_END/TX_THR_EVENT/TX_LOOP raw bits back over UART. Cuts: no RMT
      RX, DMA/direct-memory mode, carrier modulation, threshold refill
      queue shim, or repeated threshold relatching after firmware clears
      the raw bit mid-transmission yet
- [x] ESP32-S3 core slice 34 — RMT RX GPIO capture substrate
      (landed 2026-06-13): RX channels now expose the hardware channel
      4..7 config windows (`CH4CONF0/1` etc.), GPIO input-matrix routing
      for `RMT_SIG_IN0..3`, `CH4..7DATA` APB FIFO reads,
      `CHm_RX_LIM`, RX threshold events, and idle-threshold completion
      into RX_END. Proven by hand-assembled firmware that routes host-
      driven IO4 into RMT RX channel 0, captures a high/low symbol,
      reads RX_END/RX_THR raw bits, and reads duration/level fields back
      over UART. Cuts: no RMT DMA/direct-memory mode, carrier
      demodulation, partial-buffer wrapping, driver ringbuffer callback
      shim, or repeated threshold relatching after raw clear yet
- [x] ESP32-S3 core slice 35 — RMT TX carrier modulation
      (landed 2026-06-13): TX channels now expose `CHnCARRIER_DUTY`,
      honor `CARRIER_EN`, `CARRIER_EFF_EN`, and `CARRIER_OUT_LV`, and
      modulate the configured data level with high/low carrier ticks
      from the RMT group clock while symbol durations still use the
      channel divider. Proven by hand-assembled firmware that routes
      RMT channel 0 to IO5, enables 1/1 carrier duty on a high symbol,
      and observes 3-cycle carrier edges before the low data segment
      stays unmodulated. Cuts: no RMT DMA/direct-memory mode, RX carrier
      demodulation, threshold refill queue shim, or repeated threshold
      relatching after raw clear yet
- [x] ESP32-S3 core slice 36 — RMT APB direct-memory TX + threshold
      rearm (landed 2026-06-13): TX channels now honor
      `SYS_CONF.APB_FIFO_MASK` as the hardware APB direct-memory path,
      keep per-channel APB write cursors, expose `CHnSTATUS`
      read/write cursor bits plus APB write overflow status, and start
      TX from the channel memory image instead of the FIFO when direct
      mode is enabled. TX threshold interrupts now advance by sent
      symbol count, so firmware can clear `TX_THR_EVENT` and observe a
      later threshold crossing in the same transmission. Proven by
      hand-assembled firmware that writes two CH0 symbols through direct
      memory mode, reads back APB write cursor 2, routes CH0 to IO5,
      clears the first threshold raw bit, and observes the second
      threshold event over UART. Cuts: no live mutation of an
      already-built TX waveform from a refill ISR, no RX
      direct-memory/wrap path, and no RX carrier demodulation yet
- [x] ESP32-S3 core slice 37 — RMT TX GDMA channel-3 first cut
      (landed 2026-06-13): GDMA OUT channels now expose the TX-side
      register half (`OUT_LINK`, raw/status/enable/clear,
      EOF descriptor addresses, priority/weight, and peripheral select)
      and RMT TX channel 3 can source symbols from DMA-owned descriptors
      when `dma_access_en_chn` is enabled. Proven by hand-assembled
      firmware that builds a 12-byte GDMA descriptor in SRAM, points it
      at two RMT symbols, selects GDMA peripheral 9 (RMT), starts CH3
      through the GPIO matrix, observes the IO5 waveform, and confirms
      `OUT_DONE|OUT_EOF|OUT_TOTAL_EOF` plus raw clear over UART. Cuts:
      no ping-pong live refill/`gdma_append` timing, no RX
      direct-memory/wrap path, and no RX carrier demodulation yet
- [x] ESP32-S3 core slice 38 — RMT RX GDMA channel-3 first cut
      (landed 2026-06-13): RMT RX channel 3 now honors the RX
      `dma_access_en_chm` bit and writes captured 32-bit symbols into
      GDMA IN descriptors selected with peripheral 9 (RMT). RX idle end
      finalizes a partially filled descriptor with
      `DONE|SUC_EOF`, descriptor length writeback, and CPU ownership,
      matching the ESP-IDF driver's DMA end-marker path that uses GDMA
      callbacks instead of RMT RX interrupts. Proven by hand-assembled
      firmware that arms GDMA IN, routes IO4 to `RMT_SIG_IN3`, captures
      a high/low symbol through CH7, verifies the DMA buffer contents,
      confirms no RMT RX_END raw byte is needed in DMA mode, and clears
      GDMA raw status over UART. Cuts: no RX DMA ping-pong/partial
      receive callback flow, no carrier demodulation, no RX
      direct-memory/wrap APB readback path, and no driver ringbuffer API
      shim yet
- [x] ESP32-S3 core slice 39 — RMT RX GDMA partial receive descriptors
      (landed 2026-06-13): the RMT RX DMA path now continues across
      linked GDMA IN descriptors after a full descriptor latches
      `DONE|SUC_EOF`, lets firmware clear the first callback raw bits,
      keeps receiving into the next descriptor, and finalizes the
      partially filled tail descriptor on idle EOF. Proven by hand-
      assembled firmware that arms two descriptors on RMT RX channel 3,
      captures one symbol into the first descriptor, clears GDMA raw
      status while RX remains armed, captures a second symbol into the
      second descriptor, and verifies the final partial length and
      ownership handback over UART. Cuts: no RX carrier demodulation,
      no RX direct-memory/wrap APB readback path, no driver ringbuffer
      API shim, and no TX live refill/`gdma_append` timing yet
- [x] ESP32-S3 core slice 40 — RMT RX carrier demodulation first cut
      (landed 2026-06-13): RMT RX channels now keep raw input level
      separate from demodulated level, honor CHmCONF0 carrier
      enable/polarity bits, expose CH4..CH7_RX_CARRIER_RM low/high
      threshold registers, and collapse short carrier gaps on the
      configured active level back into one captured base pulse. Proven
      by hand-assembled firmware that routes IO4 to RMT RX channel 0,
      enables high-level carrier demodulation, programs carrier-remove
      thresholds, feeds a carrier-mark burst with short low gaps, and
      verifies one demodulated high/low symbol plus RX threshold/end
      status over UART. Cuts: no RX direct-memory/wrap APB readback
      path, no driver ringbuffer API shim, and no TX live
      refill/`gdma_append` timing yet
- [x] ESP32-S3 core slice 41 — RMT RX direct-memory wrap readback
      (landed 2026-06-13): RX channels now keep hardware-style memory
      write/read cursors, honor `CHmCONF1.MEM_RX_WRAP_EN`, expose
      `CH4..CH7STATUS` RX write/APB-read offsets plus memory/read-error
      flags, and read `CH4..CH7DATA` from the APB direct-memory image
      when `SYS_CONF.APB_FIFO_MASK` is set. Proven by hand-assembled
      firmware that routes IO4 into RMT RX channel 0, fills one 48-symbol
      block, wraps one extra symbol into slot 0, reads it back through
      `CH4DATA`, and verifies both CH4 status cursors over UART. Cuts:
      no driver ringbuffer API shim, no TX live refill/`gdma_append`
      timing, and no additional RMT error taxonomy beyond memory full /
      APB read overflow yet
- [x] ESP32-S3 core slice 42 — RMT TX direct-memory live refill
      (landed 2026-06-13): direct-memory TX writes now update the
      active channel memory image and rebuild the not-yet-transmitted
      waveform, so a threshold/refill ISR can change future symbols
      while the current transmission keeps running. The APB write cursor
      also wraps when `MEM_TX_WRAP_EN` is set, matching the refill style
      used around ping-pong RMT memory. Proven by hand-assembled firmware
      that starts CH0 from two direct-memory symbols, waits for the
      first `TX_THR_EVENT`, resets the APB write cursor, rewrites the
      future slot, and verifies IO5 holds high until the refilled
      symbol's delayed TX_END edge instead of taking the original early
      low edge. Cuts: no driver ringbuffer API shim and no additional
      RMT error taxonomy beyond existing memory/APB overflow flags yet
- [x] ESP32-S3 core slice 43 — FROM_CPU cross-core software interrupts
      (landed 2026-06-13): SYSTEM_CPU_INTR_FROM_CPU0..3 now latch the
      software interrupt bit exactly the way ESP-IDF's crosscore LL
      trigger/clear helpers use them, and their interrupt matrix maps
      at +0x13C..+0x148 route through the existing per-core output
      surface. Proven by hand-assembled dual-core firmware that maps
      FROM_CPU_INTR1 to APP CPU line 1, parks APP CPU in WAITI, has
      PRO CPU write SYSTEM_CPU_INTR_FROM_CPU_1_REG, then clears the
      latch in the APP CPU ISR and reports over UART. Cuts: no
      higher-level FreeRTOS yield/IPI scheduling semantics yet; this is
      the hardware delivery substrate
- [x] ESP32-S3 core slice 44 — RTC sleep timer wakeups
      (landed 2026-06-13): RTC_CNTL SLP_TIMER0/1, STATE0.SLEEP_EN,
      WAKEUP_STATE timer source bits, SLP_WAKEUP_CAUSE, INT_RAW/ST/ENA/
      CLR, INT_ENA_W1TS/W1TC, and the RTC_CORE interrupt-matrix source
      now provide the first sleep/wake substrate. Firmware can park in
      WAITI after arming the RTC main timer and wake through the normal
      level-1 interrupt path when RTC_TIMER_TRIG_EN fires. Proven by
      hand-assembled firmware that maps RTC_CORE to line 1, enables the
      MAIN_TIMER and SLP_WAKEUP raw sources, sets STATE0.SLEEP_EN, waits,
      clears the RTC raw bits in the ISR, and reports the timer wake
      cause over UART. Cuts: timer wake only; no wake-stub/deep-sleep
      reset behavior, clock/power-domain gating, or non-timer wake sources yet
- [x] ESP32-S3 core slice 45 — RWDT interrupt delivery through RTC_CORE
      (landed 2026-06-13): an RWDT stage configured with
      WDT_STAGE_ACTION_INT now latches RTC_CNTL_WDT_INT (bit 3), flows
      through RTC_CNTL INT_RAW/ST/ENA/CLR, and wakes the CPU through the
      RTC_CORE interrupt-matrix source. Proven by hand-assembled
      firmware that arms RWDT stage 0 as an interrupt, maps RTC_CORE to
      level-1 line 1, parks in WAITI, clears RTC_WDT in the ISR, feeds
      RWDT afterward, and reports that INT_ST is clear while the reset
      cause remains POWERON. Cuts: no SUPER_WDT, sleep-pause clock
      policy, XTAL clock source, or remaining RTC interrupt producers
      beyond COCPU yet
- [x] ESP32-S3 core slice 46 — RTC COCPU software interrupt delivery
      through RTC_CORE (landed 2026-06-13): RTC_CNTL_COCPU_CTRL now
      stores inert control fields and treats COCPU_SW_INT_TRIGGER
      (bit 26) as a write-only pulse that latches RTC_CNTL_COCPU_INT
      (bit 13), flows through RTC_CNTL INT_RAW/ST/ENA/CLR, and wakes
      the CPU through the RTC_CORE interrupt-matrix source. Proven by
      hand-assembled dual-core firmware that maps RTC_CORE to level-1
      line 1 on PRO CPU, parks PRO CPU in WAITI, has APP CPU write the
      COCPU trigger, clears COCPU raw in the PRO CPU ISR, and reports
      that INT_ST is clear. Cuts: no ULP/RISC-V coprocessor execution,
      COCPU_DONE/TRAP modeling, or remaining RTC producers like touch,
      SARADC RTC-domain, XTAL32K dead, and SUPER_WDT yet
- [x] ESP32-S3 core slice 47 — RTC brownout interrupt delivery through
      RTC_CORE (landed 2026-06-13): RTC_CNTL_BROWN_OUT_REG (+0xe8)
      now round-trips the brownout policy bits, exposes BROWN_OUT_DET
      as detector readback, treats CNT_CLR as write-only, and lets a
      host-injected brownout trip latch RTC_CNTL_BROWN_OUT_INT (bit 9)
      through RTC_CNTL INT_RAW/ST/ENA/CLR and the RTC_CORE interrupt-
      matrix source. Proven by hand-assembled firmware that maps
      RTC_CORE to level-1 line 1, enables the BROWN_OUT raw source,
      parks in WAITI, receives a host detector trip, clears BROWN_OUT
      raw in the ISR, and reports both detector readback and cleared
      INT_ST over UART. Cuts: no analog threshold modeling, delayed
      INT_WAIT/RST_WAIT timing, or remaining RTC producers like touch,
      SARADC RTC-domain, and SUPER_WDT yet
- [x] ESP32-S3 core slice 48 — RTC XTAL32K-dead interrupt and wake
      source through RTC_CORE (landed 2026-06-13): RTC_CNTL_EXT_XTL_CONF
      (+0x60) and XTAL32K_CONF (+0xf8) now round-trip the 32 kHz
      watchdog policy fields, XTAL32K_WDT_RESET is treated as a
      write-only pulse, and a host-injected 32 kHz clock-dead condition
      latches RTC_CNTL_XTAL32K_DEAD_INT (bit 16). If firmware is in
      RTC sleep with RTC_XTAL32K_DEAD_TRIG_EN armed, the same trip also
      records SLP_WAKEUP_CAUSE and wakes through RTC_CORE. Proven by
      hand-assembled firmware that enables the XTAL32K watchdog, maps
      RTC_CORE to level-1 line 1, enables XTAL32K_DEAD plus SLP_WAKEUP
      raw bits, enters sleep, receives a host dead-clock trip, clears
      both raw bits in the ISR, and reports the wake-cause bit plus
      cleared INT_ST over UART. Cuts: no oscillator-period measurement,
      auto-backup/restart/return behavior, WDT timeout counting, or
      remaining RTC producers like touch, SARADC RTC-domain, and
      SUPER_WDT yet
- [x] ESP32-S3 core slice 49 — RTC SUPER_WDT/SWD interrupt and reset
      delivery (landed 2026-06-13): RTC_CNTL_SWD_CONF (+0xb4) and
      SWD_WPROTECT (+0xb8) now round-trip the super-watchdog policy
      fields behind the documented SWD key, expose FEED_INT and
      RESET_FLAG as readback status, treat SWD_FEED and RST_FLAG_CLR as
      write-only pulses, and let a host-injected super-watchdog trip
      latch RTC_CNTL_SWD_INT (bit 15). If BYPASS_RST is clear, the trip
      also resets with ROM reset cause SUPER_WDT_RESET (18); if
      BYPASS_RST is set, it wakes through RTC_CORE like the other RTC
      interrupt producers. Proven by hand-assembled firmware that maps
      RTC_CORE to level-1 line 1, enables SWD raw delivery, parks in
      WAITI, reads FEED_INT after a host trip, feeds SWD to clear it,
      and separately verifies the reset-cause path. Cuts: no timed SWD
      countdown, auto-feed cadence, or remaining RTC producers like
      touch and SARADC RTC-domain yet
- [x] ESP32-S3 core slice 50 — RTC SARADC1/2 interrupt delivery through
      RTC_CORE (landed 2026-06-13): SENS_SAR_READER1_CTRL (+0x00) and
      SENS_SAR_READER2_CTRL (+0x24) now preserve their documented reset
      interrupt-enable bits, and RTC-domain SENS_SAR_MEAS1/2_CTRL2
      oneshot completions latch RTC_CNTL_SARADC1_INT (bit 11) or
      RTC_CNTL_SARADC2_INT (bit 14). Those raw bits flow through
      RTC_CNTL INT_RAW/ST/ENA/CLR and the RTC_CORE interrupt-matrix
      source. Proven by hand-assembled firmware that maps RTC_CORE to
      level-1 line 1, enables SARADC1 then SARADC2 raw delivery, starts
      each SENS RTC conversion, lets the RTC_CORE ISR clear the enabled
      raw source, and reports both MEASx_DONE_SAR and cleared INT_ST
      over UART. Cuts: no SAR threshold/sleep-policy modeling, no
      TSENS RTC interrupt path, and touch remains separate
- [x] ESP32-S3 core slice 51 — RTC TSENS interrupt delivery through
      RTC_CORE (landed 2026-06-13): SENS_SAR_TSENS_CTRL (+0x50) and
      TSENS_CTRL2 (+0x54) now round-trip the temperature-sensor control
      fields, TSENS_DUMP_OUT completes immediately with READY plus a
      stable raw output byte, and TSENS_INT_EN latches RTC_CNTL_TSENS_INT
      (bit 12). The raw bit flows through RTC_CNTL INT_RAW/ST/ENA/CLR
      and the RTC_CORE interrupt-matrix source. Proven by hand-assembled
      firmware that maps RTC_CORE to level-1 line 1, enables TSENS raw
      delivery, writes the LL-style TSENS_DUMP_OUT control value, lets
      the RTC_CORE ISR clear TSENS raw, and reports READY, raw output,
      and cleared INT_ST over UART. Cuts: no calibrated temperature
      conversion, I2C SAR DAC range modeling, or touch RTC producer path
- [x] ESP32-S3 core slice 52 — RTC touch one-shot done/scan/active
      delivery through RTC_CORE (landed 2026-06-13): RTC touch control
      registers TOUCH_CTRL1/2, SCAN_CTRL, SLP_THRES, APPROACH, FILTER,
      TIMEOUT, and DAC/DAC1 now round-trip enough for touch LL setup;
      SENS touch config, thresholds, channel status, and pad-status
      reads expose a deterministic software-triggered scan. A
      TOUCH_START_EN one-shot latches measurement-done, scan-done, and
      threshold-driven active RTC raw bits, which flow through
      RTC_CNTL INT_RAW/ST/ENA/CLR and RTC_CORE. Proven by hand-assembled
      firmware that maps RTC_CORE to level-1 line 1, enables touch
      done/scan/active raw delivery, scans pad 1, clears the ISR-seen
      bits, and reports MEAS_DONE, stable pad data, and cleared INT_ST
      over UART. Cuts: no capacitive physics, debounce/filter math,
      proximity loop, timeout producer, or full touch sleep/deep-sleep
      wake policy
- [x] ESP32-S3 core slice 53 — RTC touch one-shot wake source
      recording (landed 2026-06-13): touch one-shot scans now call the
      existing RTC wake-source latch, so when STATE0.SLEEP_EN is set and
      WAKEUP_STATE arms RTC_TOUCH_TRIG_EN, the scan clears sleep,
      records SLP_WAKEUP_CAUSE bit 8, latches SLP_WAKEUP_INT, and wakes
      through RTC_CORE alongside the touch done/scan/active interrupt
      bits. Proven by hand-assembled firmware that arms touch wake,
      enters RTC sleep, triggers TOUCH_START_EN with interrupts masked
      until WAITI(0), lets the RTC_CORE ISR clear touch/SLP_WAKEUP raw,
      and reports TOUCH_TRIG_EN plus cleared INT_ST over UART. Cuts:
      still no capacitive physics, full touch deep-sleep pad policy,
      proximity loop, timeout producer, or debounce/filter math
- [x] ESP32-S3 core slice 54 — synthetic ULP WAKE interrupt and sleep
      wake source (landed 2026-06-13): RTC ULP timer/control registers
      ULP_CP_TIMER (+0xfc), ULP_CP_CTRL (+0x100), and ULP_CP_TIMER_1
      (+0x134) now round-trip enough for ULP setup, and ULP_CP_START_TOP
      or ULP_CP_FORCE_START_TOP acts as a deterministic ULP WAKE
      producer. It latches RTC_CNTL_ULP_CP_INT (bit 5), records
      SLP_WAKEUP_CAUSE bit 9 when WAKEUP_STATE arms RTC_ULP_TRIG_EN, and
      wakes through RTC_CORE. Proven by hand-assembled firmware that arms
      ULP wake, enters RTC sleep, writes FORCE_START_TOP with interrupts
      masked until WAITI(0), lets the RTC_CORE ISR clear ULP/SLP_WAKEUP
      raw, and reports ULP_TRIG_EN plus cleared INT_ST over UART. Cuts:
      no real ULP instruction execution, ULP memory model, GPIO wake,
      timer-period scheduling, or COCPU trap path
- [x] ESP32-S3 core slice 55 — COCPU software interrupt sleep wake
      source (landed 2026-06-13): the existing COCPU_SW_INT_TRIGGER
      path now also calls the RTC wake-source latch, so when RTC sleep is
      active and WAKEUP_STATE arms RTC_COCPU_TRIG_EN, the software
      interrupt clears sleep, records SLP_WAKEUP_CAUSE bit 11, latches
      SLP_WAKEUP_INT, and wakes through RTC_CORE alongside
      RTC_CNTL_COCPU_INT. Proven by hand-assembled firmware that arms
      COCPU wake, enters RTC sleep, writes COCPU_SW_INT_TRIGGER with
      interrupts masked until WAITI(0), lets the RTC_CORE ISR clear
      COCPU/SLP_WAKEUP raw, and reports COCPU_TRIG_EN plus cleared
      INT_ST over UART. Cuts: no real COCPU execution, COCPU_DONE state
      machine, trap/debug flow, or COCPU_TRAP_TRIG_EN path
- [x] ESP32-S3 core slice 56 — COCPU trap/debug sleep wake source
      (landed 2026-06-13): SENS_SAR_COCPU_STATE (+0xe4) now treats
      SENS_COCPU_DBG_TRIGGER as a write-only synthetic trap producer,
      exposes sticky SENS_COCPU_TRAP readback, latches
      RTC_CNTL_COCPU_TRAP_INT (bit 17), and wakes RTC sleep through
      RTC_COCPU_TRAP_TRIG_EN (bit 13) when armed. Proven by
      hand-assembled firmware that arms COCPU_TRAP wake, enters RTC
      sleep, writes DBG_TRIGGER with interrupts masked until WAITI(0),
      lets the RTC_CORE ISR clear COCPU_TRAP/SLP_WAKEUP raw, and reports
      COCPU_TRAP_TRIG_EN, trap-state readback, and cleared INT_ST over
      UART. Cuts: no real COCPU execution, COCPU_DONE state machine,
      EBREAK/EOI/debug-PC modeling, or trap clear semantics beyond reset
- [x] ESP32-S3 core slice 57 — touch timeout RTC interrupt producer
      (landed 2026-06-13): RTC_TOUCH_TIMEOUT_CTRL now participates in
      synthetic touch scans: if TIMEOUT_EN is set and TIMEOUT_NUM is a
      small nonzero budget below the modeled measurement cost, the scan
      latches RTC_CNTL_TOUCH_TIMEOUT_INT (bit 18). Proven by
      hand-assembled firmware that maps RTC_CORE, enables only
      TOUCH_TIMEOUT, sets a one-cycle timeout threshold, triggers
      TOUCH_START_EN, waits for the RTC_CORE ISR to clear timeout raw,
      and reports dispatch plus cleared INT_ST over UART. Cuts: no
      cycle-accurate capacitive timing, timeout side effects beyond the
      raw interrupt, or proximity-loop counter/status modeling
- [x] ESP32-S3 core slice 58 — touch proximity loop-done RTC producer
      (landed 2026-06-13): SENS_TOUCH_APPROACH_PAD0..2 configuration,
      SENS_SAR_TOUCH_APPR_STATUS readback, and TOUCH_APPROACH_MEAS_TIME
      now model deterministic proximity scan counts. A synthetic touch
      scan of a configured proximity pad increments the matching count
      and latches RTC_CNTL_TOUCH_APPROACH_LOOP_DONE_INT (bit 20) once
      the configured total scan count is reached. Proven by
      hand-assembled firmware that maps approach pad0 to touch channel
      1, sets total scans to one, enables only proximity-loop done,
      triggers TOUCH_START_EN, lets the RTC_CORE ISR clear proximity raw,
      and reports dispatch, approach count, and cleared INT_ST over
      UART. Cuts: no capacitive accumulation math, sleep-pad proximity
      count behavior, debounce/smooth data, or proximity count rollover
- [x] ESP32-S3 core slice 59 — ULP timer-period sleep wake source
      (landed 2026-06-13): RTC_CNTL_ULP_CP_TIMER.ULP_CP_SLP_TIMER_EN
      now arms a virtual RTC-slow-clock ULP timer, and
      ULP_CP_TIMER_1.SLP_CYCLE controls its period like ESP-IDF
      `ulp_set_wakeup_period()` / `ulp_run()`. Each expiry produces the
      existing synthetic ULP WAKE, latching RTC_CNTL_ULP_CP_INT and
      recording RTC_ULP_TRIG_EN as the sleep wake source when armed.
      Proven by hand-assembled firmware that maps RTC_CORE, arms ULP
      wake, sets a one-slow-clock period, enters RTC sleep, waits for
      the timer, clears ULP/SLP_WAKEUP raw in the ISR, stops the timer,
      and reports ULP_TRIG_EN plus cleared INT_ST over UART. Cuts: no
      real ULP instruction execution, ULP memory model, GPIO wake, or
      COCPU_DONE state machine
- [x] ESP32-S3 core slice 60 — RTC low-power status for ULP WAKE
      polling (landed 2026-06-13): RTC_CNTL_LOW_POWER_ST now exposes
      MAIN_STATE_IN_IDLE while the modeled main CPU is awake, and
      MAIN_STATE_IN_SLP plus RDY_FOR_WAKEUP after STATE0.SLEEP_EN.
      This gives future ULP WAKE instruction work truthful status bits
      for the exact polling pattern in Espressif's ULP examples. Proven
      by hand-assembled firmware that reads LOW_POWER_ST before and
      after entering RTC sleep and reports the expected idle/sleep/
      ready bit pattern over UART. Cuts: no full RTC power-state
      sequencer, wait-for-XTAL/PLL/8M substates, or COCPU state bits yet
- [x] ESP32-S3 core slice 61 — COCPU_DONE low-power status bits
      (landed 2026-06-13): RTC_CNTL_COCPU_CTRL writes that set
      COCPU_DONE plus COCPU_SHUT_RESET_EN now reflect through
      RTC_CNTL_LOW_POWER_ST as COCPU_STATE_DONE and COCPU_STATE_SLP,
      matching the status side of ESP-IDF's ULP RISC-V halt/reset
      helpers. Proven by hand-assembled firmware that writes the halt
      control bits, reads LOW_POWER_ST, reports the done/sleep bitmap,
      clears the bits, and verifies the status clears. Cuts: no real
      ULP RISC-V instruction execution, monitor state, COCPU start/
      switch timing, or debug-PC/EOI behavior
- [x] ESP32-S3 core slice 62 — ULP GPIO wake control readback
      (landed 2026-06-13): RTC_CNTL_ULP_CP_TIMER now preserves the
      documented GPIO_WAKEUP_ENA bit and PC_INIT field while treating
      GPIO_WAKEUP_CLR as a write-only pulse, matching Espressif's
      register policy and `ulp_riscv_config_wakeup_source(GPIO)` setup
      path. Proven by hand-assembled firmware that writes ENA plus the
      WO clear pulse, reads ULP_CP_TIMER back, reports that bit29 is set
      while bit30 is clear, and verifies the PC_INIT low byte survives.
      Cuts: no real RTC GPIO edge/level wake routing or GPIO wake-status
      latch yet
- [x] ESP32-S3 core slice 63 — COCPU_CTRL reset field fidelity
      (landed 2026-06-13): RTC_CNTL_COCPU_CTRL now resets with the
      documented COCPU_SEL bit plus SHUT_2_CLK_DIS, START_2_INTR_EN,
      and START_2_RESET_DIS timing defaults instead of zeroing the
      whole register. This keeps ESP-IDF-style read/modify/write helpers
      from accidentally losing the reset policy while setting COCPU
      control pulses. Proven by hand-assembled firmware that reads
      COCPU_CTRL at reset and reports START_2_RESET_DIS, START_2_INTR_EN,
      SHUT_2_CLK_DIS, and COCPU_SEL over UART. Cuts: no real COCPU
      timing/state sequencer, clock-gate timing, or reset-delay behavior
- [x] ESP32-S3 core slice 64 — ULP_CP_CTRL force-start readback
      fidelity (landed 2026-06-13): RTC_CNTL_ULP_CP_CTRL readback now
      preserves the documented FORCE_START_TOP and CLK_FO R/W bits while
      continuing to treat MEM_OFFST_CLR as a write-only pulse. This
      keeps ULP setup helpers from seeing a false cleared force-start/
      clock-force policy after read/modify/write flows. Proven by
      hand-assembled firmware that writes FORCE_START_TOP, CLK_FO, and
      MEM_OFFST_CLR, reads the register back, reports the expected
      high-bit bitmap, and verifies MEM_OFFST_CLR reads as zero. Cuts:
      no real ULP instruction execution, memory offset behavior, or
      coprocessor clock-state sequencing
- [x] ESP32-S3 core slice 65 — ULP wake-main software pulse
      (landed 2026-06-13): RTC_CNTL_STATE0.SW_CPU_INT now acts as the
      ULP wake-main pulse used by Espressif's
      `ulp_riscv_wakeup_main_processor()`, reusing the modeled ULP wake
      path so RTC_ULP_TRIG_EN records the wake source and RTC_CORE can
      wake WAITI when ULP and SLP_WAKEUP interrupts are enabled. Proven
      by hand-assembled firmware that enters RTC sleep, performs the
      same read/modify/write style STATE0.SW_CPU_INT pulse used by
      SET_PERI_REG_MASK, clears ULP/SLP_WAKEUP raw in the ISR, and
      reports ULP_TRIG_EN plus cleared INT_ST over UART. Cuts: no real
      ULP RISC-V instruction execution or separate SW_CPU_INT raw source
- [x] ESP32-S3 core slice 66 — RTC INT_RAW write policy
      (landed 2026-06-13): RTC_CNTL_INT_RAW writes now only affect the
      documented TOUCH_APPROACH_LOOP_DONE_INT_RAW R/W bit, while
      producer-owned raw bits such as ULP_CP and SLP_WAKEUP remain
      read-only latches. Proven by hand-assembled firmware that writes a
      mix of R/W and RO raw bits, reads back only the approach bit,
      verifies the low RO bits did not latch, then clears the approach
      raw bit with a zero write. Cuts: no GLITCH_DET producer or new
      interrupt sources
- [x] ESP32-S3 core slice 67 — RTC power-glitch interrupt producer
      (landed 2026-06-14): RTC_CNTL_PG_CTRL now stores
      POWER_GLITCH_EN and a host-injected power-glitch detector trip
      latches RTC_CNTL_GLITCH_DET_INT (bit 19), flowing through
      RTC_CNTL INT_RAW/ST/ENA/CLR and the RTC_CORE interrupt-matrix
      source. Proven by hand-assembled firmware that enables
      PG_CTRL.POWER_GLITCH_EN, parks in WAITI, observes RTC_CORE
      dispatch on the injected trip, verifies the enable bit
      round-trips, and confirms INT_ST is clear after the ISR. Cuts:
      no analog power-glitch model and no GLITCH_RTC_RESET or
      POWER_GLITCH_RESET reset-cause behavior yet
- [x] ESP32-S3 core slice 68 — RTC FIB_SEL register fidelity
      (landed 2026-06-14): RTC_CNTL_FIB_SEL now resets to the
      documented three-bit value 7, round-trips the selector field, and
      masks writes so only bits [2:0] stick. Proven by hand-assembled
      firmware that reads reset state, writes selector 2, then writes
      0xff and observes readback 7 instead of fabricated high bits.
      Cuts: no eFuse strap/source-selection routing model yet
- [x] ESP32-S3 core slice 69 — RTC light-sleep reject source
      (landed 2026-06-14): RTC_CNTL_SLP_REJECT_CONF now stores
      LIGHT_SLP_REJECT_EN plus SLEEP_REJECT_ENA, and a host-injected
      reject source blocks modeled STATE0.SLEEP_EN, latches
      STATE0.SLP_REJECT, records SLP_REJECT_CAUSE, and routes
      RTC_CNTL_SLP_REJECT_INT through RTC_CORE. Proven by
      hand-assembled firmware that enables GPIO reject, attempts sleep,
      wakes through the RTC_CORE ISR, reports SLP_REJECT plus GPIO
      cause, verifies SLEEP_EN did not stick, then clears the cause.
      Cuts: GPIO/SDIO hardware reject detection only via host hook; no
      deep-sleep reject sequencing yet
- [x] ESP32-S3 core slice 70 — RTC SDIO-idle wake source
      (landed 2026-06-14): host-injected SDIO idle now latches
      RTC_CNTL_SDIO_IDLE_INT (bit 2), routes through RTC_CNTL
      INT_RAW/ST/ENA/CLR and RTC_CORE, and wakes modeled light sleep
      when WAKEUP_STATE arms RTC_SDIO_TRIG_EN. Proven by
      hand-assembled firmware that enables SDIO_IDLE plus SLP_WAKEUP,
      enters sleep, takes the RTC_CORE ISR after host SDIO-idle
      injection, reports RTC_SDIO_TRIG_EN as SLP_WAKEUP_CAUSE, and
      confirms INT_ST is clear. Cuts: no SDIO slave peripheral model or
      real SDIO host bus timing yet
- [x] ESP32-S3 core slice 71 — UART0 RX light-sleep wake source
      (landed 2026-06-14): host-injected UART0 RX bytes now wake
      modeled light sleep when WAKEUP_STATE arms RTC_UART0_TRIG_EN,
      latching SLP_WAKEUP_CAUSE through the existing RTC_CORE path while
      leaving the received byte available in UART0 FIFO. Proven by
      hand-assembled firmware that enables SLP_WAKEUP, sleeps with
      UART0 wake armed, receives a host byte, reports RTC_UART0_TRIG_EN,
      reads back the byte, and confirms INT_ST is clear after the ISR.
      Cuts: no UART1 wake source, wake threshold counter, or baud-edge
      timing yet
- [x] ESP32-S3 core slice 72 — GPIO level light-sleep wake source
      (landed 2026-06-14): GPIO_PINn.WAKEUP_ENABLE now combines with
      low/high-level INT_TYPE to wake modeled light sleep when
      WAKEUP_STATE arms RTC_GPIO_TRIG_EN. Proven by hand-assembled
      firmware that configures GPIO7 high-level wake, enters sleep,
      receives a host IO7 high level, reports RTC_GPIO_TRIG_EN as
      SLP_WAKEUP_CAUSE, and confirms INT_ST is clear after the ISR.
      Cuts: no deep-sleep EXT0/EXT1 RTC-IO path or GPIO wake-status
      register surface yet
- [x] ESP32-S3 core slice 73 — EXT1 RTC GPIO wake source
      (landed 2026-06-14): RTC_CNTL_EXT_WAKEUP_CONF now stores
      EXT_WAKEUP1_LV, EXT_WAKEUP1_SEL tracks the RTC GPIO0..21 mask,
      and EXT_WAKEUP1_STATUS records the selected RTC IOs that woke
      modeled sleep when WAKEUP_STATE arms RTC_EXT1_TRIG_EN. Proven by
      hand-assembled firmware that selects RTC GPIO7, sets any-high
      EXT1 wake, receives a host IO7 high level, reports
      RTC_EXT1_TRIG_EN plus EXT_WAKEUP1_STATUS bit 7, clears status,
      and confirms INT_ST is clear after the ISR. Cuts: no EXT0 single
      RTC-IO wake selector or real deep-sleep reset/wake-stub behavior yet
- [x] ESP32-S3 core slice 74 — EXT0 RTC IO wake source
      (landed 2026-06-15): RTC_IO_EXT_WAKEUP0_SEL now stores the
      selected single RTC GPIO0..21, RTC_CNTL_EXT_WAKEUP_CONF stores
      EXT_WAKEUP0_LV, and host pin changes wake modeled sleep when
      WAKEUP_STATE arms RTC_EXT0_TRIG_EN. Proven by hand-assembled
      firmware that selects RTC GPIO7, sets high-level EXT0 wake,
      receives a host IO7 high level, reports RTC_EXT0_TRIG_EN,
      confirms the RTC_IO selector round-trips as GPIO7, and confirms
      INT_ST is clear after the ISR. Cuts: no RTC_IO pad function/input
      enable side effects or real deep-sleep reset/wake-stub behavior yet
- [x] ESP32-S3 core slice 75 — UART1 RX light-sleep wake source
      (landed 2026-06-15): UART1 now has the same modeled register
      subset as UART0 — FIFO, STATUS, INT_RAW/ST/ENA/CLR, CONF1, and
      its own interrupt-matrix map at +0x070. ESP32-S3-specific
      `uartWriteTo(1, byte)` feeds the UART1 RX FIFO, records
      RTC_UART1_TRIG_EN when WAKEUP_STATE arms it, and leaves the
      received byte readable after the RTC_CORE ISR wakes WAITI.
      Proven by hand-assembled firmware that enters modeled sleep,
      receives a host UART1 byte, reports RTC_UART1_TRIG_EN plus that
      byte over UART0, and confirms INT_ST is clear after the ISR.
      Cuts: no UART2 wake source, wake threshold counter, baud-edge
      accounting, or full UART driver surface yet
- [x] ESP32-S3 core slice 76 — UART light-sleep wake edge threshold
      (landed 2026-06-16): UART0/1 now expose
      UART_SLEEP_CONF.ACTIVE_THRESHOLD at +0x38, latch UART_WAKEUP_INT
      bit 19, count modeled 8N1 positive RX edges while RTC UART wake
      is armed, and drop the pre-wake/triggering byte so post-wake data
      must be sent separately like ESP-IDF documents. Proven by
      hand-assembled firmware for both UART0 and UART1 that sets the
      public wake threshold to three positive edges, wakes on 0x61,
      reports FIFO count 0, verifies UART_WAKEUP_INT latches and clears,
      then receives a separate post-wake byte. Cuts: no UART2 RTC wake
      source, baud/parity/configurable frame accounting, or full UART
      driver surface yet
- [x] ESP32-S3 core slice 77 — UART frame-config wake edge accounting
      (landed 2026-06-16): UART0/1 now expose UART_CONF0 at +0x20 with
      the ESP32-S3 reset frame (8N1), preserve firmware writes, and use
      UART_BIT_NUM plus UART_PARITY/PARITY_EN when counting RX positive
      edges for light-sleep UART wake. Stop-bit modes are represented
      as the single high transition that can contribute an edge, so
      extra high stop time cannot double-count. Proven by
      hand-assembled firmware that configures UART0 to 7N1, sets the
      public wake threshold to three positive edges, confirms two 0x40
      bytes remain below threshold, wakes on the third, reports FIFO
      count 0, then receives a separate post-wake byte. Cuts: no UART2
      RTC wake source, baud-rate sampling/noise/framing error behavior,
      or full UART driver surface yet
- [x] ESP32-S3 core slice 78 — UART2 register and interrupt runway
      (landed 2026-06-16): the third ESP32-S3 UART now has the same
      basic active-mode register substrate as UART0/1: FIFO, STATUS,
      INT_RAW/ST/ENA/CLR, CONF0, CONF1, SLEEP_CONF round-trip, TX_DONE,
      RXFIFO_FULL, and its own interrupt-matrix source at +0x074.
      `uartWriteTo(2, byte)` feeds UART2 RX while UART0 remains the
      test reporting channel. Proven by hand-assembled firmware that
      maps UART2 RXFIFO_FULL to CPU line 1, receives a host byte on
      UART2, drains that FIFO in the ISR, and reports the byte over
      UART0. Cuts: no UART2 RTC sleep-wake plumbing in this slice,
      baud-rate sampling/noise/framing error behavior, or full UART
      driver surface yet
- [x] ESP32-S3 core slice 79 — touch sleep proximity count status
      (landed 2026-06-16): the modeled touch scanner now increments
      SENS_SAR_TOUCH_APPR_STATUS.TOUCH_SLP_APPROACH_CNT when
      RTC_TOUCH_SLP_THRES selects the scanned sleep pad and enables
      sleep proximity. The count shares TOUCH_APPROACH_MEAS_TIME with
      normal proximity pads and latches TOUCH_APPROACH_LOOP_DONE only
      once the configured total is reached. Proven by hand-assembled
      firmware that configures sleep pad 1 for proximity, performs two
      synthetic scans, reports sleep-count values 1 then 2, and proves
      the loop-done raw bit stays clear before the second scan then
      latches after it. Cuts: no capacitive accumulation math,
      debounce/smooth sleep-pad data, or real deep-sleep touch policy
      yet
- [x] ESP32-S3 core slice 80 — touch sleep-pad status data readback
      (landed 2026-06-16): SENS_SAR_TOUCH_SLP_STATUS (+0xdc) now
      returns the modeled data for the pad selected by
      RTC_TOUCH_SLP_THRES.TOUCH_SLP_PAD, matching the register surface
      used by ESP-IDF sleep benchmark/smooth reads. Proven by
      hand-assembled firmware that selects sleep pad 1, confirms the
      sleep status data is zero before a scan, starts a pad-1 scan, and
      reads back the modeled 2048 count through SLP_STATUS. Cuts: no
      debounce/smooth filtering math, raw sleep-pad workaround routing,
      or real deep-sleep touch policy yet
- [x] ESP32-S3 core slice 81 — touch sleep raw-data workaround routing
      (landed 2026-06-16): SENS_SAR_TOUCH_SLP_STATUS now models the
      ESP-IDF LL split between benchmark/smooth sleep reads and raw
      sleep-pad reads: raw mode leaves SLP_STATUS empty, while the raw
      value remains available through SENS.sar_touch_status[touch_num -
      1]. Proven by hand-assembled firmware that selects sleep pad 1,
      scans pad 1, confirms SLP_STATUS stays zero in raw mode, then
      reads the modeled 2048 count from SENS_SAR_TOUCH_STATUS1 (+0xa4).
      Cuts: no debounce/smooth filtering math or real deep-sleep touch
      policy yet
- [x] ESP32-S3 core slice 82 — touch sleep debounce and smooth status
      (landed 2026-06-16): SENS_SAR_TOUCH_STATUS1..14 and
      SENS_SAR_TOUCH_SLP_STATUS now expose a modeled 3-bit debounce
      count in bits [31:29], and sleep smooth reads share the same
      modeled SLP_STATUS data path as benchmark reads. Proven by
      hand-assembled firmware that selects sleep pad 1, reads zero
      before scan, scans pad 1, reads benchmark and smooth data through
      SLP_STATUS, and reads TOUCH_SLP_DEBOUNCE as 1. Cuts: debounce is
      a simple saturating sample count, not the full hardware filter
      algorithm; no real deep-sleep touch policy yet
- [x] ESP32-S3 core slice 83 — touch sleep timer wakes RTC sleep
      (landed 2026-06-16): entering modeled RTC sleep with
      RTC_TOUCH_SLP_TIMER_EN already armed now runs one touch sleep-timer
      measurement through the existing touch interrupt/wake path when
      RTC_TOUCH_TRIG_EN is enabled. Proven by hand-assembled firmware
      that arms the repeated touch timer before sleep, clears the
      pre-sleep timer-start sample, enters sleep with the touch wake
      source enabled, then reads TOUCH_TRIG_EN from SLP_WAKEUP_CAUSE and
      fresh pad-1 data/debounce from SENS_SAR_TOUCH_STATUS1. Cuts: this
      is a single sleep-entry timer sample, not repeated interval timing,
      full deep-sleep reset behavior, or RTC power-domain policy
- [x] ESP32-S3 core slice 84 — touch sleep timer interval scheduling
      (landed 2026-06-16): RTC_TOUCH_SLP_TIMER_EN now runs as a
      repeated RTC-slow-clock producer keyed off
      RTC_CNTL_TOUCH_CTRL1.TOUCH_SLEEP_CYCLES instead of only a
      sleep-entry shortcut. The same synthetic touch measurement path
      still owns RTC touch interrupts, sleep wake-source recording, and
      sleep-pad status/debounce updates. Proven by hand-assembled
      firmware that arms the repeated touch timer, clears the pre-sleep
      sample, enters RTC sleep with RTC_TOUCH_TRIG_EN enabled, observes
      no UART before the programmed interval, then wakes and reports
      TOUCH_TRIG_EN plus fresh pad-1 data/debounce. Cuts: no full
      capacitive physics, deep-sleep reset/wake-stub policy, or RTC
      power-domain policy yet
- [x] ESP32-S3 core slice 85 — brownout analog reset via FIB_SEL
      (landed 2026-06-16): RTC_CNTL_FIB_SEL now participates in the
      brownout reset path the way ESP-IDF's brownout LL uses it:
      firmware can clear FIB_BOD_RST, set BROWN_OUT_ANA_RST_EN, and a
      host-injected brownout trip resets with the ROM brownout cause
      (15) even when BROWN_OUT_RST_ENA is not set. The interrupt-only
      brownout path remains intact. Proven by hand-assembled firmware
      that first reports POWERON, configures software-owned BOD analog
      reset, receives a host brownout trip, reboots, and reports reset
      cause 15. Cuts: no analog voltage threshold/counter timing model
      and no delayed BROWN_OUT_INT_WAIT/RST_WAIT sequencing yet
- [x] ESP32-S3 core slice 86 — power-glitch reset via FIB_SEL
      (landed 2026-06-16): RTC_CNTL_PG_CTRL POWER_GLITCH_EN still
      supports the interrupt-only detector path by default, and
      RTC_CNTL_FIB_SEL now gates software-owned glitch reset routing:
      firmware can clear FIB_GLITCH_RST, enable POWER_GLITCH_EN, and a
      host-injected power-glitch trip resets with the ROM power-glitch
      cause (23). Proven by hand-assembled firmware that first reports
      POWERON, configures software-owned glitch reset, receives a host
      power-glitch trip, reboots, and reports reset cause 23. Cuts: no
      analog glitch model yet
- [x] ESP32-S3 core slice 87 — clock-glitch reset via ANA_CONF/FIB_SEL
      (landed 2026-06-16): RTC_CNTL_ANA_CONF now round-trips its
      documented reset defaults plus GLITCH_RST_EN, and host-injected
      clock-glitch trips reset through the software-owned FIB_GLITCH_RST
      route with ROM reset cause GLITCH_RTC_RESET (19). Proven by
      hand-assembled firmware that first reports POWERON, clears
      FIB_GLITCH_RST, enables ANA_CONF.GLITCH_RST_EN, receives a host
      clock-glitch trip, reboots, and reports reset cause 19. Cuts: no
      analog glitch waveform/timing model and no eFuse strap routing
      model yet
- [x] ESP32-S3 core slice 88 — SUPER_WDT reset via FIB_SEL
      (landed 2026-06-16): RTC_CNTL_FIB_SEL now also gates the
      software-owned super-watchdog reset route: a host-injected
      SUPER_WDT trip still latches SWD_FEED_INT/RESET_FLAG and
      RTC_CNTL_SWD_INT, but it only resets with ROM cause
      SUPER_WDT_RESET (18) when firmware leaves SWD_BYPASS_RST clear
      and clears FIB_SUPER_WDT_RST. Proven by hand-assembled firmware
      that first shows the default FIB selector prevents a reset, then
      clears FIB_SUPER_WDT_RST, receives a host SUPER_WDT trip, reboots,
      and reports reset cause 18. Cuts: no timed SWD countdown,
      auto-feed cadence, sleep-pause behavior, or eFuse strap routing
      model yet
- [x] ESP32-S3 core slice 89 — power-glitch eFuse enable selector
      (landed 2026-06-16): RTC_CNTL_PG_CTRL.POWER_GLITCH_EFUSE_SEL now
      switches the modeled power-glitch detector enable source from the
      PG_CTRL POWER_GLITCH_EN bit to BLOCK0 EFUSE_POWERGLITCH_EN
      (RD_REPEAT_DATA4 bit 30), while FIB_GLITCH_RST still gates the
      software-owned reset route. Proven by hand-assembled firmware
      that first selects eFuse control with the fuse clear and observes
      no reboot, then burns EFUSE_POWERGLITCH_EN, selects eFuse control,
      receives a host power-glitch trip, reboots, and reports ROM cause
      POWER_GLITCH_RESET (23). Cuts: no analog glitch waveform/timing
      model and no POWER_GLITCH_DSENSE timing behavior yet
- [x] ESP32-S3 core slice 90 — RWDT pause-in-sleep behavior (landed
      2026-06-16): RTC_CNTL_WDTCONFIG0.PAUSE_IN_SLP now freezes the
      modeled RTC watchdog timeout while RTC sleep is active, preserving
      pre-sleep elapsed time and resuming after the RTC wake source
      clears sleep. Proven by hand-assembled firmware that arms a
      two-RTC-slow-tick RWDT reset, sleeps until RTC timer tick 10,
      wakes through RTC_CORE, disarms RWDT, and reports the wake cause
      plus unchanged POWERON reset cause. Cuts: mixed-source elapsed
      accounting is still approximate if firmware changes RTC_SLOW_CLK
      while timers are already running
- [x] ESP32-S3 core slice 91 — RWDT stage-0 eFuse timeout multiplier
      (landed 2026-06-16): RWDT stage 0 now applies the ESP32-S3
      implicit timeout multiplier selected by BLOCK0 WDT_DELAY_SEL, so
      IDF's `rwdt_ll_config_stage()` `timeout_ticks >> 1` register write
      ages like hardware. Proven by hand-assembled firmware for the
      default x2 path and a burned WDT_DELAY_SEL=2 x8 path, both using a
      raw WDTCONFIG1 value of 1 before resetting with RTCWDT_SYS_RESET.
      Cuts: mixed-source elapsed accounting is still approximate if
      firmware changes RTC_SLOW_CLK while timers are already running
- [x] ESP32-S3 core slice 92 — clock-glitch interrupt producer
      (landed 2026-06-16): a host-injected clock-glitch trip now latches
      RTC_CNTL_GLITCH_DET_INT (bit 19) when ANA_CONF.GLITCH_RST_EN is
      armed, flowing through RTC_CORE even when FIB_SEL leaves the reset
      path hardware-owned. Proven by hand-assembled firmware that enables
      GLITCH_DET, parks in WAITI, receives the injected clock glitch,
      clears GLITCH_DET in the ISR, and reports clear INT_ST afterward.
      Cuts: still no analog glitch waveform/timing model or eFuse strap
      routing model
- [x] ESP32-S3 core slice 93 — RWDT RTC slow-clock source selection
      (landed 2026-06-16): RTC_CNTL_CLK_CONF.ANA_CLK_RTC_SEL now
      round-trips and drives the RTC_SLOW_CLK tick rate used by RWDT
      and the RTC main timer, covering RC_SLOW, XTAL32K, and
      RC_FAST_D256 approximations from Espressif's clock-tree headers.
      Proven by hand-assembled firmware that selects XTAL32K before
      arming a raw RWDT stage0=1 timeout, survives beyond the old
      RC_SLOW x2 deadline, then later reboots with RTCWDT_SYS_RESET.
      Follow-up: live elapsed rebase across RTC_SLOW_CLK changes is
      covered by slice 95
- [x] ESP32-S3 core slice 94 — RC_SLOW divider for RTC slow clock
      (landed 2026-06-16): RTC_CNTL_SLOW_CLK_CONF.ANA_CLK_DIV now
      updates the modeled RC_SLOW divider when ANA_CLK_DIV_VLD is set,
      matching `clk_ll_rc_slow_set_divider(divider)`'s register+1
      contract. Proven by hand-assembled firmware that divides RC_SLOW
      by 4 before arming a raw RWDT stage0=1 timeout, survives beyond
      the undivided RC_SLOW x2 deadline, then later reboots with
      RTCWDT_SYS_RESET. Follow-up: live elapsed rebase across divider
      changes is covered by slice 95
- [x] ESP32-S3 core slice 95 — RTC slow-clock elapsed rebase
      (landed 2026-06-16): RTC main-timer ticks and RWDT elapsed
      ticks now carry forward when firmware writes RTC_CNTL_CLK_CONF
      or RTC_CNTL_SLOW_CLK_CONF, so changing the RTC_SLOW_CLK source
      or RC_SLOW divider affects only future time instead of
      reinterpreting the past. Proven by hand-assembled firmware that
      latches the RTC timer after 1 ms, switches to XTAL32K without
      moving backward, then keeps aging on the new source; and by an
      RWDT proof that ages one RC_SLOW tick, switches to XTAL32K
      mid-timeout, and still resets after the remaining tick with
      RTCWDT_SYS_RESET. Cut: sub-tick oscillator phase remains
      integer-rounded
- [x] ESP32-S3 core slice 96 — WiFi/BT light-sleep wake source bits
      (landed 2026-06-16): host-injected WiFi and BT wake events now
      record RTC_WIFI_TRIG_EN / RTC_BT_TRIG_EN through
      SLP_WAKEUP_CAUSE and wake modeled light sleep through RTC_CORE
      when WAKEUP_STATE arms them. Proven by hand-assembled firmware
      that enters RTC sleep twice, injects WiFi then BT, confirms the
      selected wake-cause bit was recorded, and confirms INT_ST is clear
      after the RTC_CORE ISR. Cut: no WiFi/Bluetooth MAC, PHY,
      coexistence, or host-controller model yet
- [x] ESP32-S3 core slice 97 — PCNT pulse-counter first cut
      (landed 2026-06-16): PCNT now has a source-pinned ESP32-S3
      register block at 0x60017000, GPIO input-matrix pulse/control
      signals 33..48, signed 16-bit count readback, reset/pause
      control, edge increment/decrement/hold actions, level-control
      keep/invert/hold behavior, high/low/threshold/zero status latches,
      and the PCNT interrupt-matrix source at +0x0A4. Proven by
      hand-assembled firmware that routes IO4 into PCNT unit 0, counts
      three rising edges, latches/clears the high-limit interrupt, and
      separately verifies low control-level inversion makes a rising
      edge decrement. Cuts: no APB-cycle glitch filter timing, no
      full quadrature helper path yet, no PCNT power/clock gating effect
- [x] ESP32-S3 core slice 98 — I2C master command/FIFO first cut
      (landed 2026-06-16): I2C0/I2C1 now have source-pinned ESP32-S3
      register blocks at 0x60013000/0x60027000, FIFO DATA access,
      command-register execution for START/WRITE/READ/STOP/END, status
      RX/TX FIFO count readback, command-done bits, transaction-complete
      and NACK raw/status/enable/clear behavior, and I2C_EXT0/1
      interrupt-matrix routing at +0x0A8/+0x0AC. Proven by
      hand-assembled firmware that runs an I2C0 write transaction
      through the completion ISR, verifies the emitted write bytes and
      drained TX FIFO, reads two synthetic bytes through a READ command,
      and forces an I2C1 NACK through its independent interrupt source.
      Cuts: no real attached-device model yet, no SCL/SDA waveform
      timing, no clock-stretch/arbitration/timeout timing, no slave
      mode, and reads synthesize zero bytes
- [x] ESP32-S3 core slice 99 — SPI master CPU-FIFO first cut
      (landed 2026-06-16): GPSPI2/GPSPI3 now expose source-pinned
      ESP32-S3 register blocks at 0x60024000/0x60025000, command,
      address, MOSI, and MISO phase register handling through the
      W0..W15 CPU buffer, cmd.usr self-clear, TRANS_DONE
      raw/status/enable/clear/set behavior, and SPI2_DMA/SPI3_DMA
      interrupt-matrix routing at +0x0B0/+0x0B4. Proven by
      hand-assembled firmware that runs a GPSPI2 command/address/MOSI
      transaction through the completion ISR, verifies cmd.usr polling
      completion and emitted bytes, reads zero-filled MISO bytes, clears
      TRANS_DONE, and routes GPSPI3 independently while draining MOSI
      from W8 with USR_MOSI_HIGHPART. Cuts: no DMA descriptor movement,
      attached-device response model, SPI timing, chip-select pin
      behavior, multi-line modes, or slave mode yet
- [x] ESP32-S3 core slice 100 — MCPWM timer/operator/generator first
      cut (landed 2026-06-16): MCPWM0/MCPWM1 now expose source-pinned
      ESP32-S3 register blocks at 0x6001E000/0x6002C000, three virtual
      timers per group, operator timer selection, comparator A/B
      timestamps, generator A/B event actions, continuous software
      force, GPIO-matrix output signals 160..171, raw/status/enable/
      clear interrupt registers, and PWM0/PWM1 interrupt-matrix routing
      at +0x07C/+0x080. Proven by hand-assembled firmware that routes
      MCPWM0 operator 0 generator A to IO5, wakes through an OP0_TEA
      compare ISR, clears/disables the interrupt, and separately routes
      MCPWM1's PWM1_OUT0A signal. Cuts: no dead-time insertion, carrier
      modulation, fault/capture/sync propagation, complementary pair
      helpers, power/clock gating effects, or full driver object model
      yet
- [x] ESP32-S3 core slice 101 — TWAI/CAN register + self-test first
      cut (landed 2026-06-16): the TWAI controller now exposes the
      source-pinned ESP32-S3 register block at 0x6002B000, the
      SJA1000-style 8-bit register layout packed into 32-bit words,
      TX/RX frame buffer bytes, self-reception loopback, RX buffer
      release, RX message count/status bits, read-to-clear RI/TI
      interrupts, and CAN_INT interrupt-matrix routing at +0x094.
      Proven by hand-assembled firmware that transmits a standard
      self-reception frame, reads back frame info/ID/data from the RX
      buffer, releases the RX buffer, and wakes through a CAN_INT ISR
      that proves `interrupt_reg` read-to-clear behavior. Cuts: no
      virtual CAN bus object, bit timing/arbitration/ACK/error
      confinement, acceptance-filter enforcement, driver alert queue,
      or wire-level GPIO waveform yet
- [x] ESP32-S3 core slice 102 — TWAI host injection + acceptance
      filters (landed 2026-06-16): the ESP32-S3 core now exposes typed
      TWAI host bench helpers (`injectTwaiFrame`, `drainTwaiTx`) so
      tests and future bridge/probe paths can inject frames from an
      outside bus node and inspect firmware transmissions. The
      register-level ACR/AMR acceptance-filter view is now distinct
      from the TX/RX buffer while reset mode is active, defaults to
      accept-all, and gates incoming standard frames before they enter
      the RX FIFO. Proven by hand-assembled firmware that configures an
      ID `0x123` filter, rejects a mismatched host-injected frame,
      accepts the matching frame, reads the RX frame bytes/RI interrupt
      through TWAI registers, and separately proves `TR` transmissions
      drain to the host bench. Cuts: no shared multi-node virtual CAN
      bus, arbitration, ACK/retry timing, error confinement, driver
      alert queue, wire-level GPIO waveform, or exact dual-filter mode
      yet
- [x] ESP32-S3 core slice 103 — TWAI virtual peer bus + ACK errors
      (landed 2026-06-16): ESP32-S3 cores can now be linked with
      `connectTwaiPeer()` / `disconnectTwaiPeer()` so one core's `TR`
      transmission is delivered into a connected peer's TWAI RX FIFO
      and ACKed by that active peer. Lone normal transmissions still
      drain to the host bench, but now latch `TI|EI|BEI`, increment TEC
      by 8, record the ACK-slot error segment, and progress toward
      BUS_OFF on repeated ACK failures. Proven by hand-assembled
      firmware that checks the no-ACK interrupt/counter/capture path and
      a two-core peer-bus test that verifies RX delivery with TEC held
      at zero. Cuts: no bit timing, arbitration, retry scheduling,
      driver alert queue, wire-level GPIO waveform, or exact
      dual-filter mode yet
- [x] ESP32-S3 core slice 104 — TWAI host event drain (landed
      2026-06-16): `drainTwaiEvents()` now exposes typed host-side TWAI
      events for callback-style bridge work: `tx_done` with decoded
      frame + success/failure, `rx_done` with decoded frame, and
      `error` with ACK-error flags. Proven by two new hand-assembled
      firmware paths: connected peers emit sender `tx_done(success:
      true)` plus receiver `rx_done`, while a lone normal transmit emits
      ACK error then `tx_done(success: false)`. Cuts: still no full
      ESP-IDF driver alert queue, bit timing, arbitration, retry
      scheduling, wire-level GPIO waveform, or exact dual-filter mode
      yet
- [x] ESP32-S3 core slice 105 — TWAI state-change events (landed
      2026-06-16): `drainTwaiEvents()` now includes `state_change`
      events with old/new error states matching ESP-IDF's
      `twai_state_change_event_data_t` shape. No-ACK TEC escalation now
      emits `active -> warning` at TEC 96, `warning -> passive` at TEC
      128, and `passive -> bus_off` at TEC 256. Proven by
      hand-assembled firmware that issues 32 normal no-ACK
      transmissions and filters the drained event stream for those
      three transitions. Cuts: still no full ESP-IDF driver alert
      queue, bit timing, arbitration, retry scheduling, wire-level GPIO
      waveform, or exact dual-filter mode yet
- [x] ESP32-S3 core slice 106 — TWAI listen-only TX suppression (landed
      2026-06-16): TWAI TX and self-RX requests now do nothing while
      listen-only mode is active, matching ESP-IDF's contract that a
      listen-only node receives but does not transmit dominant bits,
      including ACK and error frames. Proven by hand-assembled firmware
      that leaves reset in listen-only mode, attempts a standard-frame
      transmit request, and verifies host TX drain, event drain, TEC,
      and interrupt state remain quiet. Cuts: still no full ESP-IDF
      driver alert queue, bit timing, arbitration, retry scheduling,
      wire-level GPIO waveform, or exact dual-filter mode yet
- [x] ESP32-S3 core slice 107 — TWAI RX FIFO overrun events (landed
      2026-06-17): `drainTwaiEvents()` now emits an `error` event with
      `rxFifoOverrun` when an incoming TWAI frame is dropped because the
      modeled RX FIFO is already full. Proven by a host-injection test
      that fills the 64-frame FIFO, rejects the 65th frame, and drains
      the overrun flag. Cuts: still no full ESP-IDF driver alert queue,
      bit timing, arbitration, retry scheduling, wire-level GPIO
      waveform, or exact dual-filter mode yet
- [x] ESP32-S3 core slice 108 — TWAI ACK bus-error events (landed
      2026-06-17): `drainTwaiEvents()` now marks no-ACK transmit
      failures with both `ackErr` and `busError`, matching ESP-IDF's
      legacy TWAI alert model where ACK errors are bus errors. Proven by
      the no-ACK transmit test, which now requires the bus-error flag
      before the failed `tx_done` callback. Cuts: still no full ESP-IDF
      driver alert queue, bit timing, arbitration, retry scheduling,
      wire-level GPIO waveform, or exact dual-filter mode yet
- [x] ESP32-S3 core slice 109 — TWAI bus-off host event (landed
      2026-06-17): when repeated no-ACK transmits saturate the TEC at
      256, `drainTwaiEvents()` now emits a standalone `error` event with
      `busOff` immediately before the `passive` -> `bus_off` state
      change, mirroring ESP-IDF's distinct legacy `TWAI_ALERT_BUS_OFF`
      alert. Proven by a 32-frame no-ACK burst test that asserts the
      single bus-off error event, the unchanged state-change escalation,
      and the ordering. Cuts: still no full ESP-IDF driver alert queue,
      bit timing, arbitration, retry scheduling, wire-level GPIO
      waveform, exact dual-filter mode, or bus-off recovery slice yet
- [x] ESP32-S3 core slice 110 — TWAI bus-off recovery (landed
      2026-06-17): returning to operating mode (clearing the reset bit)
      while bus-off now completes recovery — counters clear and
      `drainTwaiEvents()` emits a `bus_off` -> `active` state change,
      mirroring ESP-IDF's `on_state_change` firing when a node exits
      bus-off. Proven by extending the no-ACK burst test to recover and
      assert the fourth state-change transition. Cuts: the
      129-recessive-bit recovery wait is not modeled (recovery is
      immediate), and recovery via a direct TEC-counter write does not
      yet emit the state-change event
- [x] ESP32-S3 core slice 111 — TWAI dual-filter acceptance mode
      (landed 2026-06-17): the AFM mode bit (mode bit 3) now selects
      single (set) vs dual (clear) acceptance filtering. Dual mode is
      modeled exactly for standard frames per the SJA1000 layout — two
      ID+RTR filters (ACR0/ACR1 and ACR2/ACR3), filter 1 also matching
      data byte 1 (ACR1[3:0]<<4 | ACR3[3:0]); a frame is accepted if
      either filter matches. Proven by a dual-filter test accepting two
      distinct IDs and rejecting a third. Cuts: extended-frame dual
      filtering still falls back to the single-filter coarse compare;
      no bit timing, arbitration, retry scheduling, or wire-level GPIO
      waveform yet
- [x] ESP32-S3 core slice 112 — TWAI extended-frame dual filtering
      (landed 2026-06-17): closes the slice 111 cut. In dual-filter mode
      an extended (29-bit) frame is matched per the SJA1000 EFF layout —
      each filter compares only ID[28:13] (top 16 bits): filter 1 =
      ACR0/ACR1, filter 2 = ACR2/ACR3, RTR and data bytes excluded;
      accept if either matches. Proven by a dual-filter test accepting
      two extended IDs (with the low 13 ID bits proven don't-care) and
      rejecting a third. Cuts: no bit timing, arbitration, retry
      scheduling, or wire-level GPIO waveform yet
- [x] ESP32-S3 core slice 113 — TWAI arbitration-lost modeling
      (landed 2026-06-17): two nodes can now contend for the bus.
      `armTwaiTransmit()` stages a peer as a simultaneous contender;
      when another node requests transmission the bus resolves by CAN
      bitwise arbitration — the numerically lower identifier wins,
      compared in wire order (11-bit base id, then SRR/IDE, then the
      18-bit extension + RTR) so a standard frame beats an extended
      frame sharing the same base id and a data frame beats a remote
      frame. The loser raises the ALI interrupt (IR.6), captures the
      losing bit in ALC (SJA1000 numbering, SOF=0), pushes an
      `{ arbLost: true }` error event, and — because CAN is
      non-destructive — keeps its frame armed and retransmits on the
      next bus-idle slot; crucially the TEC is NOT incremented
      (arbitration loss is normal traffic, per Linux `bd0ccb92`).
      Proven by a two-node test where id 0x500 loses to id 0x100,
      retransmits successfully, and reports ALC=1 with TEC=0, plus a
      standard-beats-extended discriminating test guarding the wire-order
      key. Cuts: contention is host-driven (a turn-based core cannot have
      two guests transmit within one bit window); single-shot abort is
      not yet modeled
- [x] ESP32-S3 core slice 114 — TWAI arbitration-lost capture latch
      (landed 2026-06-17): closes the slice 113 ALC re-arm cut. The
      SJA1000 ALC/ALI capture now latches on the first arbitration loss
      and is suppressed until software reads the ALC register, which
      re-arms it — matching `twai_ll_clear_arb_lost_cap`'s dummy-read.
      Arbitration itself is unaffected: a latched loser still keeps its
      frame armed and retransmits; only the ALC value and ALI interrupt
      freeze. Proven by a three-node test where one node loses twice in a
      single bus resolution (to id 0x100, then id 0x480 on the retransmit
      round) yet reports exactly one arbitration-lost event with ALC
      latched at the first loss's bit (ID.10 -> 1), not the second
      (ID.8 -> 3). Cuts: no bit timing, retry scheduling, or wire-level
      GPIO waveform yet
- [x] ESP32-S3 core slice 115 — TWAI single-shot transmit
      (landed 2026-06-17): closes the slice 114 single-shot cut. Writing
      the command register with TR|AT (0x03, ESP-IDF's
      `twai_ll_set_cmd_tx_single_shot`, surfaced as `TWAI_MSG_FLAG_SS`)
      now requests a single-shot transmission: the frame is attempted
      once and, on arbitration loss, dropped instead of retried — the TX
      buffer is released with a failed `tx_done` (mirroring
      `TWAI_ALERT_TX_FAILED`) and the frame never reaches the bus. SRR|AT
      (0x12) is the single-shot self-reception variant; AT on its own is a
      no-op (no pending transmission to cancel in this synchronous model).
      Proven by a two-node test where a single-shot id 0x500 loses to id
      0x100, reports a failed transmit, and — unlike the slice 113
      auto-retransmit path — leaves an empty TX log. Cuts: no bit timing,
      retry scheduling, or wire-level GPIO waveform yet
- [x] ESP32-S3 core slice 116 — TWAI transmit-complete status bit
      (landed 2026-06-17): closes the slice 115 TCS cut. The status
      register's TCS bit (SR bit 3) now reflects whether the last
      transmission actually completed — set after a successful transmit,
      cleared after a single-shot drop or an unacknowledged transmit —
      instead of reading complete unconditionally. Proven by reading the
      status register after a single-shot frame loses arbitration: TCS is
      clear, the inverse of the self-reception test where a successful
      transmit reads TCS set. Cuts: no bit timing, retry scheduling, or
      wire-level GPIO waveform yet
- [x] ESP32-S3 core slice 117 — a first SYSTIMER counter path
      (landed 2026-06-17): a new SYSTIMER peripheral at 0x60023000. UNIT0
      is modeled as a 52-bit up-counter at 16 MHz (XTAL/2.5, so one tick =
      15 CPU cycles) on the existing epoch substrate (base + ticks since
      sync, frozen while UNIT0_WORK_EN is clear). Software reads it through
      the hardware latch handshake: writing UPDATE (UNIT0_OP bit 30)
      snapshots the counter into UNIT0_VALUE_HI/LO and sets VALUE_VALID
      (bit 29); UNIT0_LOAD_HI/LO + UNIT0_LOAD set the base. This is exactly
      the counter esp_timer polls. Proven by a test that loads a frozen
      base and reads it back, checks VALUE_VALID, then enables counting and
      sees the value advance. Cuts (follow-on slices): UNIT1, the three
      comparators/alarms (TARGET0/1/2 one-shot + period mode), the
      SYSTIMER_TARGET interrupts (matrix sources 57/58/59), and core-stall
      gating
- [x] ESP32-S3 core slice 118 — SYSTIMER COMP0 alarm + interrupt latches
      (landed 2026-06-17): comparator 0 now generates the TARGET0 alarm.
      TARGET0_HI/LO stage the alarm value; COMP0_LOAD applies it; with
      CONF's TARGET0_WORK_EN (bit 7) set, a per-instruction check (mirroring
      the TIMG checkAlarm) latches INT_RAW bit 0 once UNIT0 reaches the
      target in one-shot/target mode. INT_ST gates the raw latch by INT_ENA,
      and INT_CLR clears it (the comparator only re-fires while the counter
      still exceeds the target, so software reprograms the target forward
      like esp_timer's ISR). Proven by counting UNIT0 past the target,
      reading INT_RAW set, INT_ST masked then enabled, and clearing after a
      forward reprogram. Cuts (follow-on slices): routing TARGET0 (matrix
      source 57) to a CPU interrupt, period mode, UNIT1/COMP1/COMP2
- [x] ESP32-S3 core slice 119 — SYSTIMER TARGET0 interrupt-matrix route
      (landed 2026-06-17): closes the slice 118 routing cut. The COMP0
      alarm now reaches a CPU interrupt — INTERRUPT_CORE0_SYSTIMER_TARGET0
      _INT_MAP_REG (matrix offset 0x0e4, source 57, verified against
      esp-idf interrupt_core0_reg.h) routes the source to a CPU line and
      recomputeIrq raises it while INT_RAW & INT_ENA holds. Proven by a
      level-1 handler test mirroring the APB_SARADC path: the counter
      passes the target, the ISR fires once, reprograms the target forward
      (as esp_timer does) and clears the latch, leaving INT_RAW empty with
      no re-fire. This completes esp_timer's counter -> alarm -> interrupt
      cycle on UNIT0/COMP0. Cuts: period (auto-reload) mode and
      UNIT1/COMP1/COMP2 (sources 58/59) remain follow-on slices
- [x] ESP32-S3 core slice 120 — SYSTIMER COMP0 period (auto-reload) mode
      (landed 2026-06-17): closes the slice 119 period-mode cut.
      TARGET0_CONF bit 30 (PERIOD_MODE) with PERIOD[25:0] selects periodic
      operation: COMP0_LOAD arms the first alarm one PERIOD ahead of the
      counter, and each fire auto-advances the comparator by PERIOD so the
      alarm re-fires every period without software reprogramming. Proven by
      a level-1 handler that only clears the latch (no reprogram) yet runs
      three times — the contrast to the one-shot path where the ISR had to
      reprogram the target forward. Cuts: UNIT1 + COMP1/COMP2 (matrix
      sources 58/59) and TIMER_UNIT_SEL remain follow-on slices
- [x] ESP32-S3 core slice 121 — SYSTIMER second counter (UNIT1)
      (landed 2026-06-17): adds UNIT1, the second independent 52-bit/16 MHz
      counter, with its own OP/LOAD/VALUE registers (UNIT1_OP 0x08,
      LOAD_HI/LO 0x14/0x18, VALUE_HI/LO 0x48/0x4c, LOAD 0x60) and CONF
      enable (UNIT1_WORK_EN, bit 2). Same epoch substrate and UPDATE/
      VALUE_VALID latch handshake as UNIT0; CONF writes now freeze both
      counters before applying the new run-state. Proven by loading a
      frozen base into UNIT1, reading it back, and confirming it advances
      once enabled. Cuts: COMP1/COMP2 comparators (matrix sources 58/59)
      and TIMER_UNIT_SEL (which UNIT drives each comparator) remain
      follow-on slices
- [x] ESP32-S3 core slice 122 — SYSTIMER COMP1/COMP2 + TIMER_UNIT_SEL
      (landed 2026-06-17): completes the SYSTIMER peripheral. The single
      comparator was refactored into a clean 3-comparator array, so COMP1
      and COMP2 share the COMP0 one-shot/period alarm logic, each with its
      own TARGETn registers (HI 0x1c+8n, LO 0x20+8n, CONF 0x34+4n),
      COMPn_LOAD (0x50+4n), INT bit n, CONF enable (bit 7+n), and
      interrupt-matrix source (57/58/59 at map offsets 0x0e4+4n). Added
      TARGETn_CONF bit 31 (TIMER_UNIT_SEL) so any comparator can be driven
      by UNIT0 or UNIT1. Proven by a COMP1 level-1 handler test driven by
      UNIT1 through matrix source 58. SYSTIMER now models both counters,
      all three comparators, one-shot + periodic modes, unit selection, and
      full interrupt delivery
- [x] ESP32-S3 core slice 123 — eFuse interrupt-matrix routing
      (landed 2026-06-17): closes a remaining interrupt-delivery gap. The
      eFuse read/program-done interrupt (its INT_RAW/ST/ENA/CLR registers
      were already modeled) now reaches the CPU:
      INTERRUPT_CORE0_EFUSE_INT_MAP_REG (matrix offset 0x090, source 36,
      verified against esp-idf interrupt_core0_reg.h via the source-16
      offset formula) routes it, and recomputeIrq raises it while
      INT_RAW & INT_ENA holds (the eFuse INT register writes now recompute
      the IRQ line). Proven by a level-1 handler test where a read command
      latches the interrupt, the ISR runs and clears it. Real IDF firmware
      polls eFuse status, so this is a completeness fix rather than a
      critical path
- [x] ESP32-S3 core slice 124 — deep-sleep timer wake (reset on wake)
      (landed 2026-06-17): models the sleep/wake long-tail item. Deep sleep
      is distinguished from light sleep by RTC_CNTL_DIG_PWC_REG (+0x90)
      bit 31 (DG_WRAP_PD_EN): when SLEEP_EN fires with that bit set, the
      digital core is powered down, so the RTC timer wake is a full chip
      RESET rather than a WAITI resume. The reboot records DEEPSLEEP_RESET
      (5) in RESET_STATE[5:0] (which survives in the always-on RTC domain),
      reusing the existing reset-cause + pending-reset machinery. All
      registers verified against esp-idf rtc_cntl_reg.h / rom/rtc.h. Proven
      by a two-boot test: first boot arms a deep-sleep timer wake and
      sleeps; the timer resets the chip; the reboot reads DEEPSLEEP_RESET
      and emits a marker. Light sleep (DG_WRAP_PD_EN clear) still resumes
      via WAITI as before. Cuts: other wake sources (GPIO/EXT/touch) in
      deep sleep, and RTC slow-memory retention, are follow-on
- [x] ESP32-S3 core slice 125 — GDMA IN_CHECK_OWNER descriptor gate
      (landed 2026-06-17): the RX descriptor owner-check is now gated by
      GDMA_IN_CONF1 bit 12 (IN_CHECK_OWNER), which resets to 0 (disabled)
      per gdma_reg.h — so by default the DMA ignores the descriptor OWNER
      bit and consumes CPU-owned descriptors (overwriting) rather than
      latching DSCR_EMPTY backpressure. The prior model always checked;
      now the existing ADC-continuous owner-handshake tests set the bit
      (as the IDF gdma driver does) and a new test proves the reset-default
      no-check path. This corrects the backpressure long-tail item:
      owner-checking is a configured behavior, not unconditional. Cuts:
      OUT_CHECK_OWNER / OUT_AUTO_WRBACK and CONF0 burst-length fields
      remain follow-on
- [x] ESP32-S3 core slice 126 — GDMA OUT_AUTO_WRBACK descriptor gate
      (landed 2026-06-17): the TX-side counterpart. The automatic
      descriptor write-back (clearing the OWNER bit to return it to the
      CPU after transmission) is now gated by GDMA_OUT_CONF0 bit 2
      (OUT_AUTO_WRBACK), which resets to 0 per gdma_reg.h — so by default
      the engine leaves the descriptor OWNER bit untouched and firmware
      recycles it. The prior model wrote back unconditionally. The change
      is additive (no test read the post-TX owner bit); the RMT-TX-from-
      GDMA test now asserts the descriptor stays DMA-owned by default.
      Cuts: OUT_CHECK_OWNER (OUT_CONF1 bit 12) and CONF0 burst-length
      fields remain follow-on
- [x] ESP32-S3 core slice 127 — GDMA OUT_CHECK_OWNER descriptor gate
      (landed 2026-06-17): the TX owner-check counterpart to slice 125's
      RX gate. The TX engine previously treated a CPU-owned outlink
      descriptor as a hard OUT_DSCR_ERR unconditionally; it is now gated by
      GDMA_OUT_CONF1 bit 12 (OUT_CHECK_OWNER), which resets to 0 per
      gdma_reg.h — so by default the engine ignores the OWNER bit and
      transmits the descriptor normally. The change is additive (existing
      TX tests use owner=DMA); a new test drives an RMT TX from a CPU-owned
      descriptor and confirms it completes (DONE|EOF|TOTAL_EOF, not
      DSCR_ERR). Cuts: CONF0 burst-length fields remain follow-on
- [x] ESP32-S3 core slice 128 — PCNT input glitch filter (landed
      2026-06-17): models U0_CONF0 FILTER_EN (bit 10) + FILTER_THRES
      (bits [9:0], APB cycles), verified against pcnt_reg.h / pcnt_struct.h.
      When the filter is enabled an input pulse narrower than FILTER_THRES
      cycles is ignored entirely — both edges dropped — matching the
      hardware "any pulse with width < threshold is ignored" rule. Modeled
      as a debounce in the event-driven input-capture path: each edge is
      deferred until its level has held >= FILTER_THRES cycles (confirmed
      on the next capture or on a counter read), so a glitch never reaches
      the counter and never latches a threshold event. Additive — the
      existing PCNT tests write CONF0 without FILTER_EN, so the filter is
      off there. Cuts: ctrl-input filtering and exact read-during-glitch
      timing remain follow-on
- [x] ESP32-S3 core slice 129 — deep-sleep GPIO wake coverage + slice-128
      typecheck fix (landed 2026-06-17): a new test proves the source-agnostic
      deep-sleep branch resets the core with DEEPSLEEP_RESET on an armed GPIO
      high-level wake (not just the RTC timer of slice 124); locks a
      previously-untested real path. Also repairs a noUncheckedIndexedAccess
      typecheck regression the slice-128 PCNT filter introduced (a false "0
      errors" from an OOM-terminating local typecheck had masked it)
- [x] ESP32-S3 core slice 130 — deep-sleep EXT0 + EXT1 wake coverage
      (landed 2026-06-17): two tests extend slice 129 to the RTC-IO wake
      families (EXT0 single-pin LV + SEL; EXT1 RTC-GPIO bitmask), each
      confirming the source-agnostic deep-sleep branch resets with
      DEEPSLEEP_RESET. No production change. Cut: touch-controller
      deep-sleep wake (state-machine driven, not a setPin edge) is follow-on
- [x] ESP32-S3 core slice 131 — deep-sleep touch wake coverage (landed
      2026-06-17): the final deep-sleep wake family. The touch wake fires
      from a firmware-triggered one-shot scan (TOUCH_CTRL2.TOUCH_START_EN)
      that latches RTC_TOUCH_TRIG_EN; the test confirms it resets the core
      with DEEPSLEEP_RESET. All five deep-sleep wake families (timer/GPIO/
      EXT0/EXT1/touch, slices 124+129+130+131) now have coverage. No
      production change
- [x] ESP32-S3 core slice 132 — SHA-256 hardware accelerator (landed
      2026-06-17): a new peripheral at DR_REG_SHA_BASE 0x6003B000 (verified
      vs hwcrypto_reg.h / sha_ll.h / sha_hal.c). Models the non-DMA SHA-256
      path — MODE/START/CONTINUE/BUSY + the 16-word message and 8-word digest
      regions — with the FIPS 180-4 block compression implemented from
      scratch. Firmware owns the padding (engine compresses padded blocks).
      A known-answer test confirms SHA-256("abc") = the NIST vector. Cuts:
      SHA-1/224/384/512, the DMA path, and the SHA interrupt are follow-on
- [x] ESP32-S3 core slice 133 — SHA accelerator SHA-1 + SHA-224 modes
      (landed 2026-06-17): extends slice 132 to two more algorithms via
      SHA_MODE (SHA-1 = 0, SHA-224 = 1). SHA-224 reuses the SHA-256
      compression with the SHA-224 IV + 7-word digest; SHA-1 adds a
      from-scratch 80-round compression onto a 5-word digest. Two
      known-answer tests confirm SHA-1("abc") + SHA-224("abc") = the NIST
      vectors. The accelerator now covers the three 32-bit algorithms; cuts:
      SHA-384/512 (64-bit words), the DMA path, and the SHA interrupt
- [x] ESP32-S3 core slice 134 — SHA accelerator interrupt routing (landed
      2026-06-17): routes the SHA done interrupt through the interrupt matrix
      (source 84 → map at INTMTX + 0x150; SHA_INT_ENA +0x28 arms, block
      completion asserts, SHA_CLEAR_IRQ +0x24 clears), same recomputeIrq/raise
      pattern as the eFuse routing. A test confirms the ISR runs once and
      stays cleared. Cuts: SHA-384/512 and the DMA path remain follow-on
- [x] ESP32-S3 core slice 135 — SHA multi-block (START + CONTINUE) coverage
      (landed 2026-06-17): a test hashes the 56-byte NIST two-block message,
      with SHA_START hashing block 1 and SHA_CONTINUE accumulating block 2,
      confirming the digest matches the NIST vector. Locks the previously
      untested multi-block accumulation path; no production change
- [x] ESP32-S3 core slice 136 — SHA-512 + SHA-384 modes (landed 2026-06-18):
      the 64-bit-word SHA algorithms (SHA_MODE 384=3, 512=4) with 128-byte
      (32-word) blocks and a 16-word digest, hi-word-first. The FIPS 180-4
      SHA-512 compression (80 rounds, K[80], the SHA-512/384 IVs) is
      implemented from scratch over [hi,lo] pairs; constants taken from
      mbed-TLS / Linux sources, not transcribed. Two NIST known-answer tests
      (SHA-512/384 of "abc") confirm it. The accelerator now models
      SHA-1/224/256/384/512 + interrupt + multi-block; only the DMA path
      remains follow-on
- [x] ESP32-S3 core slice 137 — AES-128 ECB accelerator (new peripheral,
      landed 2026-06-18): DR_REG_AES_BASE 0x6003A000, the CPU-driven path
      (KEY/TEXT_IN/MODE/TRIGGER/STATE/TEXT_OUT). FIPS-197 cipher from scratch
      with an algebraically-GENERATED S-box (GF(2^8) inverse + affine, no
      256-byte table transcribed), key expansion, and the round transforms.
      A FIPS-197 known-answer test confirms it. Unblocked by reading ESP-IDF
      headers locally (PlatformIO Arduino-ESP32) when network/DNS was down.
      Cuts: AES-192/256, decrypt, CBC/CTR, DMA path, AES interrupt
- [x] ESP32-S3 core slice 138 — AES-192 + AES-256 ECB modes (landed
      2026-06-18): generalizes the key expansion over Nk=4/6/8 (with the
      AES-256 extra SubWord) and runs Nr=Nk+6 rounds. Two FIPS-197 known-answer
      tests confirm AES-192/256; they caught a refactor bug (MixColumns guard
      left hardcoded round!==10 instead of round!==Nr). Cuts: decrypt, CBC/CTR,
      DMA path, AES interrupt
- [x] ESP32-S3 core slice 139 — AES ECB decrypt 128/192/256 (landed
      2026-06-18): the FIPS-197 inverse cipher (inverse S-box, InvShiftRows,
      InvSubBytes, InvMixColumns via a general GF(2^8) multiply), modes 4/5/6.
      Two known-answer tests round-trip the FIPS-197 vectors back to plaintext.
      The accelerator now does AES-128/192/256 ECB encrypt AND decrypt. Cuts:
      CBC/CTR, DMA path, AES interrupt
- [x] ESP32-S3 core slice 140 — AES done-interrupt routing (landed
      2026-06-18): completing a block asserts a level interrupt gated by
      AES_INT_ENA (+0xb0) / cleared by AES_INT_CLR (+0xac); AES is source 83
      (one before SHA=84), matrix map at INTMTX + 0x14c (0x040 + 4*(83-16)),
      same eFuse/SHA pattern. A known-answer test confirms the ISR fires
      exactly once and does not re-fire after the clear. Cuts: CBC/CTR, DMA path
- [x] ESP32-S3 core slice 141 — correct SHA/AES interrupt-matrix map offsets
      (landed 2026-06-18): SHA/AES maps were at 0x150/0x14c (wrong `4*source`
      formula, sources 84/83); the silicon header gives explicit offsets
      SHA = INTMTX + 0x138 (source 77), AES = INTMTX + 0x134 (source 76). The
      source enum has gaps vs the map layout past I2C/SPI, so map offsets are now
      read directly from interrupt_core0_reg.h, never computed. Tests still green
- [x] ESP32-S3 core slice 142 — RSA accelerator modular exponentiation (landed
      2026-06-18): new peripheral DR_REG_RSA_BASE 0x6003C000; little-endian
      operand blocks M@+0x000 / Z@+0x200 / Y@+0x400 / X@+0x600, LENGTH (+0x804)
      = num_words-1, RSA_MODEXP_START (+0x80c) computes Z = X^Y mod M, done via
      QUERY_INTERRUPT (+0x818) / CLEAR_INTERRUPT (+0x81c). BigInt modpow gives
      the exact result (Montgomery Rinv/Mprime inputs accepted, no effect). KAT:
      textbook RSA 65^17 mod 3233 = 2790. Verified vs esp-idf bignum_alt.c +
      mpi_ll.h + mpi_periph.c. Cuts: MOD_MULT, MULT, RSA matrix interrupt (src 75)
- [x] ESP32-S3 core slice 143 — RSA modular multiply + full-width multiply
      (landed 2026-06-18): RSA_MOD_MULT_START (+0x810) -> Z = (X*Y) mod M (same
      block layout as MODEXP); RSA_MULT_START (+0x814) -> Z = X*Y with Y
      left-extended into the Z block at word-offset num_words, LENGTH =
      num_words*2-1, 2*num_words-word product read from Z. Exact BigInt. KATs:
      123456*789 mod 1000000 = 406784; 0xffffffff*2 = 0x1fffffffe. Cuts: RSA
      matrix interrupt (source 75 -> INTMTX + 0x130)
- [x] ESP32-S3 core slice 144 — RSA done-interrupt routing (landed 2026-06-18):
      completing a MODEXP/MOD_MULT/MULT op asserts a level interrupt gated by
      RSA_INTERRUPT_REG (+0x82c) / cleared by RSA_CLEAR_INTERRUPT (+0x81c); RSA is
      source 75, matrix map at the explicit silicon offset INTMTX + 0x130. A
      known-answer test confirms the ISR fires once and does not re-fire after the
      clear. RSA peripheral now complete (MODEXP + MOD_MULT + MULT + done interrupt)
- [x] ESP32-S3 core slice 145 — USB-Serial-JTAG TX console (landed 2026-06-18):
      new peripheral DR_REG_USB_DEVICE_BASE 0x60038000, the default S3 console.
      Bytes -> EP1_REG (+0x00) stage into the TX FIFO; WR_DONE (bit0 of EP1_CONF
      +0x04) flushes to the host; EP1_CONF reads SERIAL_IN_EP_DATA_FREE (bit1). New
      drainUsbSerialJtag() host method mirrors drainUart(). KAT: writes "Hi" and
      drains [0x48,0x69]. Cuts: RX path, USB-Serial-JTAG interrupts (INTMTX + 0x180)
- [x] ESP32-S3 core slice 146 — USB-Serial-JTAG RX console (landed 2026-06-18):
      host input via new usbSerialJtagWrite(byte) (mirrors uartWrite); EP1_CONF
      raises SERIAL_OUT_EP_DATA_AVAIL (bit2) while pending, each EP1_REG read pops
      the next RX byte. KAT: inject 'X', read status (6) -> byte (0x58) -> status
      (2). Console now does TX + RX. Cuts: USJ interrupts (INTMTX + 0x180)
- [x] ESP32-S3 core slice 147 — USB-Serial-JTAG RX interrupt (landed 2026-06-18):
      host input raises SERIAL_OUT_RECV_PKT (INT bit2); INT_ENA (+0x10) arms,
      INT_CLR (+0x14) clears, INT_RAW/ST (+0x08/+0x0c) report; matrix map at the
      explicit silicon offset INTMTX + 0x180. KAT: inject byte, ISR drains EP1 +
      clears, fires once. USB-Serial-JTAG console complete (TX + RX + interrupt).
      Cuts: SERIAL_IN_EMPTY (TX-empty) interrupt
- [x] ESP32-S3 core slice 148 — USB-Serial-JTAG TX-empty interrupt (landed
      2026-06-18): SERIAL_IN_EMPTY (INT bit3) tracks the TX FIFO — staging a byte
      clears it, WR_DONE flush empties the FIFO and re-asserts it (reset default 1).
      KAT: stage a byte, arm, flush -> fires once. USB-Serial-JTAG interrupt surface
      now complete (RX OUT_RECV_PKT + TX IN_EMPTY)
- [x] ESP32-S3 core slice 149 — HMAC-SHA256 accelerator (landed 2026-06-18): the
      4th S3 crypto block (DR_REG_HMAC_BASE 0x6003E000). Purpose=8 (upstream),
      eFuse key via loadHmacKey() host helper, WR_MESSAGE_MEM (+0x80) + SET_MESSAGE_ONE
      (+0x50), SET_RESULT_FINISH (+0x5c)=2, MAC from RD_RESULT_MEM (+0xc0). Exact
      HMAC-SHA256 via from-scratch pure SHA-256 (RFC 2104). KAT: HMAC(32×0x0b,
      64×0x61) = 91acb47f…0e012f1e. Verified vs esp-idf hmac_reg.h/hmac_ll.h/hmac_hal.c.
      Cuts: multi-block + partial-padding feed, HMAC interrupt, JTAG/DS key modes
- [x] ESP32-S3 core slice 150 — hardware RNG (landed 2026-06-18): esp_random()
      reads WDEV_RND_REG (0x6003507C); the emulator returns a deterministic-from-reset
      xorshift32 stream (seed 0xa5a5a5a5) so runs are reproducible while each read
      advances the word. KAT: v1=0x3330a88d, v2=0xe202683d. Used pervasively by real
      IDF (mbedTLS/lwIP/BT)
- [x] ESP32-S3 core slice 151 — AES-CBC via the AES-DMA path, encrypt + decrypt
      (landed 2026-06-18): on the S3 all non-ECB AES runs through GDMA. AES now
      consumes plaintext from the GDMA OUT channel (peripheral AES0 = trigger id 6)
      and writes ciphertext to the GDMA IN channel, CBC-chained from AES_IV_BASE
      (+0x50). New regs AES_DMA_ENABLE (+0x90), AES_BLOCK_MODE (+0x94, CBC=1),
      AES_BLOCK_NUM (+0x98). KAT: NIST SP 800-38A AES-128-CBC vectors round-trip
      end-to-end through real GDMA descriptors. Cuts: CTR mode, DMA-mode interrupt test
- [x] ESP32-S3 core slice 152 — AES-CTR via the AES-DMA path (landed 2026-06-18):
      AES_BLOCK_MODE = 3 (CTR); keystream = E(counter), output = input XOR keystream,
      counter low 32 bits increment per block (INC32). Same GDMA data path as CBC.
      KAT: NIST SP 800-38A AES-128-CTR vector (counter f0f1f2f3…ff) through GDMA.
      The AES done interrupt already fires on DMA completion via the existing matrix
      routing (slice 140/141). AES-DMA now does CBC enc/dec + CTR + done interrupt
- [x] ESP32-S3 core slice 153 — AES-DMA completion interrupt (landed 2026-06-18):
      completing a CBC/CTR DMA op raises the AES done interrupt (source 76 → INTMTX +
      0x134), same matrix path as ECB. KAT: a CBC-DMA encrypt with the interrupt armed
      fires the ISR exactly once. **AES-DMA / CBC mode COMPLETE** (CBC encrypt +
      decrypt + CTR + completion interrupt, all GDMA-verified end-to-end)
- [x] ESP32-S3 core slice 154 — SHA-DMA path (landed 2026-06-18): the SHA accelerator
      takes its pre-padded message over GDMA (peripheral SHA0 = trigger id 7), digest
      in the H registers. New regs SHA_DMA_BLOCK_NUM (+0x0c), SHA_DMA_START (+0x1c),
      SHA_DMA_CONTINUE (+0x20); new shaRunDma() reuses the block-compression core.
      KAT: padded "abc" block over GDMA → NIST SHA-256 ba7816bf…f20015ad
- [x] ESP32-S3 core slice 155 — SHA-512 over the SHA-DMA path (landed 2026-06-18):
      shaRunDma() selects the 1024-bit (32-word) block size for the 64-bit-word
      algorithms (SHA-512/384) and feeds sha512Compress, so GDMA hashing covers the
      full SHA family. KAT: padded "abc" SHA-512 block over GDMA → ddaf35a1…a54ca49f
- [x] ESP32-S3 core slice 156 — AES-GCM authenticated encryption (landed 2026-06-18):
      AES_BLOCK_MODE = 6. Firmware-derived J0 -> J0_MEM (+0x70); the engine GCTR-encrypts
      (counter from inc32(J0)), GHASHes the ciphertext, computes tag = GHASH ⊕ E(J0) at
      T0_MEM (+0x80); H = E(0) at H_MEM (+0x60), AAD_BLOCK_NUM (+0xA0). Adds a
      from-scratch GHASH GF(2^128) multiply. KAT: NIST GCM Test Case 3 (ct + tag)
      end-to-end through GDMA. Cuts: GCM-with-AAD + partial-block tests
- [x] ESP32-S3 core slice 157 — AES-GCM with AAD (landed 2026-06-18): exercises the
      AES_AAD_BLOCK_NUM path — leading DMA blocks GHASHed but not encrypted, tag folds
      in the AAD. KAT: Test Case 3 + a 16-byte AAD block → ciphertext unchanged, tag
      e5d06dc2…88d624ee. AES now covers ECB/CBC/CTR/GCM(+AAD). Cuts: partial-block GCM
- [x] ESP32-S3 core slice 158 — AES-256-GCM (landed 2026-06-18): proves the GDMA-fed
      AES-GCM path works with a 256-bit key (AES_MODE = 2 / Nk=8), not just AES-128.
      KAT: NIST GCM Test Case 15 (256-bit all-zero key/IV, one zero block) → ciphertext
      cea7403d…baf39d18, tag d0d1c8a7…d48ab919; vector pre-confirmed against OpenSSL.
- [x] ESP32-S3 core slice 159 — AES-OFB (landed 2026-06-18): the AES-DMA path adds
      output-feedback mode (AES_BLOCK_MODE = 2), keystream O_i = E(O_{i-1}) from the IV,
      enc == dec. KAT: NIST SP 800-38A F.4.1 over two blocks (exercises O_2 = E(O_1)) →
      3b3fd92e…e83cfb4a / 7789508d…c54ed825; vector pre-confirmed against OpenSSL.
      AES now covers ECB/CBC/CTR/OFB/GCM(+AAD). Cut: CFB128 (needs the hardware
      enc/dec direction convention verified against the TRM first), partial-block.
- [x] ESP32-S3 core slice 160 — AES-CFB128 enc + dec (landed 2026-06-18): the AES-DMA
      path adds cipher-feedback mode (AES_BLOCK_MODE = 5) both directions; keystream
      E(feedback) from the IV, AES_MODE enc/dec bit selects the feedback source (output
      ciphertext when encrypting, input when decrypting). The direction convention was
      verified against esp-idf aes_ll_set_mode + esp_aes_crypt_cfb128 DMA path first
      (not guessed). KAT: NIST SP 800-38A F.3.13/F.3.14 over two blocks, enc + dec,
      pre-confirmed against OpenSSL. AES now covers ECB/CBC/CTR/OFB/CFB128/GCM(+AAD).
      Remaining AES cut: CFB8 (byte-feedback), partial-block GCM.
- [x] ESP32-S3 core slice 161 — Digital Signature (DS) peripheral (landed 2026-06-18): the
      crypto capstone (5th S3 crypto block, DR_REG_DIGITAL_SIGNATURE_BASE 0x6003D000). SET_START
      AES-256-CBC-decrypts the encrypted key-param block C and exposes Y/M; SET_ME computes
      Z = X^Y mod M. Register map verified vs hwcrypto_reg.h (C-block decrypts in place
      Y+0x000/M+0x200/Rb+0x400/Box+0x600, IV+0x630/X+0x800/Z+0xA00, ctrl +0xE00). KAT: fixed
      512-bit RSA key, signature round-trip-verified (Z^e mod n == X) — first-GREEN. Cuts (need
      primary-source verification, do not guess): the MD integrity check (exact SHA-256 input +
      box byte-order) and the HMAC-downstream AES-key derivation. See [[project_emu_ds_peripheral]].
      All 5 S3 crypto accelerators (SHA, AES, RSA, HMAC, DS) now modeled.
- [x] ESP32-S3 core slice 162 — AES-192-GCM (landed 2026-06-18): completes the GCM
      key-size matrix (128/192/256) through the Nk=6 key schedule. KAT: NIST GCM Test
      Case 8 (192-bit all-zero key/IV, one zero block) → ct 98e7247c…84b0f600, tag
      2ff58d80…7514f0fb; pre-confirmed against OpenSSL. Follow-on (deferred, needs
      primary-source verification — do NOT guess): the DS MD integrity check (exact
      SHA-256 input + box byte-order live in the esp_secure_cert pip module, not yet
      fetched) and the HMAC-downstream key derivation.
- [x] ESP32-S3 core slice 163 — AES-CFB8 enc + dec (landed 2026-06-20): the AES-DMA
      path adds 8-bit (byte-segment) cipher-feedback mode (AES_BLOCK_MODE = 4), both
      directions. Each input byte encrypts the 128-bit shift register, XORs the
      most-significant keystream byte, then shifts the register left one byte and feeds
      the ciphertext byte back at the LSB end (the output byte when encrypting, the input
      byte when decrypting). esp-idf's esp_aes_crypt_cfb8 drives this exact DMA path —
      aes_hal_mode_init(ESP_AES_BLOCK_MODE_CFB8) over full blocks. KAT: NIST SP 800-38A
      F.3.7 (key 2b7e1516…, IV 000102…0f, plaintext 6bc1bee2… → ciphertext 3b79424c…),
      two blocks so the cross-block byte-feedback carry is exercised; independently
      confirmed via OpenSSL aes-128-cfb8. AES now covers ECB/CBC/CTR/OFB/CFB8/CFB128/
      GCM(+AAD) — the full AES_BLOCK_MODE matrix. Remaining AES cut: partial-block GCM.
- [x] Co-sim bindings are core-aware (landed 2026-06-20): the Co-sim
      panel's pin-binding editor now offers the LOADED core's own pin
      names — ESP32-S3 `IO0`..`IO48` (matching esp32s3PinId), RP2040
      `GP0`..`GP29`, AVR `PB`/`PD` — instead of a hardcoded AVR PB/PD
      set. `CORE_KINDS[kind].defaultPins` is the source of truth and
      `candidatePins` takes the core's defaults (falling back to AVR for
      back-compat). Closes the last "AVR-flavored pin names" gap left by
      the firmware-panel core picker.
- [x] **ESP32-S3 base — COMPLETION GATE** (CERTIFIED 2026-06-23; the Definition
      of Done for the ESP32 foundation, so board/sensor breadth can begin): "done" is by
      app USABILITY, not exhaustive register fidelity — the long tail
      below is opportunistic, never a gate. Criteria: (1) ✅ `npm run -w
      @protopulse/emu test` green (238 ESP32-S3 unit tests); (2) ✅ E2E app
      smoke (certified 2026-06-23) — picked ESP32-S3 in the core picker,
      loaded `packages/emu/samples/esp32s3-blink-io5.bin`, ran 68M cycles
      @ 240 MHz, and IO5 toggled in the logic-analyzer pin traces at the
      cycle-exact rate (zero-jitter, per the `blinks IO5 with cycle-exact
      spacing` unit test); (3) ✅ co-sim closed loop (certified 2026-06-23) —
      an analog node drives an ADC channel and the firmware reads it back
      tracking the SPICE node, proven end-to-end by
      `packages/cosim/src/quantum.esp32s3.cosim.test.ts`: a real divider (VCC
      3.3 V → R1 10k → MID → R2 10k → GND) SPICE-solves MID to 1.65 V; a real
      `Esp32s3Core` loaded with `esp32s3-adc0-read.bin` reads ADC ch0 through
      the real `runCosimClosedLoop` quantum engine, and the settled reads track
      MID to ±0.02 V (UART decodes to code 2048 = round(1.65/3.3×4095));
      (4) ✅ co-sim pin labels show ESP32 `IO{n}`, not AVR. All four criteria
      are met in-repo — the ESP32-S3 foundation is certified. Next: pivot to
      breadth (boards, sensors, modules) — each a bounded slice (host-bus/ADC
      device model + KAT + bench demo).
- [ ] ESP32 core, the long tail toward unmodified IDF/FreeRTOS
      firmware: GDMA driver-pool flush policy/backpressure timing,
      sleep/wake, remaining interrupt-delivery gaps, and remaining
      peripherals — walked openly, slice by slice (opportunistic; NOT a
      gate on the base completion above)

## v0.6 — The World 🔨 *(sync + community + fab foundations landed; registry and ordering are product decisions)*

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
- [x] Branch sync (landed 2026-06-11): every branch travels as
      {name, base, OWN ops} — the inherited prefix is the base
      pointer, never re-carried. Snapshots list branches main-first
      so bases resolve in order; branches born mid-session re-announce
      via an idempotent join; ops racing ahead of their branch's
      snapshot heal by re-joining. A same-named branch with a
      DIFFERENT base is unsyncable and stays local (advisory note,
      not an error). Room storage records went branch-aware; old
      bare-envelope files load as main
- [x] Part packs — the community library's foundation (landed
      2026-06-11): `pp-part-pack` JSON format in @protopulse/parts —
      full Part records behind the complete part schema, each pack
      confined to its own namespace (`core:` cannot be shadowed),
      provenance tiers declared per part. The palette loads packs
      from file (all-or-nothing on collision, reason shown), persists
      them in localStorage across sessions, shows the tier in every
      part's tooltip, and forgets packs on request. Honest cut: no
      registry/hosting/sharing — that's the product decision; the
      format means a pack can already travel as a file
- [ ] Community library: registry/sharing (product decision — needs
      Tyler: where packs live, who can publish, moderation)
- [ ] Board/module packs after the ESP32 long tail: verified starter
      packs for Arduino Uno/Nano/Mega-class boards, Raspberry Pi
      Pico/RP2040 boards, ESP32 dev boards, common sensors, motor
      drivers, power modules, connectors, and reusable circuit snippets.
      Full Raspberry Pi/Linux SBC support is a later bridge/plugin/
      telemetry decision, not an MCU-emulator target
- [x] Multi-fab rule decks + fab picker (landed 2026-06-11, the
      manufacturing pipeline's foundation): OSHPark and PCBWay
      2-layer decks join JLC — every capability web-verified against
      the fab's official pages (sources in inbox/). The DRC panel's
      fab picker selects which deck the WHOLE app answers to: DRC
      reports (deck in the cache key), the Router's direct runs,
      walk/shove clearance, and zone pours all follow, and the
      choice persists. Vol I §6's "DRC rule decks per manufacturer,
      versioned" is real
- [ ] Manufacturing pipeline: quotes/ordering via fab APIs (Vol II
      §H — product decision + external accounts; needs Tyler)

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

- [x] Legacy → .ppx importer (landed 2026-06-11): `protopulse
      import-legacy <snapshot.json> --out <design.ppx.json>` — converts
      a raw-row dump of one legacy project (the SQL recipe is in the
      command help; the legacy app's own export format drops instance
      ids and part links, severing connectivity) into an op-log bundle:
      components, values, placements (25 px = one 1.27 mm grid step),
      and nets from both segment generations. Parts map onto the seed
      library by mpn/title heuristics; anything unmappable is skipped
      WITH ITS REASON — no guessed pinouts. The produced bundle is
      materialize-verified and `protopulse check`s clean. Still open:
      moving Tyler's REAL projects through it (criterion 2 below needs
      his database)
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

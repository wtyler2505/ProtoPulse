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
      co-sim bindings remain AVR-flavored pin names)
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
- [ ] ESP32 core, the long tail toward unmodified IDF/FreeRTOS
      firmware: GDMA driver-pool flush policy/backpressure timing,
      sleep/wake, remaining interrupt-delivery gaps, and remaining
      peripherals — walked openly, slice by slice

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

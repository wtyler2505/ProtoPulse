# Changelog

All notable changes to ProtoPulse are documented in this file.

## 2026-06-16 — ESP32-S3 slice 95: RTC slow-clock elapsed rebase

### Added
- **RTC slow-clock live rebase** (@protopulse/emu):
  RTC main-timer ticks and RWDT elapsed ticks now carry forward when
  firmware writes RTC_CNTL_CLK_CONF or RTC_CNTL_SLOW_CLK_CONF. Changing
  the RTC_SLOW_CLK source or RC_SLOW divider now affects future time
  without reinterpreting elapsed time under the new rate.

### Verified
- Added hand-assembled Xtensa firmware that latches the RTC main timer
  after 1 ms, switches to XTAL32K, proves the latched count does not move
  backward, and then keeps aging on the new source.
- Added hand-assembled Xtensa firmware that arms RWDT under RC_SLOW,
  ages one RTC-slow tick, switches to XTAL32K mid-timeout, and still
  resets after the remaining tick with RTCWDT_SYS_RESET.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 152 ESP32-S3 tests.

### Honest cuts
- Sub-tick oscillator phase is still integer-rounded; this closes the
  larger elapsed-time rebase gap without claiming analog clock phase
  fidelity.

## 2026-06-16 — ESP32-S3 slice 94: RC_SLOW divider for RTC slow clock

### Added
- **RTC slow-clock divider** (@protopulse/emu):
  RTC_CNTL_SLOW_CLK_CONF.ANA_CLK_DIV now updates the modeled RC_SLOW
  divider when ANA_CLK_DIV_VLD is set. RWDT and RTC main-timer ticks
  now age at RC_SLOW / (ANA_CLK_DIV + 1) when RC_SLOW is selected.

### Verified
- Added hand-assembled Xtensa firmware that divides RC_SLOW by 4,
  arms a raw RWDT stage0=1 timeout, survives beyond the undivided
  RC_SLOW x2 deadline, and then reboots later with RTCWDT_SYS_RESET.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 150 ESP32-S3 tests.

### Follow-up
- The live elapsed-time rebase gap called out here is closed by
  ESP32-S3 slice 95.

## 2026-06-16 — ESP32-S3 slice 93: RTC slow-clock mux for RWDT

### Added
- **RTC slow-clock source selection** (@protopulse/emu):
  RTC_CNTL_CLK_CONF.ANA_CLK_RTC_SEL now round-trips and drives the
  RTC_SLOW_CLK tick rate used by RWDT and RTC main-timer latching.
  The model covers Espressif's RC_SLOW, XTAL32K, and RC_FAST_D256
  approximate clock sources.

### Verified
- Added hand-assembled Xtensa firmware that selects XTAL32K, arms a
  raw RWDT stage0=1 timeout, survives beyond the old RC_SLOW x2
  deadline, and then reboots later with RTCWDT_SYS_RESET.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 149 ESP32-S3 tests.

### Follow-up
- The live elapsed-time rebase gap called out here is closed by
  ESP32-S3 slice 95.

## 2026-06-16 — ESP32-S3 slices 21-92: IDF runway catch-up

### Added
- **ADC/GDMA/LEDC/RMT runway** (@protopulse/emu): APB_SARADC
  threshold comparators, ADC continuous GDMA backpressure/overflow
  behavior, LEDC low-speed PWM/fade/interrupt delivery, and RMT TX/RX
  direct-memory + GDMA surfaces landed after slice 20.
- **Sleep, wake, and RTC interrupt surface**: WAITI and RTC sleep wake
  sources now cover timer, watchdog, brownout, XTAL32K-dead, SUPER_WDT,
  SARADC, TSENS, touch, ULP/COCPU, GPIO/EXT0/EXT1, UART wake, and
  low-power status/readback slices.
- **Reset and fault-routing fidelity**: power-glitch, brownout,
  clock-glitch, SUPER_WDT, RWDT pause-in-sleep, RWDT eFuse timeout
  multiplier, FIB_SEL routing, and clock-glitch interrupt producer
  slices brought the RTC/reset runway much closer to ESP-IDF startup
  expectations.

### Verified
- Each slice carries its own hand-assembled Xtensa firmware proof in
  `ROADMAP.md`, ending with slice 92's host-injected clock-glitch
  interrupt producer.
- Packages CI was green through `ab301d16` after the latest slice.

### Honest cuts
- This is still not a claim that unmodified IDF/FreeRTOS firmware is
  complete. The open long tail remains GDMA driver-pool flush policy,
  backpressure timing, sleep/wake edge cases, remaining interrupt gaps,
  and the broader peripheral matrix.

## 2026-06-12 — ESP32-S3 slice 20: APB_SARADC interrupt delivery

### Added
- **APB_ADC interrupt-matrix route** (@protopulse/emu): APB_SARADC
  INT_RAW&INT_ENA now drives the ESP32-S3 core-0 interrupt matrix
  source at `INTERRUPT_CORE0_APB_ADC_INT_MAP_REG` (+0x104), matching
  Espressif's ESP-IDF v5.2.7 S3 headers. Digital ADC firmware can
  now wake a level-1 handler on ADC1/ADC2 DONE instead of polling
  INT_ST forever.

### Verified (+1 test, emu suite at 161 green)
- Hand-assembled Xtensa firmware maps APB_ADC to CPU line 0, enables
  ADC1_DONE, starts a digital ADC1 conversion, vectors into a
  level-1 handler, clears INT_CLR, returns, and verifies DATA_STATUS
  still holds the sampled channel data.
- `@protopulse/emu` tests, targeted ESLint for the touched emulator
  files, `check:packages`, and the full package test suite passed.

### Honest cuts
- Core-0 only, consistent with the currently modeled interrupt-matrix
  surface. Threshold interrupt bits are routable once something
  models the threshold comparators; this slice only generates the
  ADC_DONE raw bits.

## 2026-06-11 — ESP32-S3 slice 9: flash-mapped IROM/DROM segments

### Added
- **XIP through the cache windows** (@protopulse/emu): app-image
  segments whose load addresses fall in IROM (0x42000000–0x44000000)
  or DROM (0x3C000000–0x3E000000, both per soc.h and
  ext_mem_defs.h) are now served read-only at their vaddrs — the net
  effect of the second-stage bootloader's MMU setup plus a
  fully-warmed cache. This is what those segments mean: real app
  images map .flash.text/.flash.rodata, they don't copy them to RAM.
  Entry points in IROM are accepted.
- Cache-window writes refuse ("flash is read-only through the
  cache"); reads inside a window but outside any mapped segment
  refuse loudly with the address.

### Verified (+2 tests, emu suite at 124 green)
- An XIP image with NO SRAM segment boots from IROM, pulls a
  constant from DROM, txes it, and survives reset().
- The two refusals, plus the slice-5 unmapped-segment refusal
  updated (flash-mapped segments are no longer refused — truly
  unmapped ranges still are).

### Honest cuts
- XIP reads cost 1 cycle like everything else (no cache-miss or
  line-fill timing); MMU registers are not modeled, so runtime
  remapping is impossible; no SPI flash writes. The long tail toward
  unmodified IDF/FreeRTOS firmware remains: ROM functions,
  RTC/eFuse/SYSTEM registers, the second core.

## 2026-06-11 — ESP32-S3 slice 8: TIMG0 timer 0

### Added
- **TIMG0 T0** (@protopulse/emu): the 54-bit general-purpose timer at
  0x6001F000 — EN/INCREASE/AUTORELOAD/DIVIDER/ALARM_EN in T0CONFIG,
  UPDATE-latched LO/HI reads, LOAD from LOADLO/LOADHI, INT_RAW/ST/
  ENA/CLR with T0 at bit 0, all per timer_group_reg.h. Counts APB
  ticks (80 MHz, soc.h) through the 16-bit prescaler (field 0 =
  ÷65536, matching how the HAL writes 65536). The counter is virtual
  — derived from elapsed CPU cycles, zero per-cycle bookkeeping; the
  alarm comparator runs per instruction only while armed.
- **Hardware alarm auto-disable**: when the alarm fires, ALARM_EN
  clears by hardware (the documented behavior gptimer's ISR re-arms
  around); autoreload reloads the counter from LOAD{LO,HI}. The
  TG_T0 interrupt source routes through the matrix (map at +0x0C8).

### Verified (+3 tests, emu suite at 122 green)
- Cycle-exact ticking: two UPDATE captures 12 CPU cycles apart differ
  by exactly 2 at divider 2 (240/80 = 3 cycles per APB tick).
- A periodic autoreload alarm counts 3 with the full gptimer ISR
  dance (INT_CLR + ALARM_EN re-arm).
- A one-shot alarm fires exactly once — the auto-disable is real.

### Fixed
- The 54-bit wrap uses float-safe modulo: the classic ((x%M)+M)%M
  idiom silently rounds small values to 0 at M = 2^54 (the double
  ulp there is 4) — caught by the first test draft.

### Honest cuts
- T0 of TIMG0 only (no T1, no TIMG1, no watchdogs); APB clock source
  only (no XTAL); UPDATE captures instantly. Next: flash-cache
  mapping.

## 2026-06-11 — ESP32-S3 slice 7: SAR ADC1 oneshot + co-sim channels

### Added
- **SAR ADC1 oneshot** (@protopulse/emu): the SENS_SAR_MEAS1_CTRL2
  register dance (base 0x60008800 + 0xC) that esp-idf's
  adc_oneshot_ll and Arduino's analogRead perform — one-hot channel
  select in SAR1_EN_PAD [30:19], the MEAS1_START_SAR (bit 17) 0→1
  pulse starting a conversion, MEAS1_DONE_SAR (bit 16) poll, 12-bit
  result in MEAS1_DATA_SAR. Every field position from sens_reg.h,
  the flow from adc_ll.h.
- **Co-sim ADC surface**: the ESP32-S3 core now implements
  setAdcSampler/drainAdcReads (the McuCore contract), quantizing
  clamp(round(volts / 3.3 × 4095), 0, 4095); the sampler survives
  reset as bench wiring. The app's core registry gains ADC1's
  channels 0–9 (= GPIO1–10 per adc_channel.h) — the ESP32-S3 was the
  only core without analog channels in the co-sim panel.

### Verified (+2 tests, emu suite at 119 green)
- An analogRead-style conversion round-trips: channel 3 sampled at
  1.65 V → firmware txes 2048 over UART; drainAdcReads logs exactly
  one read on channel 3 (and draining drains).
- Without a sampler, conversions read 0 V and still log.

### Honest cuts
- Conversions complete instantly (no SAR clock timing); attenuation
  is not modeled (3.3 V full scale); no ADC2, no APB_SARADC DMA
  mode. Next: TIMG, flash-cache mapping.

## 2026-06-11 — ESP32-S3 slice 6: peripheral interrupts through the matrix

### Added
- **Interrupt matrix** (@protopulse/emu): the ESP32-S3's matrix at
  0x600C2000 — each peripheral source's 5-bit map register selects
  its CPU interrupt line (GPIO source at +0x040, UART0 at +0x06C),
  reset value 16 so unmapped sources stay silent. Addresses and reset
  values from esp-idf's reg_base.h / interrupt_core0_reg.h.
- **GPIO pin interrupts**: GPIO_PINn registers (INT_TYPE bits [9:7]
  written verbatim from gpio_int_type_t — posedge/negedge/anyedge/
  low-level/high-level — and INT_ENA bit 13, the bit gpio_ll.h's
  GPIO_LL_INTR_ENA writes), STATUS/STATUS1 with W1TS/W1TC. Edge types
  latch on matching input edges; level types re-assert after W1TC
  while the level holds — exactly like hardware.
- **UART0 interrupts**: INT_RAW/ST/ENA/CLR with RXFIFO_FULL (live
  against the CONF1 RXFIFO_FULL_THRHD, reset 96) and TX_DONE
  (latched per transmitted byte, cleared via INT_CLR).
- **CPU**: level-triggered external level-1 lines via `setExtInt`,
  masked to core-isa.h's level-1 externals (INT0–5, 8–9, 12–13,
  17–18) and immune to INTCLEAR, per the RM's rule for
  level-triggered lines.

### Verified (+3 tests, emu suite at 117 green)
- A rising-edge IO4 interrupt vectors through the matrix and counts
  exactly 2 of 3 edges (the falling edge is ignored).
- A high-level interrupt re-fires after every W1TC until the host
  drops the pin (the starved main loop then reports the count).
- A fully interrupt-driven UART echo: RXFIFO_FULL wakes the handler
  per byte while main sits parked on a jump; the line deasserts on
  FIFO drain and re-asserts on the next byte.

### Honest cuts
- Only the GPIO and UART0 sources exist — map writes for unmodeled
  sources are accepted and dropped; RXFIFO_FULL is condition-derived
  (INT_CLR has no lasting effect unless the FIFO drains); no TIMG,
  no ADC, no flash cache yet.

## 2026-06-11 — ESP32-S3 slice 5: MOVSP + the ESP-IDF app-image loader

### Added
- **MOVSP** (@protopulse/emu): the windowed ABI's last gap. With a
  caller's frame live in the register file it is a plain
  stack-pointer move; with all three WindowStart bits below clear
  (the RM's AllocaCause condition) it performs the Alloca handler's
  net effect — the 4-word base save area moves from below the old sp
  to below the new one. Same magic-handler approach as spill/fill.
- **ESP-IDF app-image loader**: `loadFirmware` now boots esptool-built
  .bin images (magic 0xE9). The 24-byte header is validated against
  esp-idf's esp_app_format.h (entry_addr honored, chip_id must be 9 =
  ESP32-S3, ≤16 segments), each segment loads into the modeled SRAM
  window, and the trailing checksum byte (XOR of segment data seeded
  0xEF, esptool's ESP_CHECKSUM_MAGIC) is verified. `reset()` replays
  the segments and restarts at the image's entry point. The Firmware
  panel's existing .bin path feeds straight into this.
- Assembler: the `MOVSP(t, s)` builder.

### Verified (+4 tests, emu suite at 114 green)
- A two-segment image (code → IRAM at a non-base address, data →
  DRAM) boots at its entry point and survives reset().
- Wrong-chip (`targets ESP32 (chip_id 0)`), flash-mapped-segment, and
  corrupted-checksum images refuse with clear messages.
- MOVSP both ways: plain move with the caller live (sp moves, save
  area does NOT); Alloca path with the callers hidden via WSR
  WINDOWSTART (markers at [sp−16] and [sp−4] travel with the stack).

### Honest cuts
- Flash-mapped segments (0x42xxxxxx/0x3Cxxxxxx) refuse — the flash
  cache is not modeled, so only IRAM/DRAM-resident images run; the
  SHA-256 trailer is not verified (the XOR checksum is); flash
  header fields are ignored. Next: peripheral interrupt lines, ADC,
  TIMG, flash-cache mapping.

## 2026-06-11 — ESP32-S3 slice 4: exceptions, interrupts, and time

### Added
- **Special registers + RSR/WSR/RSIL/RFE** (@protopulse/emu): PS
  (INTLEVEL/EXCM gating), EPC1, EXCSAVE1, EXCCAUSE, VECBASE,
  INTENABLE, INTERRUPT, CCOUNT, CCOMPARE0, and the WindowBase/
  WindowStart SRs — numbers verified against the Cadence RM,
  including catching the RM index's own typo (EXCSAVE1 is 209, not
  192 — the EXCSAVE2..7 = 210–215 sequence proves it).
- **The core timer**: CCOUNT increments every cycle; CCOUNT =
  CCOMPARE0 latches the INT6 timer interrupt (line and level from
  ESP32-S3's own core-isa.h), cleared by writing CCOMPARE0 — the RM
  rule, honored exactly.
- **Level-1 dispatch**: pending ∧ enabled ∧ INTLEVEL<1 ∧ ¬EXCM →
  EPC1 ← PC, EXCCAUSE ← 4, EXCM ← 1, PC ← VECBASE + 0x340
  (XCHAL_USER_VECOFS). RFE returns. Reset parks INTLEVEL at 15;
  firmware lowers via RSIL like real crt0s do.
- Assembler: RSR/WSR/RSIL/RFE builders, the SR name map, and PAD_TO
  — NOP-filling to an absolute image offset so handlers can sit at
  architectural addresses.

### Verified (+4 tests, emu suite at 110 green)
- CCOUNT advances exactly one per instruction (RSR deltas).
- The full interrupt life: a periodic CCOMPARE0 interrupt vectors to
  VECBASE+0x340, the handler saves context the architectural way
  (EXCSAVE1 + scratch memory), increments a counter, re-arms (which
  clears the pending bit), RFEs — and main counts 3 ticks.
- RSIL: an interrupt latched while masked delivers the moment
  INTLEVEL drops ([0, 1] observed).
- Unknown special registers refuse loudly.

### Honest cuts
- Timer line only (no software/peripheral interrupt lines yet);
  level-1 only; UM/WOE stored, not acted on; vectoring costs no
  cycles; VECBASE alignment unenforced. Next: MOVSP, peripheral
  lines, the IDF app-image loader.

## 2026-06-11 — ESP32-S3 slice 3: the windowed ABI

### Added
- **Register windows** (@protopulse/emu): CALL4/8/12, CALLX4/8/12,
  ENTRY, RETW/RETW.N over a 64-entry physical register file with
  WindowBase/WindowStart, exactly per the Cadence ISA RM (whose
  §4.7.1 quotes the mechanics verbatim). Overflow/underflow is
  handled by MAGIC SPILL/FILL — the RM's reference handlers' net
  effect performed directly, producing byte-for-byte the stack
  layout compiled code and debuggers expect. The check runs lazily
  on first touch of a register group, matching the hardware's
  spill-and-retry fixpoint.
- Assembler: ENTRY/RETW/RETW.N/CALLXn builders and CALLN_TO
  index-based placeholders (sharing CALL0's 4-alignment
  enforcement).

### Verified
- "entry a1, 32" = 36 41 00 byte fixture; window rotation argument
  passing (caller a10 → callee a2) with caller locals surviving;
  **14 live frames of call8 recursion over the 64-register file** —
  multiple overflow spills on the way down, underflow fills on the
  unwind, every frame's sentinel register and the root frame's UART
  pointer round-tripping through memory ([1..12, 78] out the UART);
  CALLX8 through a register; RETW with a call0-style link refuses.
  The test's own first draft used ENTRY a1,16 in a call8-making
  function — an ABI violation (callee extra save area needs 16 more
  bytes) — and the emulator's faithful layout surfaced it: the
  canonical "entry a1, 32" exists for a reason. 106 emu tests green.

### Honest cuts
- Spill/fill costs no cycles; MOVSP and handler-only L32E/S32E/RFWO/
  RFWU refuse; PS not modeled (window rules enforced by throwing).
  Still ahead for real ESP-IDF firmware: interrupts, peripherals,
  the app-image loader.

## 2026-06-11 — ESP32-S3 slice 2: code-density instructions

### Added
- **16-bit .N forms in the interpreter** (@protopulse/emu): MOV.N,
  MOVI.N (asymmetric −32..95, sign = AND of the top two immediate
  bits), ADD.N, ADDI.N (t=0 encodes −1), L32I.N/S32I.N (imm4<<2),
  BEQZ.N/BNEZ.N (zero-extended, forward-only), RET.N, NOP.N — the
  forms GCC emits densely, i.e. the first prerequisite for ever
  running compiler output. RETW.N and ILL.N refuse loudly.
- **Mixed-width assembly** (xtensa-asm.ts): narrow builders carry
  their width through a two-pass layout, and control flow gained
  index-based placeholders (J_TO/BEQ_TO/BNEZ_TO/BEQZ_N_TO/…)
  resolved against the real byte layout — hand-counted offsets are
  how this morning's two assembler bugs happened, so the layout
  engine owns targets now. BR() remains valid for uniform 24-bit
  code.

### Verification
- Four details the Espressif overview PDF's text extraction garbled
  (MOV.N operand order, BEQZ.N signedness, ADDI.N's −1 rule, MOVI.N's
  range rule) were settled against the full Cadence ISA RM —
  addendum in inbox/2026-06-11-esp32s3-emulator-core-verification.md.
- 6 new tests: narrow byte fixtures (RET.N = 0d f0, NOP.N = 3d f0),
  the MOV.N direction probe (would print 42 instead of 7 if
  transposed), MOVI.N at both range ends, ADDI.N −1 + narrow
  load/store round-trip, BEQZ.N jumping the trap, a mixed-width
  zero-jitter blink, RET.N subroutines + the RETW.N refusal.
  102 emu tests green.

## 2026-06-11 — ESP32-S3 core v0: the from-scratch emulator epic begins

### Added
- **Xtensa LX7 interpreter** (@protopulse/emu xtensa.ts): the 24-bit
  call0-ABI subset (~32 instructions — ALU, shifts, loads/stores,
  branches, J/JX/CALL0/CALLX0/RET, L32R, MOVI/ADDI/ADDMI). Every
  encoding verified against the Espressif ISA overview AND the
  ida-xtensa2 disassembler tables; unimplemented encodings throw
  with address and bytes instead of guessing.
- **Hand-assembler** (xtensa-asm.ts, the asm.ts/thumb-asm.ts
  sibling): 24-bit builders, a BR() displacement helper, an L32R
  literal pool, CALL0_TO with 4-alignment enforcement, and a
  bootable image layout (entry jump → pool → code).
- **Esp32s3Core** under the McuCore contract: GPIO matrix (both
  banks, IO0–IO48, OUT/W1TS/W1TC + ENABLE + IN, cycle-stamped pin
  events) and UART0 (FIFO + STATUS RXFIFO_CNT) at the REAL S3
  addresses from esp-idf v5.2's own soc headers (sources in
  inbox/2026-06-11-esp32s3-emulator-core-verification.md).
- **Firmware panel**: loads raw .bin images (the core's format)
  alongside Intel HEX; the core picker gains the S3 with an honest
  "v0, raw images" label; co-sim offers it no ADC channels because
  it has no ADC.

### Verified
- 9 tests, all real hand-assembled Xtensa machine code, with the
  assembler's bytes pinned against independent disassembly fixtures
  (RET 80 00 00, MOVI a2,63 = 22 a0 3f, …) so an assembler/
  interpreter shared bug cannot hide: zero-jitter blink on IO5,
  host-driven input mirror, high-bank IO33 via OUT1/ENABLE1, UART
  hello + echo through STATUS polling, CALL0/RET double-twice,
  SLLI arithmetic, loud HEX/unknown-instruction refusals, reset
  replay.

### Honest cuts (stated in the core header)
- Single core (the S3 has two); 1 instruction = 1 cycle at 240 MHz;
  one 480 KB SRAM window on both buses; no 16-bit density forms, no
  register windows — real ESP-IDF firmware will NOT run yet; no
  interrupts, no ADC, no bootloader. The ROADMAP names the next
  slices.

## 2026-06-11 — documentation overhaul: every living doc audited against the code

### Fixed (stale claims, verified against the repo before correcting)
- Legacy AI tool count is **113**, not 82 (counted from the
  `server/ai-tools/` registry) — corrected in README, USER_GUIDE,
  AI_AGENT_GUIDE.
- Legacy test suite is **725 files / ~30.5k tests** (verified by
  running it), not "54 files / 1,553" — README and AI_AGENT_GUIDE now
  state the real numbers AND the honest caveat (~421 env-dependent
  failures on main, tracked in ROADMAP).
- Database schema is **47 tables**, not 27 (counted in
  `shared/schema.ts`).
- Engine test count corrected everywhere to **1,340**; "14 concept
  articles" → the complete 88-article wiki; "17 seed parts" → 18.
- The repo claimed MIT in three places with a dead LICENSE link —
  **the MIT LICENSE file now exists**.

### Refreshed
- **README.md**: engine section rewritten for the v0.1–v0.4-complete
  reality (full capability table across all 16 packages, crew, fab
  decks, importer), honest Quality numbers, expanded documentation
  index, unverifiable legacy progress percentage replaced with a
  pointer to the backlog ledger.
- **packages/README.md**: complete 16-package map with dependencies,
  the op-log thesis paid off in one paragraph, two new house
  conventions written down (honest cuts stated; hardware facts
  verified), relay dev command added.
- **DEVELOPER.md / AI_AGENT_GUIDE.md**: engine sections brought to
  current truth — all 16 packages, both AI stacks table, real test
  expectations.
- **USER_GUIDE.md**: §19 retitled from "Preview" to "The New Editor"
  (it long outgrew a preview); intro cross-links it.
- **DESIGN.md**: engine chapter package map and SDF-text reference
  updated.
- **tools/golden/README.md**: the `zoned-led` fixture joins the table.
- **ADR index**: 0012–0016 indexed; ADR-0014's deviation noted as
  closed (the merge resolver shipped).

### Untouched on principle
- `docs/vision/` (frozen), `docs/notebooklm.md` (Codex-owned), all
  point-in-time records (CODEX_*/COLLAB_*/audits/qa-audit/reports),
  CHANGELOG history below this entry.

## 2026-06-11 — multi-fab rule decks + fab picker

### Added
- **OSHPark + PCBWay 2-layer rule decks** (content/decks): every
  capability web-verified against the fab's official pages —
  OSHPark 6/6 mil trace/space, 10 mil drill, 5 mil annular, 15 mil
  edge keepout; PCBWay 0.1 mm trace/space, 0.15 mm drill/annular,
  0.25 mm edge. Sources + the mil→nm table filed to
  inbox/2026-06-11-fab-rule-deck-capabilities.md. The power-class
  0.3 mm trace override is the house convention, noted as such.
- **Fab picker** (@protopulse/app DRC panel): selects which
  manufacturer's deck the WHOLE app answers to — DRC reports (the
  deck joins the cache key, so the same head re-checks under a new
  fab), the Router's direct runs, walk/shove clearance, and zone
  pours all follow the selection, which persists across sessions.
  Switching fabs clears the displayed report (it answered to
  another fab) and re-pours zones at the new clearance.

### Verified
- Runner test: same head re-runs on fab switch, deck reloads,
  unknown deck names refuse, the three decks list with JLC first.
  Browser pass: picker lists all three, an OSHPark run reports
  "deck oshpark-2layer-standard rev 2026-06", and the selection
  survives a reload.

## 2026-06-11 — part packs: the community library's foundation

### Added
- **`pp-part-pack` format** (@protopulse/parts): a versioned JSON
  file of full Part records, validated by the complete part schema
  (pin closure, 1.27 mm grid, footprint pad references). Structural
  trust rules: every part lives in the pack's own namespace — the
  `core:` seed namespace cannot be shadowed or extended — and
  provenance tiers are declared per part with the note saying who
  verified what. `loadPackInto` is all-or-nothing: any collision
  refuses the whole pack with the reason.
- **Palette pack loading** (@protopulse/app): "Load part pack…"
  reads a pack file, adds its parts to the palette (tier shown in
  every tooltip), persists the pack in localStorage so it's back
  next session, lists loaded packs, and forgets them on request
  (parts stay until reload — stated in the UI). Startup load
  failures surface in the palette, never silently.

### Honest cut
- No registry, hosting, or sharing — that's a product decision
  (where packs live, who publishes, moderation). The format is the
  engineering half: a pack already travels as a file.

### Verified
- 4 pack tests (parse+load, namespace rules incl. core-shadowing
  refusal, duplicate/collision all-or-nothing, full part-schema
  enforcement) and a browser pass: load → part in palette → place it
  (ops advance) → reload → still there, pack row listed.

## 2026-06-11 — legacy → .ppx importer (migration milestone, gate 1)

### Added
- **`protopulse import-legacy`** (@protopulse/cli): converts a raw-row
  JSON snapshot of one legacy project (psql recipe in the command
  help) into a .ppx op-log bundle — components, values, schematic
  placements (25 legacy px = one 1.27 mm grid step, rotations snapped
  to quarter turns), and nets resolved from BOTH legacy segment
  generations ({instanceId, pinId} and {fromInstanceId, …}), with
  connector ids and names both accepted and pins mapped by name
  first, ordinal only when the counts agree. Parts map onto the
  engine seed library by mpn/title/category heuristics (generic NPN
  → 2N3904 and generic N-MOSFET → AO3400, each noted); anything
  unmappable — LDRs, mystery modules — is skipped with its reason.
  Dirty data degrades loudly: a port claimed twice stays on the
  net that existed first and the report says so. The bundle is
  materialize-verified before it's written (problems = exit 1).

### Honest scope
- One legacy circuit design per bundle (--design picks; the report
  lists the rest); hierarchy, breadboard/bench/pcb views, and
  non-seed parts don't carry over. The legacy app's own export
  format drops instance ids and part links — hence the raw-row
  snapshot input.
- Still open before legacy retirement: moving Tyler's real projects
  through it (needs his database), then the default-UI flip.

### Verified
- 5 importer tests (mapping table incl. the LDR refusal; sound
  bundle with values/placements/rotation snap; both segment
  generations + id/name pin resolution; dirty-data degradation;
  --design selection) and an end-to-end smoke: snapshot →
  import-legacy → `protopulse check` exits 0 clean.

## 2026-06-11 — deferred-cuts sweep 2: mouse-bites + fab/panel UI

### Added
- **Mouse-bite separation** (@protopulse/export panelizeGraph):
  `separation: 'v-cut' | 'mouse-bites'` — copies part by a routed
  channel (`gapNm`, default 2mm) bridged by tabs (`tabWidthNm`,
  default 5mm; two per copy edge at 25%/75%) with 0.5mm perforations
  at 0.75mm pitch along BOTH edges of every channel, rails included.
  Per-piece outlines come back as `edgeSegments` for Edge.Cuts and
  bite centers as `bites` for the drill file. The v-cut path is
  byte-identical to before.
- **Excellon extraHoles** (@protopulse/export): exportExcellon grows
  an optional extra-holes parameter for the perforations. Honest
  note: they join the one drill file — KiCad would split PTH/NPTH
  into two files. Default stays byte-identical (golden-safe).
- **Fab outputs + Panelize UI** (@protopulse/app Export tab): one
  button downloads the board's fab set (F/B copper gerbers,
  Edge.Cuts, Excellon drill, pick-and-place CSV); the Panelize
  section (rows/cols/rail/separation/gap/tab) downloads the same
  set for the panel. Engine refusals surface verbatim in the status
  bar. Browser-verified: refusal without an outline, then a 2×2
  mouse-bite panel downloading 5 files whose drill contains exactly
  the engine's 224 perforations (32 tabs × 7 holes).

### Honest cuts
- Edge.Cuts for mouse-bite panels is outline-overlay style (outer
  rect + per-piece rects + bite drills), not a kikit-style routed
  contour polygon. No panel fiducials (unchanged; the graph can't
  hold bare copper and fabs add their own).

## 2026-06-11 — deferred-cuts sweep 1: EEPROM + watchdog, per-core ADC, deck picker

### Added
- **AVR EEPROM** (@protopulse/emu): 1 KiB against a persistent
  backend — nonvolatile across reset() like the silicon, with
  eepromMemory() for bench pre-seeding and inspection. Firmware
  tests cover the full EECR state machine: EEMPE 4-cycle arm window,
  EEPE polling through the ~3.6 ms erase+write, EERE read-back out
  the UART, and persistence across a power-on reset.
- **AVR watchdog** (@protopulse/emu): the WDCE change-enable window,
  WDE timeout → CPU reset + MCUSR.WDRF, WDR feeding. Firmware tests:
  a hung loop gets reset (WDRF asserted); a WDR loop never does.
  Honest note in the core header: avr8js's watchdog reset preserves
  I/O registers where real silicon clears them.
- **Per-core ADC channels** (@protopulse/app co-sim): the closed-loop
  ADC binding picker now offers the borrowed core's own channels
  (RP2040: ADC0–3 on GP26–29; AVR: ADC0–7) instead of a fixed AVR
  list, and the panel names which core it borrowed from the Firmware
  tab.
- **Review deck picker** (@protopulse/app): the Review panel offers
  builtin + every versioned deck bundled from content/review-decks
  (glob + zod mirror, same pattern as the sourcing catalog). The
  deck is part of the report cache key AND the history key — the
  opened/closed delta never diffs across decks (runner test pins
  this). The report line now names deck + rev.

### Still honest gaps
- SPI/TWI slave mode (the host is always the far end); ESP32 core.

## 2026-06-11 — SDF text + GPU picking (the renderer epic)

### Added
- **SDF glyph atlas** (@protopulse/renderer): text now renders from a
  signed distance field — exact Felzenszwalb Euclidean distance
  transform (`sdf.ts`, DOM-free, tested against brute force) with
  TinySDF sub-pixel seeding from the antialiased raster, uploaded as
  an R8 texture, reconstructed by an fwidth smoothstep shader. Crisp
  at every zoom; browser-verified at ~70× (smooth contours, round
  counters, no blur). Supersedes the M1 canvas-alpha atlas (ADR-0015
  supersedes ADR-0013).
- **GPU pick buffer** (@protopulse/renderer `pickAt`): scene nodes
  draw into an offscreen RGBA8 ID pass (24-bit index encoding in
  `pick-encode.ts`, exact-k/255 round-trip tested); readPixels at the
  cursor answers "what's under here" in O(1) regardless of density.
  Cached per (scene, camera, size); drill holes punch through the
  pick buffer just like the visible pass. ADR-0016 supersedes
  ADR-0012 — the Vol II §B.2 dual picking system is complete.
- **Hover highlight** (@protopulse/app): both editors light the node
  under the cursor — GPU pick first (exact on pads/zones/traces/
  copper), flatbush tolerance pick as fallback for 1px line art.
  Browser-verified: pad fill → footprint id, empty board → null,
  highlight clears on leave.

### Honest cut
- Single-channel SDF, not multi-channel MSDF: sharp corners round by
  ≤1 source pixel at extreme magnification (needs vector outlines +
  a bundled font to do better — revisit trigger in ADR-0015).

### Status
- This was the last tractable engine item. v0.1 now has exactly one
  open box (pcbnew manual import check — Tyler); everything else on
  ROADMAP is gated on hardware, product decisions, or migration.

## 2026-06-11 — ESP32-S3 verified part

### Added
- **core:esp32-s3-wroom-1** (@protopulse/parts): the Probe's brain
  joins the seed library with all 41 module pins verified against
  the Espressif ESP32-S3-WROOM-1/-1U datasheet pin table and
  cross-checked against an independent community pinout (sources +
  full table in inbox/2026-06-11-esp32-s3-wroom-1-pinout.md, per the
  Hardware Verification Protocol). Strapping pins (IO0/IO3/IO45/IO46)
  and the EN pull-up flagged in the part docs; symbol splits EN+IOs
  left, UART/JTAG/USB right, 3V3 up, grounds down.

### Honest cut
- No footprint yet — the 18×25.5mm castellated land pattern is a
  later datasheet-exact slice; the part is schematic-usable and the
  unplaced tray flags it on the board side.

### Verified
- New test: 41 pins, unique pin + symbol keys, the datasheet corner
  pins by number (1 GND, 2 3V3, 3 EN, 27 IO0, 36 RXD0, 37 TXD0,
  41 EPAD), and the stated footprint absence. Full test:packages
  green; eslint 0 errors.

## 2026-06-11 — branch sync

### Added
- **Branches sync** across the relay: every branch travels as
  {name, base, OWN ops} — the inherited prefix is the base pointer
  and is never re-carried on the wire. Snapshots list branches
  main-first so base pointers resolve in adoption order; a branch
  created mid-session re-announces through an idempotent join; ops
  that race ahead of their branch's snapshot heal by re-joining.
  BranchLog gains adoptBranch (sync-shaped refusals, not throws) and
  ownOpsFor.
- **Honest conflict rule**: a same-named branch with a DIFFERENT
  fork point is unsyncable by construction — the relay keeps its
  first-seen base and replies with an advisory the Sync panel shows
  as a note; the rest of the session keeps syncing.
- Room persistence records went branch-aware ({branch, base, env}
  JSONL); pre-branch files still load — bare envelopes were main.
  v1 clients (flat envelope payloads) keep working against the new
  relay.

### Verified
- 2 relay tests (branch join/snapshot wire shape + tagged broadcast;
  base-mismatch advisory with first-seen-base retention) and 2
  end-to-end two-editor tests (a feature branch travels: pointer
  adopted, feature-only component visible on the branch and ABSENT
  from main, edits flow both ways; a branch born mid-session reaches
  the peer). All 8 pre-branch relay/sync tests still pass through
  the compat paths. Full test:packages green; eslint 0 errors.

## 2026-06-11 — AVR timers 1/2, SPI, TWI

### Added
- **Timers 1 and 2** wired into Atmega328pCore: avr8js models drive
  OC1A/OC2A/… through the already-wired GPIO ports, so CTC/PWM
  waveforms land in the cycle-stamped pin-event stream like any edge.
- **SPI master** against a host byte handler (setSpiHandler): each
  master transfer hands MOSI to the host and clocks the reply back
  into SPDR; avr8js still charges the configured clock cycles so SPIF
  timing stays honest. No handler = the bus floats 0xFF, like real
  disconnected MISO.
- **TWI master** against a host bus handler (setTwiHandler):
  start/connect/write/read/stop route synchronously with host acks;
  no handler = every address NACKs — an empty bus, never a hang. Both
  handlers survive reset(), like the ADC sampler: bench wiring, not
  machine state.

### Honest gaps (stated in the core header)
- EEPROM and watchdog remain unwired; SPI/TWI slave mode is not
  modeled (the host is always the far end).

### Verified
- 6 tests, all real hand-assembled firmware: timer1 CTC toggles B1
  every exactly 100 cycles and timer2 toggles B3 every 50 (zero
  jitter asserted); an SPI transfer round-trips MOSI 0x42 → host →
  MISO 0xA5 → SPDR → UART; the floating-bus case reads 0xFF; a full
  TWI write transaction logs start → connect(0x50,W) → write(0x42) →
  stop with acks; the empty-bus case completes instead of wedging.
  Full test:packages green; eslint 0 errors.

## 2026-06-11 — panelization: v0.4 complete

### Added
- **panelizeGraph** (@protopulse/export): the panel is a TRANSFORMED
  GRAPH — rows×cols copies with `~P<n>`-suffixed ids/refs/nets,
  offset copper, optional top/bottom rails, and the panel rectangle
  as the outline. Because the output is a plain DesignGraph, every
  existing exporter (gerber, excellon, pick-and-place) and even DRC
  work on the panel unchanged — panelization adds geometry, not a
  second export pipeline. V-cut scores come back alongside and ride
  the Edge.Cuts emitter (exportEdgeCuts grew an extra-segments
  parameter).
- Refusals are honest: no outline, non-rectangular outline, or a
  pointless 1×1 each come back with a reason.

### Honest cuts
- Rectangular axis-aligned outlines only (a V-cut is a straight
  full-panel score); V-cut separation only (mouse-bites are a later
  slice); no panel fiducials (the graph can't represent bare copper —
  pads come from parts — and fabs like JLC add their own on request);
  engine-level only, no panel UI yet.

### Milestone
- **v0.4 (The Board) is COMPLETE**: PCB ops, footprints, DRC, the
  trace/via/zone/outline tools, walkaround + shove + spring-back +
  cascading shove, thermal reliefs, Gerber/Excellon/PnP goldens,
  Edge.Cuts, the copper-to-edge check, and panelization.

### Verified
- 4 tests: refusal trio; 2×3 replication (counts, offsets, distinct
  ids, panel outline, V-cut count, graph invariants HOLD on the
  panel); rails extend the outline with joint V-cuts; the panel flows
  through the existing exporters (4× pad flashes, suffixed refs in
  PnP, outline+V-cut strokes in Edge.Cuts, byte determinism). Full
  test:packages green; eslint 0 errors; goldens untouched.

## 2026-06-11 — outline UI + the copper-to-edge check

### Added
- **Outline tool** in the PCB toolbar: click corners anywhere, click
  the first corner again to close — commits set_board_outline,
  replacing any previous outline (singleton semantics, one undoable
  op).
- **Outline rendering**: the board edge draws as yellow Edge.Cuts
  lines under everything; it is context, never a selection target
  (worst pick rank, segment-proximity hit test).
- **DRC-EDGE-CLEARANCE**: with an outline present, every copper item
  must sit INSIDE it and keep the deck's copper_to_edge_nm from every
  edge; items outside the board are called out as such. Maps to the
  panelization wiki article (breakaway stress near edges). No
  outline → no findings: a schematic-stage design is not in
  violation.

### Verified
- 2 DRC tests (clean inside / no-outline silence; edge-hugging trace
  + outside via both flagged as errors). Browser-verified end to end:
  outline renders, the toolbar tool exists, and the DRC panel reports
  "trace t-edge is 25000nm from the board edge — the deck requires
  300000nm" against the real JLC deck. Full test:packages green;
  eslint 0 errors.

## 2026-06-11 — board outline in the core

### Added
- **set_board_outline** (singleton; null clears) through the full
  graph closure: apply deep-copies, inverse restores the previous
  polygon (or the no-outline state), diff gains
  pcbView.outlineChanged, merge replays theirs-only outline changes
  (ours wins when both touched it), JSON round-trips, invariants
  check integer coordinates. The 100%-branch gate on the core held.
- **Gerber Edge.Cuts** (`exportEdgeCuts`): the outline as a Profile
  layer stroked at 0.1mm (the KiCad convention fabs expect); returns
  null when the design has no outline — an honest absence, not an
  empty file. Existing golden fixtures have no outline and stay
  byte-identical.

### Honest cuts (substrate-first, like buses+sheets)
- No outline drawing tool, renderer display, or DRC copper-to-edge
  check yet — listed on the ROADMAP; panelization now has its
  prerequisite.

### Verified
- 6 graph closure tests (set/reshape/clear, inverse round-trip both
  ways, diff both directions, merge set/clear/ours-wins, JSON,
  invariants) + 1 export test (null absence, Profile header, closed
  stroke, byte determinism). Full test:packages green; goldens
  untouched; eslint 0 errors.

## 2026-06-11 — cascading shove

### Added
- **Cascading shove** (@protopulse/route): when a shove victim's
  detour is cornered (its endpoints swallowed by merged obstacle
  hulls), shovable traces overlapping its corridor AABB are recruited
  into the victim set and the whole plan re-runs — sequential
  cumulative planning keeps every round mutually consistent by
  construction. Rounds capped at MAX_CASCADE_ROUNDS=4; corridors that
  stay blocked after the cap refuse honestly. Stated trade-off: the
  corridor heuristic can over-shove a neighbor that didn't strictly
  need to move — safe churn, undone by spring-back.

### Verified
- New test: a victim walled into a channel between two long traces (a
  short crossing trace hits ONLY the victim) recruits both walls;
  all three reroute and the final configuration is verified mutually
  clear path-by-path. The single-level "nowhere to go" refusal test
  still blocks (endpoints inside the shover's own hull — no cascade
  can fix that). Full test:packages green; eslint 0 errors.

## 2026-06-11 — sim worker streaming: v0.2 complete

### Added
- **Batch progress streaming**: Monte Carlo and parameter-step runs
  stream one progress frame per completed deck from the sim worker;
  the Sim panel shows "Run 7/20 complete…" instead of a frozen
  spinner. Protocol: a `progress` frame per deck before the final
  reply, correlated by id; the client routes frames to an onProgress
  callback threaded from the panel through the cached runner.

### Honest scope
- Single-deck runs can't stream — ngspice-WASM runs a deck to
  completion; the boot message stays for those.

### Milestone
- **v0.2 (The Lab) is COMPLETE.** The two remaining ⬜ markers in the
  ROADMAP were stale (math channels/FFT/branch overlays and the
  AC-source emitter for graph-driven noise all landed earlier) — the
  section is reconciled and closed. v0.1 retains only its three
  M1 stragglers (pcbnew manual check, MSDF/GPU picking, ESP32-S3
  part).

### Verified
- 2 new tests: the pure worker handler emits exactly one frame per
  batch deck (none for single runs), and SimWorkerClient routes
  frames to onProgress while resolving the final batch once, over the
  real handler behind a shim worker. Full test:packages green;
  full-tree eslint 0 errors.

## 2026-06-11 — review decks + community rules: v0.3 complete

### Added
- **Versioned review decks**: runReview accepts a named deck that
  enables/disables checks and overrides severities (a deck states its
  DEVIATIONS — absent checks run at defaults). Reports now pin the
  deck name + rev ('builtin' when none). ReviewDeckSchema lives in
  @protopulse/content; content/review-decks/protopulse-standard.json
  is the no-deviation house deck and the template community decks
  copy.
- **Community-extensible rules**: extraChecks — pure functions over
  the public graph/parts types whose findings join the report as
  first-class citizens, configurable by the deck exactly like
  built-ins.

### Honest cut
- The ReviewPanel still runs the builtin deck; a deck-picker UI is
  later work.

### Milestone
- **v0.3 (The Crew) is COMPLETE**: six crew members, design review as
  a versioned artifact, three teaching depths, buses+sheets, and the
  88-article wiki.

### Verified
- 2 new review tests (deck disable + severity override + deck/rev
  pinning; a community no-electrolytics rule joins, sorts, and is
  deck-silenceable) + 1 content test (the standard deck parses and
  lists every built-in). Full test:packages green; full-tree eslint
  0 errors.

## 2026-06-11 — the Buyer: the crew is complete (6/6)

### Added
- **The Buyer** (`@protopulse/ai`): sixth and final crew member from
  the vision's roster. read_bom (lines grouped by part + canonical
  value, so 10k ≡ 10K), find_offers (by ref or partId+value),
  assign_sourcing (writes fields.lcsc/mpn as reviewable ops — the
  vision's "Buyer-proposed substitutions, each one a reviewable op";
  guards part/value mismatches and preserves existing fields), and
  sourcing_report (basic vs extended counts, unsourced refs — numbers
  about classes, never about money).
- **Sourcing catalog seed** (`content/catalog/jlc-assembly-seed.json`
  + CatalogSchema/loaders in @protopulse/content): 9 LCSC part
  numbers hand-verified against LCSC/JLCPCB product pages this
  session (findings + sources routed through inbox/ per the
  verification protocol). NO prices or stock by design — a static
  catalog quoting those would be lying within a week; the rev stamp
  and "verify at order time" note say so, and a test enforces that
  entries stay price-free.
- **Buyer tab** in the editor: Analyst-pattern live chat; assignments
  land as one undoable batch with meta {agent: 'buyer'}.

### Honest cuts
- Live vendor APIs ("in stock at JLC right now") are v0.6+
  manufacturing-pipeline work; two catalog classes are marked
  "assumed" pending confirmation; offer packages may differ from the
  design's generic footprints (0603 offers vs 0805 seeds) and the
  Buyer is told to surface that, not hide it.

### Verified
- 6 AI tests (tool guards + FakeProvider story: read → offers →
  assign to both 10k refs → report sees the working copy; confirm
  gate) and 2 content tests (real catalog parses, rev-stamped,
  price-free). Full test:packages green; full-tree eslint 0 errors;
  Buyer tab browser-verified.

## 2026-06-11 — Firmware-panel core picker

### Added
- The Firmware tab grew a **core** selector: ATmega328P (16 MHz) or
  RP2040 (125 MHz), applied at load time. The emu session rebuilds
  the core when the kind changes; a build missing the requested
  constructor errors as a value, not a crash. Serial monitor and the
  logic-analyzer traces work for both cores (RP2040 pins show as
  GP0…GP29). Honest note: co-sim bindings still speak AVR pin names.

### Verified
- New runner test: rp2040 selection constructs the other core,
  switching kinds rebuilds, missing-constructor builds error cleanly.
  Browser-verified: the picker renders both cores in the Firmware
  tab. 385 app tests green; typecheck + lint clean.

## 2026-06-11 — RP2040 core: the second MCU

### Added
- **Rp2040Core** (`@protopulse/emu`): the McuCore contract's second
  implementation, on wokwi's rp2040js (Cortex-M0+). GPIO pin events
  cycle-stamped off the real core counter; setPin drives pads (input
  levels survive reset — bench wiring, not machine state); PL011
  UART0 both directions; the SAR ADC consults the host sampler at
  12 bits against 3.3 V (the AVR core is 10-bit @ 5 V — each core
  states its own architecture's truth, PC in bytes vs words included).
- **thumb-asm.ts**: hand-assembler for the Thumb-16 subset the tests
  need (asm.ts's Cortex sibling, encodings from the ARMv6-M ARM) plus
  loadConst for 32-bit register constants.

### Honest cuts (stated in the adapter)
- Firmware images are raw Thumb entered at the flash base (no
  bootrom/boot2/UF2); ADC conversions complete instantly instead of
  after the silicon's ~2 µs; reset = rebuild (rp2040js has no full
  power-on reset); engine-level only — the Firmware panel still
  drives the AVR until a core picker lands.

### Verified
- 7 tests, all real hand-assembled firmware against real RP2040
  registers: GP25 blink (cycle-stamped alternation), GP2→GP25 input
  mirror through SIO+PADS, UART TX, full UART echo (firmware enables
  the PL011 and echoes a fed byte), ADC start→READY-poll→RESULT→UART
  round trip through the sampler, reset/firmware-survival, guards.
  Full test:packages green; full-tree eslint 0 errors.

## 2026-06-11 — sync relay round 2: persistence + auth

### Added
- **Room persistence** (`PP_RELAY_DATA`): rooms append to one JSONL
  file each (append-only — the write story matches the op-log's
  accrue-only nature); a restarted relay re-seeds rooms from disk
  before any client rejoins. Crash-safe by format: appends lead with
  a newline so a cut-short write isolates as one skippable line — a
  bug the restart test caught (a partial tail used to swallow the
  next record). The relay still never owns designs.
- **Shared-token auth** (`PP_RELAY_TOKEN`): when set, joins must carry
  the token; rejected joins get an explicit unauthorized error and the
  socket closes. The Sync panel grew a token field, and the client
  treats relay-level errors as terminal — no retry storm against a
  closed door.

### Honest cut
- Branch sync remains open (ROADMAP): non-main branches stay local.

### Verified
- 2 new relay tests (token gate incl. no-room-leak on rejection;
  rooms survive a relay restart with a corrupt-tail file) + 1
  end-to-end client test against a real token-gated relay (wrong
  token errors without reconnect-looping; right token syncs). Full
  test:packages green; full-tree eslint 0 errors.

## 2026-06-11 — thermal reliefs

### Added
- **Thermal reliefs on zone pours**: zones carry `connect: solid |
  thermal` (optional, absent = solid) through the full graph closure —
  apply/inverse/merge/serialize all preserve it, the 100%-branch gate
  on the core held. Thermal pours carve an annular gap (pad inflated
  by the pour clearance) around every same-net pad, bridged by 4
  orthogonal spokes (default width 0.4mm, a solderability convention)
  — computePour returns a reliefs count and the notch geometry is
  exact-area tested. Same-net traces and vias stay solid-connect; the
  honest cut is stated in the code, the wiki, and here.
- **Zone Inspector**: selecting a zone now shows net/layer/corners and
  a solid|thermal toggle — switching styles lands as ONE undoable
  batch (remove + re-place under the same id; selection survives).
- Obstacles now carry their copper kind (trace/via/pad) — the pour
  partitions same-net pads from same-net track without label-parsing.

### Verified
- 2 new pour tests (exact notch area vs the solid pour; traces/vias
  unaffected), 1 graph closure test (connect through apply, inverse,
  merge replay, JSON). Browser-verified: thermal pour renders the 4
  corner notches; Inspector toggle flips solid↔thermal as one batch
  with live re-pour. Gerber goldens byte-identical (solid default).
  Full test:packages green; full-tree eslint 0 errors.
- The zones-and-thermal-reliefs wiki article's "See it" updated — it
  honestly claimed reliefs didn't exist; now it honestly claims they
  do.

## 2026-06-11 — concepts wiki complete: 88/88

### Added
- **Final PCB tranche (12 articles)**: return-paths, loop-area,
  trace-width-vs-current, vias-thermal-and-signal,
  zones-and-thermal-reliefs, courtyards, annular-rings,
  silk-discipline, stackup-basics, diff-pairs-at-hobby-scale,
  acid-traps, panelization. The Vol III §2 seed list (88 articles,
  nine categories) is complete. "See it" sections stay honest about
  today's editor: solid-connect zones (no thermal reliefs yet), no
  diff-pair mode, no panelization, 2-layer only.
- **drcCodes frontmatter** (optional): PCB articles can claim the DRC
  codes that deep-link to them, mirroring ercCodes. Validation is
  bidirectional and lives in @protopulse/drc (content can't depend on
  drc without a cycle): every DRC code maps to a real article, every
  drcCodes claim is a real DRC code.

### Changed
- DRC codes re-pointed from placeholder fundamentals slugs to the real
  PCB articles: DRC-TRACE-WIDTH → trace-width-vs-current, DRC-ANNULAR
  and DRC-DRILL → annular-rings, DRC-ZONE-OVERLAP and
  DRC-ZONE-ISOLATED → zones-and-thermal-reliefs. (DRC-CLEARANCE stays
  on tolerance-stacking — the honest home; the seed list has no
  dedicated clearance article.)

### Verified
- Content tests now require the pcb category, ≥88 articles, and all
  12 PCB block slugs; the drc concept-mapping test scans the whole
  wiki (was: fundamentals only). Full test:packages green; full-tree
  eslint 0 errors.

## 2026-06-11 — the Architect: fifth crew member

### Added
- **The Architect** (`@protopulse/ai`): organizes designs on the shared
  agent loop — read_structure (sheet tree + buses + unbussed nets +
  root components), create_bus (named bus over nets BY NAME, whole-call
  failure on unknowns), create_sheet (add_sheet + interface ports +
  component moves in one call, parents resolved by name), and
  move_components (onto a sheet or back to the root). Unlike the
  Analyst (injected sim) and the Router (injected routing stack), its
  tools need NO host hooks — buses and sheets are graph entities, so
  the agent loop's working copy is the whole substrate. The purest
  proof yet of "once the substrate exists, a crew member is an
  assembly job".
- **Architect tab** in the editor: same live-chat shape as the
  Analyst/Router; structure lands in the session as one undoable batch
  with meta {agent: 'architect'} — blameable and syncable like any
  edit.

### Fixed
- Renderer scene tests: the hand-rolled mock graph lacked the `sheets`
  map the buses+sheets diff now iterates — 8 latent failures on main,
  green again.

### Verified
- 6 new AI tests (tool registry + FakeProvider end-to-end story:
  read → bus POWER → sheet PSU with interface → verify on the working
  copy; confirm-gate honored). 116 AI / 99 renderer / 383 app tests
  green; typecheck + lint clean; tab browser-verified.

## 2026-06-11 — buses + sheets in the graph core; wiki at 76/88

### Added
- **Buses + sheets** (the Architect's substrate, Vol II §A.5): the
  vision's five ops — create_bus, assign_to_bus, add_sheet,
  set_sheet_interface, move_to_sheet — plus remove_bus/remove_sheet
  (the inverse algebra demands them; zones set the precedent). Full
  closure: bidirectional bus membership maintained through assign/GC/
  merge_nets; sheet interface ports GC with their nets and re-point on
  merges; occupied sheets refuse removal; component sheetId rides the
  component prop deltas so diff/merge get sheet moves for free
  (replayed as move_to_sheet, deferred until theirs-added sheets
  exist — an op-ordering bug a closure test caught). Invariants:
  bidirectional membership, parent existence + cycle walk, binding
  existence. Serialization back-compatible.
- **Concepts wiki 63 → 76**: analog-sensing/ (9 — ADC reference
  quality through aliasing) and practice/ (4 — abs-max ratings,
  footprint choices, ESD truth vs ritual, asking good debugging
  questions). One tranche left: PCB (12), completing the 88.

### Verified
- 30 new graph tests; the 100%-branch gate on ops/apply/materialize/
  diff HELD (all four at 100/100/100/100); 189 graph + 21 content +
  383 app tests green; typecheck + lint clean.

## 2026-06-11 — copper zones, end to end

### Added
- **Zones/pours in four gated phases.** The graph stores INTENT (an
  outline polygon for one net on one layer, optional clearance
  override); the pour — outline minus foreign copper at clearance — is
  derived everywhere it's needed. place_zone/remove_zone close fully
  (apply/GC/inverse/diff/merge/invariants/serialize; the coverage gate
  caught merge_nets not re-pointing zones to the survivor).
  computePour (@protopulse/route): martinez boolean geometry, integer-
  nm boundary, square-corner keep-outs (conservative by construction),
  same-net copper left in the fill — that's how a zone connects.
- **On screen + in hand**: pours render as dimmed copper UNDER traces/
  pads (outline-only until the deck clearance loads — never a guess;
  the scene rebuilds the moment clearance arrives), and the Zone tool
  draws them (pad click seeds the net, corners snap, first-corner
  click closes).
- **DRC**: DRC-ZONE-OVERLAP (different-net zones overlapping pour
  overlapping copper — a short) and DRC-ZONE-ISOLATED (no same-net
  copper inside the outline — an island), both wiki-mapped.
- **Gerber**: zone pours emit as G36/G37 regions, holes via LPC/LPD
  polarity restored before the dark copper draws on top. Frozen in the
  new `zoned-led` golden fixture; every pre-zone fixture stayed
  byte-identical.
- Honest cuts stated where they live: solid connects (thermal reliefs
  are a later slice), square-corner keep-outs.

### Verified
- Pour math by analytic area to the nanometer; 36 DRC tests; golden
  29/29; browser-verified: the zoned-led pour fills with clearance
  moats around every piece of foreign copper, and DRC reports clean.

## 2026-06-11 — failure puzzle #1: the bus that never reads high

### Added
- **The failure-puzzle system** (Vol III §1.4): a broken design + a
  symptom + the instruments; solved when you ANNOTATE the actual
  root-cause net/component on the schematic — solved-ness is a property
  of the design's own op-log (annotate ops), not a quiz UI. PuzzleSchema
  in @protopulse/content, puzzles ship as content/puzzles/<id>/
  {puzzle.json, design.ppx.json}, Puzzles tab in the editor (symptom,
  suggested instruments, progressive hints, mark-selection-as-root-
  cause, explanation revealed on solve; wrong marks stay in history —
  debugging leaves tracks).
- **slow-rise-11** from the catalog: an open-collector bus whose 100k
  pull-up against ~10nF of bus capacitance (τ ≈ 1ms) never reaches a
  valid high between driver pulses. ERC passes — the bug is legal
  electricity with wrong values; the transient tells the story.

### Verified
- The puzzle premise is PHYSICS-TESTED in real ngspice: the broken bus
  peaks <2.5V in steady state; swapping the pull-up to 4.7k puts it
  >3.5V. Schema/anchor/ERC/checker tests alongside. Browser-verified
  end-to-end: load → hint → select R1 on canvas → mark → ✔ solved.

## 2026-06-11 — the Router: fourth crew member

### Added
- **The Router** (`runRouter` in @protopulse/ai + Router tab in the
  editor): copper is geometry, clearance is law, the ratsnest is a
  to-do list. Four tools — read_board (placements/traces/ratsnest
  digest), route_connection (walk-first; shove when walk reports no
  corridor; refusals surface as tool errors the model adapts to),
  run_drc, remove_trace. Engines are dependency-injected (RouterHooks,
  pinned like sim-types): the app wires the REAL walkaround/shove/DRC
  stack — the same machinery the human trace tool drives.
- Routes apply to a working copy inside the loop (Draftsman pattern);
  on completion they land in the session as ONE undoable batch with
  meta {agent: 'router'} — blameable and syncable like any edit.
- Ratsnest segments now carry their endpoint port refs (aPort/bPort),
  so airwires can be named ("R1:2 → R2:1") by every consumer.

### Verified
- 5 ai tests (FakeProvider end-to-end: read → walk refusal → shove →
  DRC-clean on the working copy; destructive confirm gate) + 5 app
  host tests over the REAL engines (labeled ratsnest, walk routes
  emptying the ratsnest, shove with victim ops, deck-loading refusal,
  real DRC findings). Live Anthropic runs need Tyler's key (same as
  Analyst/Professor).

## 2026-06-11 — CI circuit badges

### Added
- `protopulse check --badge <file>`: a shields-style SVG of the check
  result — green "ERC clean", amber "clean · N warnings", red
  "N errors" or "corrupt log". Deterministic by construction (flat
  per-char text metrics, no timestamps) and honest by design: the
  badge writes even when the same run fails the pipeline, so a
  hardware repo's README always shows the truth. Real artifact for the
  555 fixture committed at docs/badges/ and embedded in
  packages/README.

## 2026-06-11 — the sync relay: real-time collaboration

### Added
- **`@protopulse/relay`**: a tiny in-memory WebSocket room server. One
  room = one shared op-log; the relay unions envelopes by (actor,
  lamport) and broadcasts the news — it never interprets ops and never
  resolves conflicts, because materialize's (lamport, actorId) total
  order makes same-set ⇒ same-graph. Schema-validated frames, batch/
  message caps, rooms survive everyone leaving. `npm run -w
  @protopulse/relay dev` → ws://localhost:8787.
- **Sync tab in the editor**: connect to a relay room and edits flow
  both ways live. Joining sends your log, the snapshot brings theirs,
  every local dispatch pushes deltas; remote ops ingest without
  touching the undo stack (you can't undo someone else's edit — your
  own undos sync as inverse ops). SessionCore grew `ingest` (dedupe +
  lamport clock advance).
- Honest v1 notes shipped in the panel itself: main branch only,
  in-memory rooms, one tab per design per browser profile.

### Verified
- 6 relay tests (snapshot/union/dedupe/peers/validation/room
  persistence) + 4 app integration tests running TWO REAL session
  stores through a real in-process relay over Node's native WebSocket —
  bidirectional edits, concurrent-edit convergence, undo propagation.
- Two-browser live demo: an empty editor joined a room and received
  the full design; an edit in browser A appeared on browser B's canvas
  within a second.

## 2026-06-10 — shove + spring-back routing (E.1 steps 2–3)

### Added
- **Shove mode** on the PCB trace tool: the new trace goes where you
  drew it; different-net traces in the way are re-routed around it by
  the walkaround engine (`planShove` in @protopulse/route) — victims
  plan sequentially with cumulative obstacle insertion so the final
  configuration is mutually clear by construction. Hull-cluster merging
  makes detours around shover-touching pads possible. Honest cuts:
  pads/vias never move, victims re-route end-to-end, single-level shove
  (cascades refuse with a reason).
- **Spring-back**: deleting the shover restores its victims to their
  pre-shove paths — read straight from the op-log (shove commits are
  batches labeled 'shove'). A victim only springs back if the user
  hasn't re-routed it since AND the original path is still
  clearance-legal. Rides in the same delete batch, so undo is atomic.
- The 'manual | walk | shove' mode chips on the trace toolbar — and the
  walk mode is now actually wired to the tool (the engine landed in the
  v0.4 slice; the toggle claim preceded the wiring — debt paid).

### Verified
- 11 new engine tests + 4 tool tests + 6 spring-back tests; browser
  end-to-end: shove flashed "Shoved 1 trace(s) aside" with the victim
  visibly detouring, deleting the shover restored its straight path.

## 2026-06-10 — sim ghost overlay (voltages painted on the wires)

### Added
- **Canvas ghost**: after an op or transient run, every net on the
  schematic tints by its solved voltage — cold blue at the range floor,
  warm orange at the ceiling — with a gradient legend (instant label +
  min/max) in the Sim panel and a hide button. Honesty built in: only
  op/tran produce a ghost (AC/noise/sweeps have no single per-net
  voltage), and the ghost carries a (branch, opsVersion) stamp — edit
  anything and it vanishes instead of lying. Renderer grew a generic
  per-node `tint` overlay channel (lowest priority, under selection/
  highlight/diff).

## 2026-06-10 — blame on canvas (the op-log trilogy completes)

### Added
- **History (blame) in the Inspector**: select any component or net and
  see every op that ever touched it — who (actor), when (timestamp),
  what (op summary, batch-aware), and why (meta.rationale on AI/fix
  ops, agent chip included). Click an entry to time-travel to that
  exact moment in the History tab. Pure op-log filter (`blameFor`) —
  no new state, the envelopes always had the answers. With replay
  (watch history), merge (combine histories), and blame (interrogate
  history), the op-log thesis is now fully user-facing.

## 2026-06-10 — serverless share links (v0.6 first slice, early)

### Added
- **Copy share link** in the Export panel: the whole DesignBundle —
  op-log, branches and all — deflate-compressed (native
  CompressionStream, no deps) and base64url-encoded into the URL
  fragment. No server, no upload; the fragment never leaves the
  browser. Receiving end loads after a confirm guard (never silently
  replaces a working design; empty sessions load directly) and strips
  the hash. Browser-verified: the 67-op traffic-light-555 travels as a
  2,129-char URL and lands intact in a pristine browser.

## 2026-06-10 — interactive merge resolver (M1 straggler closed)

### Added
- **Merge in the Branches panel**: any branch merges into the current
  one. Engine half in `@protopulse/graph`: `BranchLog.mergeBaseOps`
  (nearest-common-ancestor prefix across forks, siblings, nested
  branches) and `resolveConflict` (one conflict + one ours/theirs pick →
  ops; returns null for picks M1 cannot express, so the UI disables
  them instead of lying). UI half: auto-merged changes listed, every
  conflict an explicit pick, Apply gated until all are decided; the
  merge lands as ONE undoable batch with `parents: [ours, theirs]`
  recorded in the op-log. Verified end-to-end in the browser: forked
  value conflict (47k vs 1k) surfaced, resolved theirs, landed.
- 17 new tests (engine merge-base topologies + every resolveConflict
  path; store merge workflow incl. stale-merge invalidation); graph
  coverage gate held.

## 2026-06-10 — time-lapse replay (History tab) + demo media rig

### Added
- **History tab** in the new editor: time-lapse replay of the op-log.
  The design IS its op-log, so any moment is a prefix materialization —
  scrub the slider, press play (3 speeds), or click any op to jump.
  Every graph reader (canvas, Inspector) follows the scrub position;
  the session is read-only until "Back to live" (dispatch/undo/redo
  refuse, branch switches exit replay). Status bar shows ⏪ replay k/N.
- `describeOp` — one human-readable line per op kind for the History
  list (pure, payload-only; ops are self-contained by design).
- Demo media rig: `tools/screenshots/capture-gif.ts` (co-sim story →
  `cosim-demo.gif`) and `capture-replay-gif.ts` (the 555 fixture
  building itself via the real History scrubber → `replay-demo.gif`),
  encoded pure-JS (gifenc + pngjs) with global palette + inter-frame
  diff transparency. Embedded in README and USER_GUIDE §19.

## 2026-06-10 — walkaround routing + the Lab stragglers

### Added
- `@protopulse/route`: walkaround interactive routing (Vol II E.1 first
  slice) — obstacle hulls inflated by clearance+width, flatbush broad
  phase, CW/CCW corner walks with recursion cap; 'manual | walk' toggle
  on the PCB trace tool with blocked-corridor refusal. 39 tests.
- Sim worker (ngspice off the main thread, node fallback preserved),
  plot FFT (radix-2 + Hann over resampled windows, per-trace toggle,
  log-x dB spectrum plot), AC-capable battery/rail emitters via
  fields.ac — graph-driven .ac and .noise now run end-to-end.
- Seam fixes from the parallel build: distributive worker-request types,
  traceMode initializer, and the FFT spectrum plot actually rendered
  (the computation existed; the lint gate caught the missing render).

## 2026-06-10 — v0.5 third slice: the loop closes

### Added
- `@protopulse/emu`: ADC peripheral (datasheet-accurate 25/13-clock
  conversions, completion-time host sampler — the D.3 hard sync point),
  assembler grows CPI/branch opcodes; bang-bang firmware verified
  reacting to analog input. 69 emu tests.
- `@protopulse/cosim`: runCosimClosedLoop — conservative quantum loop
  with comparator-fed digital inputs (VIH/VIL + hysteresis), ADC
  sampling against the previous solve, and loudly-counted from-zero
  re-solves. THE closed-loop test passes: firmware charges an RC node
  through its own pin, reads it back, and regulates — sustained
  oscillation around its 2.5V threshold. 65 cosim tests.
- App: closed-loop mode in the Co-sim panel (input/ADC bindings,
  quantum field, re-solve/ADC-read honesty readout). 304 app tests.

### Known gaps (ROADMAP.md)
- WebSerial flashing (hardware required), RP2040/ESP32 cores, solver
  state continuity (currently O(quanta²) re-solves, counted honestly).

## 2026-06-10 — v0.5 second slice: the co-sim bus (the crown jewel, one way)

### Added
- `@protopulse/cosim`: firmware GPIO edges become PWL sources behind a
  series-Rout behavioral boundary, injected via sim's additive
  extraCards hook. The thesis test runs real avr8js blink firmware into
  a real ngspice RC low-pass: 0.94Vpp settled ripple measured vs ~0.9Vpp
  predicted. 31 tests.
- App: Co-sim panel — pin→net bindings, window/step controls, the Vol II
  D.3 slowdown-factor honesty readout, digital traces stacked above the
  analog response in one plot. Shared emu session with a documented
  suspend/reset borrow protocol. 36 new tests (app at 284).

### Known gaps (ROADMAP.md)
- Feedback direction (digital inputs + ADC hard sync), WebSerial
  flashing, RP2040/ESP32 cores.

## 2026-06-10 — v0.5 first slice: The Bridge — firmware in the loop

### Added
- `@protopulse/emu`: ATmega328P emulation on avr8js — McuCore contract,
  cycle-stamped GPIO events, UART queues, Intel-HEX parser, and a
  documented mini-assembler so tests assemble their own firmware (the
  blink test asserts real edges on B5 at ~1206-cycle spacing). 47 tests.
- App: Firmware panel — HEX load, frame-budgeted run/pause, serial
  monitor with input, stacked square-wave pin traces. 33 new tests.

### Known gaps (ROADMAP.md)
- Co-sim bus, WebSerial flashing, ADC + remaining peripherals,
  RP2040/ESP32 cores.

## 2026-06-10 — v0.4 second slice: fab outputs + board rendering truth

### Added
- `@protopulse/export`: Gerber X2 copper layers (integer-nm FSLAX46, no
  float arithmetic in emission), Excellon drill, pick-and-place CSV;
  routed-led golden fixture freezes all fab artifacts byte-exact.
- Renderer: GL triangle pipeline — filled pads, real stroked trace
  widths with round caps/joins, vias as annuli with background drills;
  PCB scene delta sync (identity-preserving); side-flip (F key +
  Inspector) with mirrored bottom rendering.

### Known gaps (ROADMAP.md)
- Push-and-shove routing, zones/pours, panelization.

## 2026-06-10 — v0.4 first slice: The Board

### Added
- Graph: PCB ops are live — place/move/unplace_footprint, route_trace,
  place_via, remove_trace/via as id-keyed entities with GC, inverse,
  diff, and merge support; 100% core coverage gate held.
- Parts: footprint model with generic IPC-class seeds (0805, SOT-23,
  DIP-8), explicitly unverified-until-per-MPN.
- `@protopulse/drc`: width/clearance/annular/drill/unrouted checks
  against the shipped JLC deck. 34 tests.
- App: PCB mode — unplaced tray, footprint placement with rotation,
  octilinear trace tool with cross-net refusal, vias, dashed ratsnest,
  layer toggle, DRC panel with deck rev. 63 new app/renderer tests.

### Known gaps (ROADMAP.md)
- Push-and-shove, stroked widths/filled pads, Gerber export, in-browser
  visual QA of PCB mode.

## 2026-06-10 — v0.3 first slice: Design Review + the Professor

### Added
- `@protopulse/review`: the Vol II G.4 Design Review — embedded ERC,
  decoupling-per-IC (executable 100nF fix), power-tree rollup,
  unverified-parts-in-load-bearing-roles, unwired ICs, DNP-killed rails;
  stored/diffable ReviewReport with opened/closed deltas. 40 tests;
  golden Probe fixture reviews with zero errors.
- The Professor — depth-adjustable crew member with lookup_concept /
  explain_finding grounded in the concepts wiki; ReviewPanel's
  per-finding "Ask the Professor" handoff seeds it with the finding.
- The three teaching depths (do-it/show-me/teach-me): persisted dial,
  apply-fix narration through the status bar, teach-me auto-opens the
  mapped concept article.

## 2026-06-10 — v0.2 second slice: Monte Carlo, stepping, noise, the 555 lives

### Added
- `@protopulse/sim`: seeded Monte Carlo (R 5% / C 20% / L 10% defaults,
  deterministic mulberry32, value-override netlists), parameter stepping,
  .noise analysis (engine verified; input source must carry an AC value),
  and the NE555 behavioral macromodel — hysteretic discharge switch +
  regenerative latch; the golden traffic-light fixture oscillates at
  0.719-0.720s measured vs 0.721s theory. 69 sim tests.
- App: math channels (safe parser — v(a)-v(b), db/abs/mag, complex-aware),
  branch overlay with dashed traces and dual fidelity bars, Monte Carlo
  spaghetti + step trace families, noise UI. 129 app tests.

### Known gaps (ROADMAP.md)
- Sim worker + streaming; plot FFT; AC-source emitter for graph-driven
  noise.

## 2026-06-10 — v0.2 first slice: The Lab is live

### Added
- `@protopulse/sim`: deterministic graph→SPICE netlist generation with the
  model-tier honesty system (spice/behavioral/stub + fidelity manifest),
  op/tran/dc/ac analyses, ngspice-WASM engine wrapper (eecircuit-engine,
  MIT). 48 tests including real-WASM integration against the golden
  led-resistor fixture.
- App: "Sim" panel (analysis picker, fidelity bar with tier chips, trace
  list) and a dependency-free canvas plot workspace (engineering-notation
  axes, crosshair readout, dB/log-x for AC).
- The Analyst — second crew member ("skeptical of everything until it's
  plotted"): run_simulation/measure/read_design tools, shared runAgentLoop
  extracted from the Draftsman, first live Anthropic-wired panel
  (localStorage key with plain-text warning).
- Verified in-browser: golden LED circuit simulated end-to-end (1008-point
  transient; v(led_a)≈2.2 V, loop ≈20 mA — physically correct).

### Known gaps (tracked in ROADMAP.md)
- Noise/Monte-Carlo/param-step analyses, sim worker + streaming, NE555
  model (stub), plot math channels/FFT/branch overlays.

## 2026-06-10 — Milestone 1: the engine redesign lands

The first milestone of the ground-up redesign ("the vision", three volumes) landed on branch `claude/protopulse-vision-geapzy`: a greenfield npm-workspaces monorepo at `packages/` (`@protopulse/*`), living alongside the legacy app (`client/ server/ shared/` — untouched, still the shipping product; it migrates onto the engine in later milestones).

### Added
- `@protopulse/graph` — the core: one canonical design graph; every mutation a typed op; the design IS its op-log (JSON Lines), graph as materialized view. Integer-nm coordinates, UUIDv7 entities, deterministic materialization by (lamport, actorId), inverse-op undo, O(1) branches, visual diff (GraphDelta), three-way merge with conflicts as data. On-disk `.ppx` directory or `.ppx.json` bundle (spec: `packages/graph/README.md`). 100% branch coverage gate in CI.
- `@protopulse/parts` — minimal part model (ERC electrical pin types, 1.27mm-grid symbols, provenance tiers); 17 seed parts, NE555 + BAT54S pin maps datasheet-verified.
- `@protopulse/erc` — 10×10 pin-conflict matrix + net rules (floating inputs, unpowered supplies, single-port nets, open-collector pull-up with an executable fix, current budgets); every finding code maps to a concepts-wiki article.
- `@protopulse/export` — deterministic KiCad legacy-E netlist + CSV BOM; byte-exact golden-file tests in `tools/golden/`.
- `@protopulse/cli` — `protopulse check` / `export`: headless ERC in CI ("CI for circuits"), exit codes 0/1/2.
- `@protopulse/renderer` — WebGL2 retained scene graph, flatbush picking, canvas-glyph-atlas text, nm→px camera with LOD.
- `@protopulse/app` — the new schematic editor (port 5174): place/wire (Manhattan routing), undo/redo, branch switcher with green/amber diff overlay, ERC panel with apply-fix + concept links, KiCad/BOM/bundle export, Draftsman panel.
- `@protopulse/ai` — provider-agnostic agent runtime: zod tool registry with scope slices, destructive-confirm gating, explain() narration, budgeted context assembly; the Draftsman agent (exactly 8 tools); Anthropic adapter (browser-direct, user key); every applied op carries `meta {agent, rationale}` for op-log blame.
- `@protopulse/content` + `content/` — JLCPCB 2-layer DRC rule deck, 14 concept articles, curriculum Track 1 "First Light" steps 01–05 (machine-checkable `erc: clean` goals).
- Root commands `npm run check:packages` / `npm run test:packages`; packages CI workflow (`.github/workflows/packages-ci.yml`); ESLint coverage of `packages/` (zero errors). 346 package tests.

### Known gaps (M1)
- KiCad pcbnew import of the golden netlists awaits one manual verification (`tools/golden/README.md`).
- Merge conflicts surface as data; no interactive resolver UI yet.
- MSDF text and GPU picking deferred; ESP32-S3 part deferred.

## [Unreleased]

### Added (Wave 140)
- Snapshot restore cascade engine — `analyzeSnapshotDomains`, `generateRestorePlan`, cross-domain warnings, 46 tests (BL-0568)
- PCB geometry bridge — `extractTraceGeometries`, `traceGeometryToPdnInput`/`SiInput` converters, 34 tests (BL-0561)
- GPU Monte Carlo engine — async init with 3-attempt retry, GPU/CPU dispatch, dispose lifecycle, 28 tests (BL-0550)
- ISR safety scanner — 8 ISR rules, `findIsrBodies`, `scanForIsrViolations`, 58 tests (BL-0413)
- Dependency resolver — `extractIncludes`, 57 known library headers, `resolveDependencies` with conflict detection, 42 tests (BL-0404)

### Added (Wave 139)
- BOM tolerance bridge — `parseTolerance`, `bomItemsToToleranceSpecs`, tolerance column added to `bom_items`, 26 tests (BL-0574)
- PCB thermal bridge — `PACKAGE_THERMAL_DB` 15 packages, `extractThermalComponents`, 30 tests (BL-0562)
- BOM back-annotation — `BackAnnotationManager` singleton, `findMatchingInstances`, `generateBomBackAnnotationPatch`, 38 tests (BL-0563)
- PCB back-annotation — `syncRefDesChange`, `syncPropertyChange`, 29 tests (BL-0559)
- Design reuse schematic snippets — `SnippetCircuitInstance`/`SnippetCircuitNet`, `prepareForPlacement` circuit ID remapping, 3 built-in snippets with circuit data, 60 tests (BL-0583)

### Fixed (Wave 139)
- Chat message ordering — `chat-context.tsx` now sorts messages ascending by ID

### Added (Waves 25-26)
- Design review commenting system — `CommentsPanel`, `design_comments` table, comments route (FG-12)
- Multi-model AI routing with design-phase awareness (IN-08)
- Interactive design tutorials — `TutorialMenu`, `TutorialOverlay`, tutorial context (IN-13)
- Backup/restore automation — backup route, scripts, runbook (CAPX-OPS-03)
- AC small-signal frequency analysis engine — MNA solver, 480 lines, 41 tests (FG-13)
- Project ownership model — `ownerId`, auth middleware, 20 tests (CAPX-SEC-01)
- Unified undo/redo stack — command pattern, React context, keyboard shortcuts, 36 tests (TD-25)
- ShapeCanvas decomposed from 1,275→755 lines into 6 extracted modules (TD-04)
- Theme picker panel with theme context
- SPICE import functionality
- Design history view and lifecycle dashboard
- Architecture snapshot diff engine (`shared/arch-diff.ts`)
- `design_snapshots` and `design_comments` tables (schema now 27 tables)

### Added (Waves 1-24)
- Architecture Decision Records (ADRs) in `docs/adr/`
- DRC manufacturer templates (JLCPCB, PCBWay, OSHPark) with pre-configured rules
- 5 new DRC rule types: annular-ring, thermal-relief, trace-to-edge, via-in-pad, solder-mask
- Session refresh/rotation mechanism for improved auth security
- Storage integration tests (67 tests covering cache, soft deletes, pagination, bulk ops)
- Auth session tests (18 tests covering token rotation)
- Shared test project in Vitest config (136 tests now running that were previously skipped)
- WCAG AA contrast ratio audit — all critical color pairs pass 4.5:1 minimum
- Collaboration roadmap re-sequenced behind identity/authorization foundation
- AI tool: `generate_test_plan` — fetches full project state for AI to write hardware test plans (FG-26)
- AI tool: `compare_components` — fetches BOM/architecture data for AI component comparison tables (FG-27)
- Dedicated ExportPanel component with 3 categories, 10 formats, per-format download state (UI-06)
- @dnd-kit drag-and-drop from component library to architecture canvas (IN-10)
- `component_lifecycle` table for tracking component lifecycle status, alternate parts, and data sources (FG-32)
- CRUD routes for component lifecycle at `/api/projects/:id/lifecycle` (FG-32)
- Netlist comparison engine in `shared/netlist-diff.ts` — diff two circuit netlists by component and net (FG-33)
- Netlist diff endpoint `POST /api/circuits/:circuitId/netlist-diff` with baseline comparison (FG-33)
- BOM Comparison tab in ProcurementView — Tabs layout with BOM Management + BOM Comparison/BomDiffPanel (UI-34)
- Net class management UI (`NetClassPanel.tsx`) — create/edit net classes with trace width, clearance, via diameter, color-coded badges (UI-14)
- JSDoc documentation across all 11 AI tool modules in `server/ai-tools/` (TD-29)
- AI tool: `suggest_components` — analyzes architecture/BOM/circuits for missing components across 9 categories (IN-05)
- AI tool: `design_review` — comprehensive design review across 7 categories with severity-rated findings (IN-18)
- X-Request-Id header on all HTTP responses with client-side error propagation (CAPX-OBS-04)
- Database transactions for `updateBomItem` and `updateComponentPart` preventing race conditions (CAPX-ARCH-02-EXP)
- Auth regression test suite — 92 tests covering 6 security implementations (CAPX-TEST-01)
- Storage transaction tests — 15 tests covering atomic BOM/component updates (CAPX-ARCH-02-EXP)

### Changed
- React.memo coverage increased to 29+ components across 24 files (from 9 initial)
- Export generators decomposed from 1,211-line monolith into 15 individual modules + types under `server/export/`
- `circuit-routes.ts` (1,804 lines) decomposed into 13 domain files under `server/circuit-routes/` (TD-16)
- `parseLocalIntent` (CCN=102) refactored to IntentHandler registry pattern with 11 handler modules (TD-05/EN-19)
- Test suite expanded from ~350 tests (Wave 1) to 1,553 tests across 54 files
- AI tool count increased from 53 to 82
- Database schema expanded from 11 to 27 tables
- Domain routers expanded from 18 to 21; circuit routers from 11 to 13
- ProcurementView refactored from single-panel to tabbed layout (BOM Management + BOM Comparison)

### Fixed
- DRCRuleType union extended to include all implemented rule types
- Various TypeScript strict mode compliance fixes across test files

## [0.1.0] - 2026-02-15

### Added
- Initial release: architecture block diagrams, BOM management, circuit schematic editor
- AI chat with 82 AI tools (Anthropic Claude + Google Gemini)
- Design validation (DRC/ERC)
- Multi-format export: KiCad, Eagle, SPICE, Gerber, drill, pick-and-place
- Dark theme with Neon Cyan accent

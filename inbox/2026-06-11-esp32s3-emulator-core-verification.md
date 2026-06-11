# ESP32-S3 emulator core v0 — verification findings

Verified 2026-06-11 for the `@protopulse/emu` Esp32s3Core (Xtensa LX7
interpreter subset). Two independent sources per fact.

## Xtensa ISA (24-bit core instructions, call0 ABI)

Sources:
1. Espressif "Overview of Xtensa ISA" PDF
   (dl.espressif.com/github_assets/espressif/xtensa-isa-doc) — format
   field layouts + per-instruction semantics.
2. pfalcon/ida-xtensa2 `xtensa.py` (a working disassembler) — exact
   opcode/mask constants, cross-checked against (1) and against
   known-good byte sequences from real objdump listings.

Field layout (24-bit, little-endian): op0=bits[3:0], t=[7:4], s=[11:8],
r=[15:12], op1=[19:16], op2=[23:20]. RRI8 imm8=[23:16]; RI16
imm16=[23:8]; BRI12 imm12=[23:12]; CALL offset18=[23:6].

Key semantics (from the ISA doc, garble-checked):
- Branches (RRI8/BRI12): taken PC ← PC + sext(imm) + 4; else PC += 3.
- J: PC ← PC + sext(offset18) + 4.
- CALL0: a0 ← PC+3; PC ← ((PC>>2) + sext(offset18) + 1) << 2.
- RET: PC ← a0 (encoding 0x000080).
- L32R: addr = ((PC+3) & ~3) + (one_extend(imm16) << 2) — always
  backward.
- MOVI at, imm12: register in t; imm12 = s||imm8 (verified against
  real bytes: `movi a2, 63` = 22 a0 3f).
- Loads/stores scale ZERO-extended offsets: L32I/S32I imm8<<2,
  L16UI/S16I imm8<<1, L8UI/S8I imm8. (The PDF's text extraction
  flattens these to "sign extend" — the RM and real encodings say
  zero-extend + scale; ADDI/ADDMI are the sign-extended ones.)
- SLLI encodes 32−sa in {op2[0], t}; SRLI sa in s; SRAI sa in
  {op2[0], s}; sources in s (SLLI) / t (SRLI, SRAI), dest in r.

Opcode constants used (from ida-xtensa2, masks honored):
L32R 0x000001, MOVI 0x00a002, ADDI 0x00c002, ADDMI 0x00d002,
ADD 0x800000, SUB 0xc00000, AND 0x100000, OR 0x200000, XOR 0x300000,
SLLI 0x010000, SRLI 0x410000, SRAI 0x210000, L32I 0x002002,
S32I 0x006002, L8UI 0x000002, S8I 0x004002, L16UI 0x001002,
S16I 0x005002, BEQ 0x001007, BNE 0x009007, BLT 0x002007,
BGE 0x00a007, BLTU 0x003007, BGEU 0x00b007, BEQZ 0x000016,
BNEZ 0x000056, J 0x000006, JX 0x0000a0, CALL0 0x000005,
CALLX0 0x0000c0, RET 0x000080, MEMW 0x0020c0, NOP 0x0020f0.

Honest cut: 16-bit code-density forms NOT implemented (the assembler
emits only 24-bit instructions); windowed-ABI instructions
(ENTRY/CALL8/RETW) not implemented — call0 ABI only.

## ESP32-S3 memory map + peripherals

Source: Espressif esp-idf v5.2 headers (the vendor's own code):
- `components/soc/esp32s3/include/soc/soc.h`:
  SOC_IRAM_LOW 0x40370000, SOC_IRAM_HIGH 0x403E0000;
  SOC_DRAM_LOW 0x3FC88000, SOC_DRAM_HIGH 0x3FD00000.
  (0x40378000 in IRAM aliases 0x3FC88000 in DRAM — same SRAM, two
  buses.)
- `components/soc/esp32s3/include/soc/reg_base.h`:
  DR_REG_GPIO_BASE 0x60004000, DR_REG_UART_BASE 0x60000000 (UART0).
- `components/soc/esp32s3/include/soc/gpio_reg.h` (offsets from base):
  OUT 0x04, OUT_W1TS 0x08, OUT_W1TC 0x0C, OUT1 0x10, OUT1_W1TS 0x14,
  OUT1_W1TC 0x18, ENABLE 0x20, ENABLE_W1TS 0x24, ENABLE_W1TC 0x28,
  ENABLE1 0x2C, ENABLE1_W1TS 0x30, ENABLE1_W1TC 0x34, IN 0x3C,
  IN1 0x40. (OUT covers GPIO0–31; OUT1 covers GPIO32–48.)
- `components/soc/esp32s3/include/soc/uart_reg.h`:
  UART_FIFO_REG +0x0 (RXFIFO_RD_BYTE [7:0]);
  UART_STATUS_REG +0x1C (RXFIFO_CNT [9:0], TXFIFO_CNT [25:16]).

Emulator cuts (stated in the core header): one 480 KB SRAM window
mapped at both 0x40378000 and 0x3FC88000 (no SRAM0/cache modeling),
single core, 1 instruction = 1 cycle at 240 MHz, raw-image loading
only (no bootloader/IDF app format), no interrupts.

## Addendum: 16-bit code-density instructions (slice 2)

Source: the full Cadence "Xtensa ISA Reference Manual" (per-instruction
pages), settling four details the Espressif overview's text extraction
garbled:

- MOV.N at, as → **AR[t] ← AR[s]** (dest in t — the overview's pseudo
  was transposed).
- MOVI.N as, -32..95 → register in **s**; imm7 = bits[6:4]‖bits[15:12];
  decoded by "sign-extending the 7-bit value with the logical AND of
  its two most significant bits" (range asymmetric because positive
  constants are more frequent).
- BEQZ.N/BNEZ.N → imm6 = bits[5:4]‖bits[15:12], **zero-extended,
  forward-only** (target = PC + imm6 + 4); bit7=1 marks RI6, bit6
  selects NEZ.
- ADDI.N ar, as, imm → imm encoded in t: **t=0 means -1**, else 1..15
  zero-extended.
- L32I.N/S32I.N at, as, 0..60 → imm4 in r, zero-extended << 2.
- op0=0xd subspace: r=0 → MOV.N; r=0xf with t=0 → RET.N, t=3 → NOP.N
  (RETW.N t=1 is windowed — refused); opcodes RET.N 0xf00d,
  NOP.N 0xf03d cross-checked against ida-xtensa2.

## Addendum: windowed-register option (slice 3)

Source: Cadence ISA RM §4.7.1 (Windowed Register Option) — the
mechanics are quoted verbatim in the RM:

- CALLn: WindowCheck(0,0,n); PS.CALLINC ← n; AR[4n] ← n‖(PC+3)[29:0].
- ENTRY s, imm12: AR[CALLINC·4+s] ← AR[s] − (imm12≪3); WindowBase +=
  CALLINC; WindowStart[WindowBase] ← 1. (Fixture: "entry a1, 32" =
  36 41 00.)
- RETW/RETW.N: n ← a0[31:30]; target = PC[31:30]‖a0[29:0]; frame-size
  validity check against the WindowStart bits below; WindowBase −= n;
  clear caller's WS bit; underflow when WS[new] is 0.
- WindowCheck fixpoint: spill the lowest live frame overlapping the
  referenced register group; retry.
- Spill/fill net effect (from the RM's reference handlers):
  a0..a3 → [nextFrame.sp − 16..−4]; for 8/12-sized frames, prevSP =
  [frame.sp − 12], a4..a7(..a11) → [prevSP − 32(−48)..−20]. The
  initial frame's [sp − 12] must be pre-initialized by crt0 (RM:
  "as if it had been written by a window overflow").
- ABI consequence verified the hard way: a call8-making function must
  ENTRY with frame ≥ 32 (16 base + 16 callee-extra) — an
  ENTRY a1,16 caller's extra save area overlaps its caller's base
  save area, which is precisely the bug the emulator surfaced in a
  first test draft.
- NAREG: ESP32-S3 configures 64 physical ARs (XCHAL_NUM_AREGS = 64 in
  esp-idf core-isa.h).

Emulator approach: MAGIC SPILL/FILL — the handlers' documented net
effect performed directly (same memory layout compiled code expects),
no exception machinery. Cuts: spill/fill costs no cycles; MOVSP and
the handler-only L32E/S32E/RFWO/RFWU refuse; PS not modeled.

## Addendum: exceptions + level-1 interrupts + core timer (slice 4)

Sources: Cadence ISA RM (SR table §5.3, EXCCAUSE table, Timer
Interrupt Option §4.4.6, RSIL/RSR/WSR/RFE instruction pages) +
esp-idf v5.2 `xtensa/config/core-isa.h` for the ESP32-S3 config.

- SR numbers: WINDOWBASE 72, WINDOWSTART 73, EPC1 177, EXCSAVE1 209
  (the RM index has a typo listing 192 — that is DEPC; EXCSAVE2..7 at
  210–215 confirms 209), INTERRUPT 226 (read) / INTSET 226 (write),
  INTCLEAR 227, INTENABLE 228, PS 230, VECBASE 231, EXCCAUSE 232,
  CCOUNT 234, CCOMPARE0..2 240–242.
- Encodings: RSR 0x030000|sr<<8|t<<4; WSR 0x130000|…; RSIL
  0x006000|level<<8|t<<4 (also reads PS into at); RFE 0x003000
  (PS.EXCM ← 0; PC ← EPC1).
- Timer: CCOUNT increments every cycle; CCOUNT = CCOMPARE[i] latches
  TIMERINT[i] until CCOMPARE[i] is written (RM: "timer interrupts are
  cleared by writing CCOMPARE").
- EXCCAUSE codes: 0 Illegal, 1 Syscall, 2 IFetchError, 3
  LoadStoreError, 4 Level1Interrupt, 5 Alloca.
- ESP32-S3 config (core-isa.h): XCHAL_TIMER0_INTERRUPT = 6 at level 1
  (XCHAL_INT6_LEVEL = 1); XCHAL_USER_VECOFS = 0x340; XCHAL_KERNEL_
  VECOFS = 0x300; XCHAL_VECBASE_RESET_VADDR = 0x40000000;
  XCHAL_NUM_AREGS = 64 (confirming slice 3); XCHAL_NUM_TIMERS = 3.

Emulator cuts: only the timer line (INT6) exists; level-1 only (no
medium/high-priority levels, no XSR/WAITI); PS gates via INTLEVEL +
EXCM, UM/WOE stored only; reset PS.INTLEVEL = 15 (conservative —
firmware lowers via RSIL); vectoring costs no cycles; VECBASE
alignment not enforced.

## Addendum: MOVSP + the ESP-IDF app-image format (slice 5)

MOVSP source: Cadence ISA RM instruction page —
- Encoding: RRR with op2=0, op1=0, r=1 → `0x001000 | s<<8 | t<<4`.
- Semantics: "if WindowStart[WindowBase−3..WindowBase−1] = 0 then
  Exception(AllocaCause) else AR[t] ← AR[s]".
- The RM's Alloca reference handler's net effect: move the 4-word base
  save area from [old AR[t] − 16..−4] to [new AR[s] − 16..−4], then
  perform the move. The emulator does that net effect directly (same
  magic-handler approach as spill/fill).

App-image format sources:
1. esp-idf v5.2 `components/bootloader_support/include/esp_app_format.h`:
   `esp_image_header_t` is 24 bytes — magic 0xE9 @0, segment_count @1,
   spi_mode/spi_speed+size @2..3, entry_addr u32le @4, chip_id u16le
   @12 (`ESP_CHIP_ID_ESP32S3 = 0x0009`), hash_appended @23; then
   segment_count × `esp_image_segment_header_t` (load_addr u32le,
   data_len u32le) + data; `ESP_IMAGE_MAX_SEGMENTS = 16`.
2. esptool (master) `loader.py` / image format docs:
   `ESP_CHECKSUM_MAGIC = 0xEF` — the checksum byte is the XOR of all
   segment data bytes seeded 0xEF, stored as the LAST byte of the
   16-byte-aligned image body (pad to 16 counting one checksum byte).
   If hash_appended = 1, a SHA-256 digest follows (the emulator skips
   verifying it).

Emulator cuts: only SRAM-resident segments load — flash-mapped
segments (0x42xxxxxx instruction / 0x3Cxxxxxx data buses) refuse with
a message because the flash cache is not modeled; the SHA-256 trailer
is not verified (the XOR checksum is); flash fields (spi_mode/speed/
size) are ignored.

## Addendum: peripheral interrupt lines through the matrix (slice 6)

Sources: esp-idf v5.2 headers + HAL (the vendor's own code), two
files per fact:

- Interrupt lines (xtensa/config/core-isa.h for ESP32-S3):
  XCHAL_INTLEVEL1_MASK = 0x000637FF; the level-1 LEVEL-triggered
  external lines are INT0–5, INT8–9, INT12–13, INT17–18 (INT6/15/16
  are timers, INT7/29 software, INT10/22/28/30 edge-triggered
  external, INT11 profiling, INT14 NMI).
- Interrupt matrix (soc/reg_base.h + soc/interrupt_core0_reg.h):
  DR_REG_INTERRUPT_BASE 0x600C2000; each peripheral source has a
  5-bit map register selecting its CPU line, reset value 16.
  INTERRUPT_CORE0_GPIO_INTERRUPT_PRO_MAP_REG at +0x040;
  INTERRUPT_CORE0_UART_INTR_MAP_REG at +0x06C.
- GPIO interrupts (soc/gpio_reg.h + hal/esp32s3/gpio_ll.h +
  hal/gpio_types.h): GPIO_STATUS_REG 0x44 (W1TS 0x48, W1TC 0x4C),
  STATUS1 0x50/0x54/0x58; GPIO_PINn_REG at 0x74 + 4·n with INT_TYPE
  bits [9:7] and INT_ENA bits [17:13]. gpio_ll_set_intr_type writes
  gpio_int_type_t verbatim: 0 disable, 1 posedge, 2 negedge,
  3 anyedge, 4 low level, 5 high level. GPIO_LL_INTR_ENA = BIT(0) of
  the INT_ENA field (bit 13) — "on ESP32S3, pro cpu and app cpu
  shares the same interrupt enable bit".
- UART interrupts (soc/uart_reg.h): UART_INT_RAW_REG 0x04,
  INT_ST 0x08, INT_ENA 0x0C, INT_CLR 0x10; RXFIFO_FULL_INT bit 0,
  TX_DONE_INT bit 14; UART_CONF1_REG 0x24 with RXFIFO_FULL_THRHD
  bits [9:0], reset 96.

Emulator approach: the SoC recomputes its two modeled sources (GPIO,
UART0) whenever their inputs change and drives the CPU's
level-triggered external lines via setExtInt (masked to the level-1
external lines; INTCLEAR cannot clear them, per the RM). Cuts: only
the GPIO and UART0 sources exist (map writes for other sources are
accepted and dropped); RXFIFO_FULL is condition-derived, so INT_CLR
on it has no lasting effect unless the FIFO is drained; level-type
GPIO STATUS bits re-evaluate on pin/config/W1TC activity rather than
continuously; TIMG and the other UART instances are not modeled.

## Addendum: SAR ADC1 oneshot (slice 7)

Sources: esp-idf v5.2 `soc/esp32s3/include/soc/sens_reg.h` +
`hal/esp32s3/include/hal/adc_ll.h` (the flow the oneshot driver and
analogRead actually perform) + `soc/reg_base.h` + `soc/adc_channel.h`.

- DR_REG_SENS_BASE = 0x60008800; SENS_SAR_MEAS1_CTRL2_REG at +0xC.
- Fields: MEAS1_DATA_SAR [15:0] (valid width 12 bits, masked 0xFFF by
  the HAL), MEAS1_DONE_SAR bit 16, MEAS1_START_SAR bit 17,
  MEAS1_START_FORCE bit 18, SAR1_EN_PAD [30:19] (one-hot — the HAL
  writes `1 << channel`), SAR1_EN_PAD_FORCE bit 31.
- Flow (adc_oneshot_ll_*): set both force bits for SW control, write
  the one-hot channel, pulse MEAS1_START_SAR low→high (the 0→1 edge
  starts the conversion), poll MEAS1_DONE_SAR, read MEAS1_DATA_SAR.
- Channel→pin (adc_channel.h): ADC1 channel n = GPIO n+1 (channels
  0–9 → GPIO1–10); ADC2 channels 0–9 → GPIO11–20.

Emulator cuts: conversions complete instantly (no SAR clock timing);
attenuation is not modeled — quantization is
clamp(round(volts / 3.3 × 4095), 0, 4095) like the RP2040 core;
ADC2 and the APB_SARADC DMA mode are not modeled; the co-sim sampler
surface (setAdcSampler / drainAdcReads) follows the McuCore contract,
sampler surviving reset as bench wiring.

## Addendum: TIMG0 timer 0 (slice 8)

Sources: esp-idf v5.2 `soc/esp32s3/include/soc/timer_group_reg.h`,
`hal/esp32s3/include/hal/timer_ll.h`, the gptimer driver
(`components/driver/gptimer/gptimer.c`), `soc.h`, and
`interrupt_core0_reg.h`:

- DR_REG_TIMERGROUP0_BASE = 0x6001F000 (TIMG1 at 0x60020000). The S3
  group has two general-purpose timers (T0/T1) plus a watchdog.
- T0 registers: T0CONFIG 0x00 (EN bit 31, INCREASE bit 30,
  AUTORELOAD bit 29, DIVIDER [28:13], ALARM_EN bit 10), T0LO 0x04,
  T0HI 0x08, T0UPDATE 0x0C, T0ALARMLO 0x10, T0ALARMHI 0x14,
  T0LOADLO 0x18, T0LOADHI 0x1C, T0LOAD 0x20; INT_ENA 0x70,
  INT_RAW 0x74, INT_ST 0x78, INT_CLR 0x7C with T0 at bit 0.
- Divider semantics (timer_ll.h): the HAL asserts 2..65536 and
  writes 65536 as field value 0 — so field 0 means ÷65536.
- Clock: APB at 80 MHz (soc.h APB_CLK_FREQ = 80·10⁶); at the modeled
  240 MHz CPU that is 3 CPU cycles per APB tick.
- Reads: trigger a capture via T0UPDATE, poll the update bit clear,
  then read LO/HI (timer_ll_trigger_soft_capture).
- Alarm: "when alarm event happens, the alarm will be disabled
  automatically by hardware" (gptimer.c) — the ISR clears INT via
  INT_CLR and re-enables the alarm for periodic/autoreload use.
- Interrupt source map: INTERRUPT_CORE0_TG_T0_INT_MAP_REG at +0x0C8
  from the matrix base (reset 16, like all map registers).

Emulator approach: the counter is virtual — value derives from
elapsed CPU cycles (no per-cycle bookkeeping); the alarm comparator
runs after every instruction while EN+ALARM_EN are set. Cuts: TIMG0
T0 only (no T1, no TIMG1, no watchdogs); APB clock source only (no
XTAL); UPDATE captures instantly (the update bit always reads 0);
54-bit wrap handled with float-safe modulo (the ulp at 2^54 is 4 —
caught by the first test draft when (x%M+M)%M rounded 2 to 0).

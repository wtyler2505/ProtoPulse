---
description: ESP32-S3 emulator reference — aliased SRAM windows, IROM/DROM flash-cache ranges, and GPIO/UART/SENS/TIMG/interrupt-matrix register bases
type: reference
confidence: verified
audience: [expert]
created: 2026-06-23
topics:
  - esp32-s3
  - emulation
provenance:
  source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  verified: 2026-06-23
  reliability: high
---

# ESP32-S3 memory map and peripheral register reference

The ESP32-S3 emulator core needs a fixed map of where memory and peripherals live. These constants come straight from Espressif's esp-idf v5.2 headers (the vendor's own source) — `soc.h`, `reg_base.h`, `ext_mem_defs.h`, and the per-peripheral `*_reg.h` files. Consolidated here as one retrievable table rather than fragmented into trivial atomic notes. Every value below is a transcribed constant from a named header; none are invented or extrapolated.

## Memory map

The Xtensa LX7 exposes the same physical SRAM on two buses — an instruction (IRAM) address and a data (DRAM) address — so an emulator can back both ranges with one storage array (see [[the-esp32-s3-maps-one-sram-block-at-both-an-iram-and-a-dram-address-so-an-emulator-can-model-it-as-a-single-window-aliased-to-two-bus-addresses]]). Flash content reached through the cache appears in separate IROM/DROM windows (see [[flash-mapped-irom-and-drom-segments-carry-post-mapping-virtual-addresses-so-an-emulator-serves-them-read-only-straight-from-the-image]]). These region boundaries are exactly what the app-image loader keys on: [[an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones|it copies segments whose `load_addr` lands in the SRAM window and refuses those on the 0x42xxxxxx/0x3Cxxxxxx flash buses]].

| Region | Low | High | Bus / notes |
|---|---|---|---|
| SRAM (IRAM view) | `0x40370000` | `0x403E0000` | `SOC_IRAM_LOW`/`_HIGH` (instruction bus) |
| SRAM (DRAM view) | `0x3FC88000` | `0x3FD00000` | `SOC_DRAM_LOW`/`_HIGH` (data bus) |
| IROM (flash cache, instruction) | `0x42000000` | `0x44000000` | `SOC_IROM_LOW`/`_HIGH` = `SOC_IRAM0_CACHE_ADDRESS_LOW`/`_HIGH` |
| DROM (flash cache, data) | `0x3C000000` | `0x3E000000` | `SOC_DROM_LOW`/`_HIGH` = `SOC_DRAM0_CACHE_ADDRESS_LOW`/`_HIGH` |

SRAM aliasing example (from `soc.h`): `0x40378000` on the IRAM bus is the same physical SRAM as `0x3FC88000` on the DRAM bus. The emulator models a single 480 KB window mapped at both `0x40378000` and `0x3FC88000`.

## Peripheral register bases

Base addresses from `reg_base.h` (and `ext_mem_defs.h` for the cache windows above).

| Peripheral | Base | Header constant |
|---|---|---|
| UART0 | `0x60000000` | `DR_REG_UART_BASE` |
| GPIO | `0x60004000` | `DR_REG_GPIO_BASE` |
| SENS / SAR-ADC | `0x60008800` | `DR_REG_SENS_BASE` |
| TIMG0 | `0x6001F000` | `DR_REG_TIMERGROUP0_BASE` (TIMG1 at `0x60020000`) |
| Interrupt matrix | `0x600C2000` | `DR_REG_INTERRUPT_BASE` |

## GPIO register offsets (`gpio_reg.h`)

Offsets from `DR_REG_GPIO_BASE`. `OUT` covers GPIO0–31; `OUT1` covers GPIO32–48.

| Reg | Offset | Reg | Offset |
|---|---|---|---|
| OUT | `0x04` | ENABLE1 | `0x2C` |
| OUT_W1TS | `0x08` | ENABLE1_W1TS | `0x30` |
| OUT_W1TC | `0x0C` | ENABLE1_W1TC | `0x34` |
| OUT1 | `0x10` | IN | `0x3C` |
| OUT1_W1TS | `0x14` | IN1 | `0x40` |
| OUT1_W1TC | `0x18` | STATUS | `0x44` |
| ENABLE | `0x20` | STATUS_W1TS | `0x48` |
| ENABLE_W1TS | `0x24` | STATUS_W1TC | `0x4C` |
| ENABLE_W1TC | `0x28` | STATUS1 | `0x50` (W1TS `0x54`, W1TC `0x58`) |

`GPIO_PINn_REG` at `0x74 + 4·n`: `INT_TYPE` bits [9:7], `INT_ENA` bits [17:13]. Interrupt types (`gpio_int_type_t`, written verbatim): 0 disable, 1 posedge, 2 negedge, 3 anyedge, 4 low level, 5 high level. `GPIO_LL_INTR_ENA` = bit 13 (pro and app CPU share the same enable bit on S3). The behavioral read of these registers: [[condition-derived-level-interrupts-cannot-be-cleared-by-intclear-until-the-underlying-condition-clears|for the level types (4/5) the emulator derives `STATUS` from the live pin and treats `STATUS_W1TC` / the UART `INT_CLR` row below as a no-op while the condition holds]] — clearing only when the pin level changes or the RX FIFO drains below `RXFIFO_FULL_THRHD` (CONF1).

## UART register offsets (`uart_reg.h`)

| Reg | Offset | Fields |
|---|---|---|
| FIFO | `0x00` | RXFIFO_RD_BYTE [7:0] |
| INT_RAW | `0x04` | RXFIFO_FULL_INT bit 0, TX_DONE_INT bit 14 |
| INT_ST | `0x08` | |
| INT_ENA | `0x0C` | |
| INT_CLR | `0x10` | |
| STATUS | `0x1C` | RXFIFO_CNT [9:0], TXFIFO_CNT [25:16] |
| CONF1 | `0x24` | RXFIFO_FULL_THRHD [9:0], reset 96 |

## SENS / SAR-ADC1 (`sens_reg.h`)

`SENS_SAR_MEAS1_CTRL2_REG` at `DR_REG_SENS_BASE + 0x0C`:

| Field | Bits |
|---|---|
| MEAS1_DATA_SAR | [15:0] (12-bit valid, masked `0xFFF`) |
| MEAS1_DONE_SAR | bit 16 |
| MEAS1_START_SAR | bit 17 (0→1 edge starts conversion) |
| MEAS1_START_FORCE | bit 18 |
| SAR1_EN_PAD | [30:19] (one-hot `1 << channel`) |
| SAR1_EN_PAD_FORCE | bit 31 |

Channel→pin: [[esp32-s3-adc1-channel-n-reads-gpio-n-plus-1-so-an-emulator-resolves-analog-reads-to-the-correct-bench-pin|ADC1 channel n = GPIO n+1 (channels 0–9 → GPIO1–10); ADC2 channels 0–9 → GPIO11–20]] — the emulator applies this `+1` at the channel→pin boundary so a co-sim read lands on the wired bench pin, not the channel-numbered one.

## TIMG0 timer 0 (`timer_group_reg.h`)

Offsets from `DR_REG_TIMERGROUP0_BASE`. The S3 group has two general-purpose timers (T0/T1) plus a watchdog.

| Reg | Offset | Reg | Offset |
|---|---|---|---|
| T0CONFIG | `0x00` | T0ALARMHI | `0x14` |
| T0LO | `0x04` | T0LOADLO | `0x18` |
| T0HI | `0x08` | T0LOADHI | `0x1C` |
| T0UPDATE | `0x0C` | T0LOAD | `0x20` |
| T0ALARMLO | `0x10` | INT_ENA | `0x70` |
| INT_RAW | `0x74` | INT_ST | `0x78` |
| INT_CLR | `0x7C` | | |

`T0CONFIG`: EN bit 31, INCREASE bit 30, AUTORELOAD bit 29, DIVIDER [28:13] (field 0 means ÷65536 — see [[esp32-s3-timg-divider-field-zero-means-divide-by-65536-because-the-hal-wraps-the-2-to-65536-range]]), ALARM_EN bit 10. T0 interrupt at bit 0 of the INT_* registers. Clock: APB at 80 MHz (`APB_CLK_FREQ`), i.e. 3 CPU cycles per APB tick at 240 MHz.

## Interrupt matrix (`interrupt_core0_reg.h`)

Each peripheral source has a 5-bit MAP register selecting its CPU line, reset value 16. Offsets from `DR_REG_INTERRUPT_BASE` (`0x600C2000`):

| MAP register | Offset |
|---|---|
| `INTERRUPT_CORE0_GPIO_INTERRUPT_PRO_MAP_REG` | `+0x040` |
| `INTERRUPT_CORE0_UART_INTR_MAP_REG` | `+0x06C` |
| `INTERRUPT_CORE0_TG_T0_INT_MAP_REG` | `+0x0C8` |

Level-1 external lines (from `XCHAL_INTLEVEL1_MASK = 0x000637FF`): INT0–5, INT8–9, INT12–13, INT17–18 are level-triggered external. (INT6/15/16 timers, INT7/29 software, INT10/22/28/30 edge external, INT11 profiling, INT14 NMI.)

---

## Source

[[2026-06-11-esp32s3-emulator-core-verification]] (lines 50-72, 199-225, 253-306)

## Relevant Notes

- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — this map is the modeled side whose paired cut the umbrella names: one 480 KB SRAM window aliased across IRAM/DRAM, no cache, no SRAM0, with the flash-cache IROM/DROM windows served read-only — the fidelity boundary a co-sim consumer trusts
- [[the-esp32-s3-maps-one-sram-block-at-both-an-iram-and-a-dram-address-so-an-emulator-can-model-it-as-a-single-window-aliased-to-two-bus-addresses]] — the SRAM aliasing model behind the dual IRAM/DRAM views above
- [[flash-mapped-irom-and-drom-segments-carry-post-mapping-virtual-addresses-so-an-emulator-serves-them-read-only-straight-from-the-image]] — how the IROM/DROM cache windows are served
- [[an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones]] — the app-image loader that consumes this map, routing each segment to copy-or-refuse by these SRAM vs IROM/DROM region boundaries
- [[esp32-s3-timg-divider-field-zero-means-divide-by-65536-because-the-hal-wraps-the-2-to-65536-range]] — consumes the TIMG0 base and `T0CONFIG` DIVIDER field defined above
- [[esp32-s3-adc1-channel-n-reads-gpio-n-plus-1-so-an-emulator-resolves-analog-reads-to-the-correct-bench-pin]] — explains *why* the SAR1_EN_PAD channel→pin mapping in the SENS table above carries the `+1` offset, and why the emulator core (not user code) must own it
- [[an-emulator-can-model-sar-adc-oneshot-reads-as-instant-conversions-because-firmware-waits-on-the-start-bit-edge-and-done-flag-not-sar-clock-timing]] — the *behavioral* read of the same SENS table: firmware pulses `MEAS1_START_SAR` (the 0→1 edge above), polls `MEAS1_DONE_SAR`, then reads `MEAS1_DATA_SAR`, so the emulator can set DONE in the same step and model the conversion as instant
- [[the-esp32-s3-xtensa-special-register-numbers-rsr-wsr-rsil-rfe-encodings-exccause-codes-and-core-isa-config-constants-are-fixed-values-an-emulator-must-hardcode]] — companion "hardcoded constants" reference (special registers are RSR/WSR-accessed, not memory-mapped — the non-memory-mapped half of the emulator's fixed-value tables)

## Topics

- esp32-s3
- emulation

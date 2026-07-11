---
description: One physical SRAM block sits on both the IRAM and DRAM buses, so the emulator backs both ranges with one array and aliases the addresses
type: claim
confidence: verified
audience: [intermediate]
created: 2026-06-23
topics:
  - esp32-s3
  - emulation
provenance:
  source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  verified: 2026-06-23
  reliability: high
---
# The ESP32-S3 maps one SRAM block at both an IRAM and a DRAM address so an emulator can model it as a single window aliased to two bus addresses

The ESP32-S3's internal SRAM is reachable through two different bus addresses, and they refer to the *same physical cells*. Espressif's own `soc.h` places the instruction bus at `SOC_IRAM_LOW 0x40370000`–`SOC_IRAM_HIGH 0x403E0000` and the data bus at `SOC_DRAM_LOW 0x3FC88000`–`SOC_DRAM_HIGH 0x3FD00000`; the vendor header explicitly notes that `0x40378000` in IRAM aliases `0x3FC88000` in DRAM — one SRAM, two buses. (These exact base addresses, and the rest of the emulator's fixed memory and peripheral map, are tabulated in [[the-esp32-s3-memory-map-and-peripheral-register-set-spans-aliased-sram-windows-flash-cache-irom-drom-windows-and-gpio-uart-sens-timg-and-interrupt-matrix-register-banks-at-fixed-base-addresses]].) The dual mapping exists because Xtensa fetches code from the I-bus and loads/stores data on the D-bus, but the silicon lets the same SRAM serve both so code and data can share a region.

For an emulator this is a simplification, not a complication. The naive reading — two address ranges, therefore two memories — would double the storage and, worse, let a write through the DRAM address go unseen by an instruction fetch at the corresponding IRAM address. The faithful model is the opposite: back the region with **one** storage array (a single 480 KB SRAM window) and alias both address ranges onto it by subtracting their respective base offsets before indexing. A store to `0x3FC88000 + n` and a fetch from `0x40378000 + n` then hit the same byte, exactly as silicon does — which is precisely the behavior self-modifying or trampoline code depends on.

This aliasing is the substrate that the `@protopulse/emu` Esp32s3Core builds on, and it travels with a stated cut: there is no SRAM0/cache modeling, single core, 1 instruction = 1 cycle. Modeling the alias correctly is what makes the broader [[an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones]] loader honest — SRAM-resident segments land in one buffer regardless of which bus address their vaddr names.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[the-esp32-s3-memory-map-and-peripheral-register-set-spans-aliased-sram-windows-flash-cache-irom-drom-windows-and-gpio-uart-sens-timg-and-interrupt-matrix-register-banks-at-fixed-base-addresses]] — the overview reference that owns the SRAM-window base-address constants this note aliases
- [[an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones]] — the loader that fills this aliased window from SRAM-resident segments
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the single-window/no-cache aliasing is one of the documented emulator cuts

Topics:
- [[esp32-s3]]
- [[emulation]]

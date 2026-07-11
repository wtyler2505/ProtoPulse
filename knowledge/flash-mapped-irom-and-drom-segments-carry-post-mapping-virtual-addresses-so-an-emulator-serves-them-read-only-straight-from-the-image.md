---
description: ESP-IDF flash segment vaddrs are already MMU-mapped, so an emulator serves them read-only from the image — the net effect of a warmed cache, no MMU needed
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
# Flash-mapped IROM and DROM segments carry post-mapping virtual addresses so an emulator serves them read-only straight from the image

On the ESP32-S3 the instruction and data caches occupy fixed bus windows — IROM at `0x42000000`–`0x44000000` and DROM at `0x3C000000`–`0x3E000000` (per ESP-IDF `soc.h` and `ext_mem_defs.h`, two headers agreeing). The crucial fact for emulation is what happens at boot: the second-stage bootloader's MMU setup *maps* flash segments whose load addresses fall in these windows rather than *copying* them to RAM. So the vaddr written in each app-image segment header is already the post-mapping address — exactly how `esptool`/IDF lay out `.flash.text` and `.flash.rodata`.

This collapses a hard modeling problem into a trivial one. An emulator does not need to simulate the flash cache or the MMU translation at all; it can place those segment bytes read-only at their stated vaddrs and let instruction fetch and constant loads hit them directly. The result is byte-for-byte the *net effect* of the MMU mapping plus a fully-warmed cache — the steady state any real run converges to once the cache lines are populated. Modeling the transient (cold-miss latency, line eviction) buys nothing for functional fidelity, so it is cut.

The honest cuts follow from this choice and must be disclosed (see [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]]): XIP reads cost one cycle like everything else, so the model is not cycle- or cache-accurate; the MMU registers are unmodeled, so runtime remapping is impossible; writes through a cache window refuse; and a read inside a window but outside any mapped segment refuses loudly rather than returning garbage. This is the read-only counterpart to the loader policy that accepts only SRAM-resident segments (see [[an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones]]) — together they let an SRAM-window core still run real IDF images without a memory-management subsystem. The exact IROM/DROM base addresses cited here are tabulated in the consolidated [[the-esp32-s3-memory-map-and-peripheral-register-set-spans-aliased-sram-windows-flash-cache-irom-drom-windows-and-gpio-uart-sens-timg-and-interrupt-matrix-register-banks-at-fixed-base-addresses]] reference.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the fidelity-boundary principle this XIP simplification and its cuts belong to
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-keeps-a-one-instruction-per-cycle-emulator-coherent-without-a-pipeline-model]] — same 1-instruction-per-cycle model that makes the no-cache-timing cut consistent
- [[an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones]] — the complementary loader policy: it refuses the same IROM/DROM segments this note serves read-only
- [[the-esp32-s3-memory-map-and-peripheral-register-set-spans-aliased-sram-windows-flash-cache-irom-drom-windows-and-gpio-uart-sens-timg-and-interrupt-matrix-register-banks-at-fixed-base-addresses]] — owns the IROM/DROM base-address constants referenced here

Topics:
- [[esp32-s3]]
- [[emulation]]

---
claim: "the ESP32-S3 memory map and peripheral register set spans aliased SRAM windows, flash-cache IROM/DROM windows, and GPIO UART SENS TIMG and interrupt-matrix register banks at fixed base addresses"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
note_type: reference
---

# Claim 087: esp32s3 memory map and peripheral register reference

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 50-72,199-225,253-306)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED reference note (consolidated verified register/encoding data — kept as one retrievable table rather than fragmented into dozens of trivial atomic notes, per the composability/clean-linking test).

Rationale: Consolidates SOC_IRAM/DRAM/IROM/DROM bounds, DR_REG_* bases (GPIO 0x60004000, UART0 0x60000000, SENS 0x60008800, TIMG0 0x6001F000, INTERRUPT 0x600C2000) and the key register offsets the emulator models.

Semantic neighbor: none — net-new register-level reference data.

---

## Create

Note: [[the-esp32-s3-memory-map-and-peripheral-register-set-spans-aliased-sram-windows-flash-cache-irom-drom-windows-and-gpio-uart-sens-timg-and-interrupt-matrix-register-banks-at-fixed-base-addresses]]
Path: knowledge/the-esp32-s3-memory-map-and-peripheral-register-set-spans-aliased-sram-windows-flash-cache-irom-drom-windows-and-gpio-uart-sens-timg-and-interrupt-matrix-register-banks-at-fixed-base-addresses.md

Summary: Created the REFERENCE note (type: reference, confidence: verified) consolidating the ESP32-S3 memory map and peripheral register set from source lines 50-72, 199-225, 253-306. Clean tables: (1) memory map — SRAM IRAM view 0x40370000–0x403E0000 / DRAM view 0x3FC88000–0x3FD00000 (alias 0x40378000=0x3FC88000), IROM 0x42000000–0x44000000, DROM 0x3C000000–0x3E000000; (2) peripheral bases — UART0 0x60000000, GPIO 0x60004000, SENS 0x60008800, TIMG0 0x6001F000, interrupt matrix 0x600C2000; (3) GPIO/UART/SENS-ADC1/TIMG0 register offsets+fields; (4) interrupt-matrix MAP register offsets (GPIO +0x040, UART +0x06C, TG_T0 +0x0C8) + level-1 external line mask 0x000637FF. Every value transcribed from a named esp-idf v5.2 header — none invented. Inline-linked claim-077 (SRAM aliasing) and claim-076 (IROM/DROM flash-cache). claim-088 (special-registers) NOT linked — not yet published in knowledge/ (still a task file only), per the "if they exist" instruction.

## connect

Phase: reflect (connect only). Target: the FOUNDATIONAL memory-map/register reference note.

**Discovery method:** Dual discovery adapted to the worktree. Topic maps `knowledge/emulation.md` (target already a member, line 48) + `knowledge/esp32-s3.md` (membership GAP found — see below) read directly. Semantic search via qmd was NOT usable: qmd indexes the MAIN repo, but this batch is untracked in the `emu-aes-cfb8` worktree. Substituted `grep -rl` over the worktree's `knowledge/` to enumerate inbound links and verify all sibling filenames exist (all 7 closest siblings confirmed present).

**Inbound-link audit.** Five notes link TO the reference note: SRAM-alias (077), flash-mapped IROM/DROM (076), timg-divider (081), special-register, and `emulation.md`. The note already linked OUT to 077 and 076 (already bidirectional). One-directional inbound links were timg-divider and special-register.

**Reciprocations added (hub kept lean — 4 total outbound, top of the 2-4 range):**
- **Inline** link in the TIMG0 section (`T0CONFIG` DIVIDER [28:13] line) → `esp32-s3-timg-divider-field-zero-means-divide-by-65536...`. Strongest reciprocation: that note's claim IS the DIVIDER field defined here; it genuinely consumes the TIMG0 base this note owns.
- **Relevant Notes** entry → timg-divider (consumer of the TIMG0 base + DIVIDER field).
- **Relevant Notes** entry → `the-esp32-s3-xtensa-special-register-numbers...` — articulated honestly as a *companion "hardcoded constants" reference*, NOT a consumer (special registers are RSR/WSR-accessed, not memory-mapped — the non-memory-mapped half of the emulator's fixed-value tables).

Deliberately did NOT over-link the remaining consumers (sram-only image loader, etc.) per the hub-reference guidance.

**MOC membership fix.** The note declares `topics: [esp32-s3, emulation]` and was listed in `emulation.md` but was ABSENT from `esp32-s3.md`'s Knowledge Notes. Added it there (a concurrent task had just added timg-divider to the same list; re-read before editing, no collision). `emulation.md` left untouched (already correct).

**No false claims:** every added edge is genuine; special-register link explicitly avoids overclaiming consumption.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)

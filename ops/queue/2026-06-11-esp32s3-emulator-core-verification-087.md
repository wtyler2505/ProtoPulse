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

Phase: reweave / BACKWARD pass. Target: the FOUNDATIONAL memory-map/register reference note. Goal — find OLDER sibling claims that *consume* register constants this reference owns but don't yet link back to it, and add inline links FROM those siblings TO this reference.

**Discovery method.** qmd unusable in the worktree (indexes MAIN repo; this batch is untracked here), so substituted `grep -rl` over the worktree `knowledge/` to enumerate which notes already point at the reference (6: emulation.md, esp32-s3.md, timg-divider, flash-mapped, sram-alias, special-register) and to read every emulation-MOC sibling for register-constant usage. Discriminator applied per advisor: a sibling earns a backward link here only if it *names a memory-mapped register address/offset/field* this reference tabulates; if it only names a special register (RSR/WSR-accessed: PS.INTLEVEL, VECBASE, EXCCAUSE, RFE…) it belongs to the special-register reference, not this one.

**4 backward links added (inline + Relevant-Notes reciprocation each):**
- **condition-derived-level-interrupts** — inline at "`UART_INT_CLR` (offset 0x10, bit 0)"; this note names the UART INT_CLR offset + CONF1 RXFIFO_FULL_THRHD field + GPIO STATUS/INT_TYPE values, all tabulated here. Genuine consumer.
- **esp32-s3-adc1-channel-n** — inline at the one-hot `1 << channel` → `SAR1_EN_PAD` write; SAR1_EN_PAD is the [30:19] field of SENS_SAR_MEAS1_CTRL2_REG defined here. Reciprocates the reference's existing OUT link.
- **an-emulator-can-model-sar-adc-oneshot...instant** — inline at `SENS_SAR_MEAS1_CTRL2_REG`; this note reads/writes the *entire* MEAS1_* field block (START_FORCE, SAR1_EN_PAD_FORCE, START_SAR, DONE_SAR, DATA_SAR) the SENS table defines. Strongest SENS consumer.
- **an-sram-only-emulator-can-still-load-esp-idf-app-images...** — inline at the `0x42xxxxxx`/`0x3Cxxxxxx` flash-bus boundaries + 480 KB SRAM window; the loader's copy-or-refuse decision keys directly on these memory-map region bounds.

**Consciously EXCLUDED (not silently dropped):**
- **a-shared-mcucore-contract...** — architectural co-sim-contract note; speaks of "conversion registers, done flags, force bits" abstractly, names no specific address/field. Not a register-level consumer.
- **modeling-xtensa-exceptions-...-zero-cycle-vectoring** and **a-conservative-emulator-boots-ps-intlevel-at-15** — both checked for interrupt-matrix base / MAP regs / `XCHAL_INTLEVEL1_MASK = 0x000637FF`; neither names them. They deal only in PS.INTLEVEL/VECBASE/EXCCAUSE/RFE (special registers) and already link to the special-register reference. The interrupt-matrix half of this reference therefore has no genuine backward consumer among current siblings.

**Result:** inbound links to the reference grew 6 → 10. All 4 new slugs verified to resolve to the existing target file (exact-slug grep). No link inflation — every added edge names a register constant the reference uniquely owns.

## verify
(to be filled by verify phase)

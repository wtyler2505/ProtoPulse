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
(to be filled by connect phase)

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)

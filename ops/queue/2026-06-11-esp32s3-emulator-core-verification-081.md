---
claim: "the ESP32-S3 TIMG divider field value 0 means divide-by-65536 because the HAL encodes the 2-to-65536 range with a wraparound"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 081: esp32-s3 timg divider field value zero means divide-by-65536 via a hal range wraparound

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 266-268)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Register-encoding gotcha: an emulator reading the divider literally would divide by 0; the HAL writes 65536 as field 0.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: `knowledge/esp32-s3-timg-divider-field-zero-means-divide-by-65536-because-the-hal-wraps-the-2-to-65536-range.md`

Summary: TIMG `T0CONFIG.DIVIDER` is a 16-bit field (bits [28:13]) encoding prescale divisors 2..65536; the HAL writes 65536 as field value 0 (65536 mod 65536 = 0, since the literal value needs 17 bits), so field 0 means ÷65536 and value 1 is reserved/special. An emulator must special-case `0 → 65536` before scaling its virtual cycle-derived counter, or it crashes/garbages on the firmware's slowest-prescale config. Linked to the faithful-emulator-documents-its-cuts note, the xtensa CCOUNT/CCOMPARE timer note, and the zero-cycle-vectoring emulator note. claim-080 and claim-072 have no notes in knowledge/ yet, so no link to them.

## connect
(to be filled by connect phase)

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)

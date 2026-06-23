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

Phase: connect (reflect/connect only — no reweave, no verify).

Dual discovery run: topic maps `knowledge/emulation.md` + `knowledge/esp32-s3.md`, plus sibling-filename verification via `ls knowledge/` (qmd indexes the main repo, not this worktree).

### Links added (all genuine)
- **divider → [[the-esp32-s3-memory-map-and-peripheral-register-set-...-fixed-base-addresses]]** (claim-087, NEW): "where this register lives" link — 087 owns the TIMG peripheral base-address facts; this note's `T0CONFIG.DIVIDER` field lives in that bank. Outbound only; 087 is a curated base-address reference and a divider-encoding detail would bloat it, so no reciprocal (per advisor).
- **divider ↔ [[a-cycle-derived-virtual-timer-...-54-bit-wrap]]** (claim-080): tightest cluster link — the divider scales the cycle-derived virtual TIMG counter 080 describes; the prescaler read is on 080's lazy-derivation critical path. Bidirectional link was established by the concurrent claim-080 connect task (both directions verified present); no further action needed here.

### Already present (genuine, left intact)
- [[a-faithful-instruction-set-emulator-...-deliberate-cut-...]] (umbrella principle)
- [[xtensa-timer-interrupts-latch-when-ccount-equals-ccompare-...]] (claim-072, sibling cycle-based timer)
- [[modeling-xtensa-exceptions-and-level-1-interrupts-as-zero-cycle-vectoring-...]]

### Topic-map membership
- `emulation.md`: already lists this note (peripheral co-sim cluster) — unchanged.
- `esp32-s3.md`: was an auto-generated stub; appended this note's line under Knowledge Notes (preserving the concurrent claim ADC entry). Stub still needs human curation (Core Ideas + real description + drop `auto_generated`).

### Reciprocation
- Inbound one-directional link from claim-080 → divider was reciprocated by the concurrent 080 task (divider → 080 present). No other one-directional inbound sibling links found (`grep` showed only `emulation.md` and 080 referencing this note).

### Concurrency note
File was edited mid-phase by concurrent tasks (claim-080 added the 080 link to the divider note; an ADC task added a line to `esp32-s3.md`). Re-read both shared files before each edit and appended only — no overwrites.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)

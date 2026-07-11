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

Phase: reweave (BACKWARD pass — find OLDER notes / siblings that should reference THIS note but don't, add inline links FROM them TO here). ONE PHASE ONLY (no verify).

### Method
- Discovery via topic maps `knowledge/emulation.md` + `knowledge/esp32-s3.md` and sibling-filename `ls knowledge/` (qmd indexes the main repo, not this worktree).
- `grep -rl` for inbound links to this note + `grep -riE "timg|prescal|divider|divide-by"` across `knowledge/` to catch un-linked mentions. The bulk of divider hits were electronics voltage-divider notes (irrelevant); discarded.

### Candidates evaluated
- **[[a-cycle-derived-virtual-timer-...-54-bit-wrap]]** (claim-080) — the only note that genuinely *depends on* this claim: the prescaler this note decodes scales 080's cycle-derived virtual TIMG0 counter. Already links here bidirectionally (080 line 28 → divider; divider line 29 → 080). Established by the concurrent 080 task. **No action — already reciprocated.**
- **[[the-esp32-s3-memory-map-...-fixed-base-addresses]]** (claim-087) — older sibling that *defines* the `T0CONFIG.DIVIDER` field this note decodes. Genuinely backward (the register definition precedes the decode gotcha). Already links here **twice**: inline at line 104 (right at the `DIVIDER [28:13]` field definition) and in Relevant Notes at line 130. Added by a concurrent task. **No action — already present.** (NB: this note's own ## connect section says "087 outbound only, no reciprocal per advisor"; that statement is now stale — 087 → 081 backlink exists and is genuine.)
- **[[xtensa-timer-interrupts-latch-...-ccompare-is-rewritten]]** (claim-072) — considered and **rejected**. 072 is the Xtensa *core* CCOUNT/CCOMPARE special-register timer; 081 is the *TIMG peripheral* prescaler decode. Distinct subsystems sharing only the cycle clock; 072 never reads the TIMG divider, no dependency in either direction. The divider→072 forward link is a "sibling timer / see-also", and a strict instantiate/depend bar does not obligate a reciprocal. Adding 072→081 would be "both are timers" link inflation. Advisor concurred.
- **[[a-shared-mcucore-contract-...-bench-wiring]]** — TIMG/divider grep hit was a voltage-divider false positive; no genuine connection.

### Result
**No new links added.** This is a legitimate backward-pass outcome: both notes that genuinely depend on or define the subject of this claim (080, 087) already link to it (reciprocated by concurrent sibling tasks). No older note instantiates or depends on this claim while missing the link. No link manufactured to make the phase feel productive (per advisor).

## verify
(to be filled by verify phase)

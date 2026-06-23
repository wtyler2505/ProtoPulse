---
claim: "the ESP32-S3 maps one SRAM block at both an IRAM and a DRAM address so an emulator can model it as a single window aliased to two bus addresses"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 077: esp32-s3 aliases one sram block at both an iram and a dram address modelable as a single window

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 53-57,69-72)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Memory-map fact (0x40378000 IRAM aliases 0x3FC88000 DRAM); lets the emulator back both with one 480 KB buffer.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[the-esp32-s3-maps-one-sram-block-at-both-an-iram-and-a-dram-address-so-an-emulator-can-model-it-as-a-single-window-aliased-to-two-bus-addresses]]

Created knowledge/the-esp32-s3-maps-one-sram-block-at-both-an-iram-and-a-dram-address-so-an-emulator-can-model-it-as-a-single-window-aliased-to-two-bus-addresses.md (verified claim). Transforms source lines 53-57,69-72: same physical SRAM exposed on the I-bus (SOC_IRAM 0x40370000–0x403E0000) and D-bus (SOC_DRAM 0x3FC88000–0x3FD00000), with 0x40378000 aliasing 0x3FC88000. Body argues the faithful emulator model is ONE 480 KB storage array with both ranges aliased onto it (offset-subtracted indexing) so a DRAM-address write is visible at the IRAM address — not two separate memories. Inline-linked claim-075 (sram-only loader) and the cut-list note.

## connect

Dual discovery (topic maps emulation.md + esp32-s3.md, plus semantic). qmd returned no matches — it indexes the main repo, not this worktree — so discovery ran off the topic maps and the verified sibling list (ls knowledge/).

Findings:
- MOC membership already satisfied: the note is listed in emulation.md under "Memory & image loading (SRAM-only window; flash-mapped refused)" (line 46). No edit to emulation.md needed (HOT file — left untouched).
- esp32-s3.md is an auto-generated stub with an empty Knowledge Notes section; left untouched (HOT file; note 087 owns the SRAM-window base-address facts).
- Reciprocated one-directional inbound link: the memory-map overview note (087, ...spans-aliased-sram-windows...) links to this note TWICE (its Memory map section + Relevant Notes) but this note did not link back. Added the back-link in the body (after the 0x40378000/0x3FC88000 alias example, pointing at where those base-address constants are tabulated) and in Relevant Notes. Genuine: 087 owns the base-address constants this note's aliasing model consumes.
- Pre-existing genuine links kept: claim-075 (sram-only loader — fills this window) and the faithful-cut umbrella note.

Edits confined to this note + task file. No reweave/verify run (connect phase only).

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)

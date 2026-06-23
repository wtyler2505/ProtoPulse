---
claim: "flash-mapped IROM and DROM segments carry post-MMU-mapping virtual addresses so an emulator can serve them read-only straight from the image as the net effect of a warmed cache"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 076: flash-mapped irom-drom segments carry post-mapping vaddrs so an emulator serves them read-only from the image

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 285-306)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Slice 9 XIP insight: because the bootloader's MMU maps rather than copies, serving the image bytes at their vaddr is the warmed-cache net effect — no MMU modeling needed.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create
Note: [[flash-mapped-irom-and-drom-segments-carry-post-mapping-virtual-addresses-so-an-emulator-serves-them-read-only-straight-from-the-image]]
Path: knowledge/flash-mapped-irom-and-drom-segments-carry-post-mapping-virtual-addresses-so-an-emulator-serves-them-read-only-straight-from-the-image.md

Summary: Created the insight note from source lines 285-306 (slice 9 flash-cache addendum). Transformed (not copied): IROM 0x42000000–0x44000000 / DROM 0x3C000000–0x3E000000 windows; bootloader MMU *maps* (not copies) flash segments, so the segment-header vaddr is already the post-mapping address. Net effect = MMU mapping + fully-warmed cache, so the emulator serves those bytes read-only at their vaddrs with no cache/MMU modeling. Cuts disclosed: 1-cycle XIP reads (not cache-accurate), unmodeled MMU regs (no runtime remap), refuse cache-window writes, refuse in-window/out-of-segment reads. Inline links: a-faithful-instruction-set-emulator-earns-trust (fidelity-boundary parent) + zero-cycle-vectoring note (1-inst/cycle consistency). Sibling claims 075 (SRAM-only load) and 077 (SRAM aliasing) exist only as task files, not yet in knowledge/, so not linked per "if they exist" instruction.

## connect

Dual discovery run (topic maps + on-disk sibling verification; qmd protopulse-vault indexes the MAIN repo, not this worktree, so all sibling filenames were confirmed via `ls knowledge/`).

**MOC membership — already satisfied (no edit needed):**
- `knowledge/emulation.md` (real MOC) already lists 076 under "Memory & image loading (SRAM-only window; flash-mapped refused)" at line 49. No change.
- `knowledge/esp32-s3.md` is an auto-generated stub ("awaiting Core Ideas", notes list populated by /connect or manual curation). Skipped per discovery-first hygiene — adding a single link to a stub is low value and the real MOC (emulation.md) already provides navigation. Flagged for human curation, not a 076 blocker.

**Inbound reciprocation (links pointing AT 076):**
- Note 087 (memory-map/register reference) already links to 076 at lines 22 and 127. Reciprocated: 076 now links back to 087 (087 owns the IROM/DROM base-address constants 076 cites). Both inline (body) and Relevant Notes.

**Complementary-pair link (075 ↔ 076):**
- Added forward link 076 → 075 (the SRAM-only loader that *refuses* the same flash-mapped IROM/DROM segments 076 explains how to *serve*). Inline (converted the existing "loader policy that accepts only SRAM-resident segments" phrase into a wiki-link) + Relevant Notes entry. The reciprocal 075 → 076 was deliberately NOT added: editing sibling 075 is its own task's connect/revisit job and a concurrency-collision risk per the batch-task warning. Bidirectionality emerges from each note reciprocating its own inbound links.

**Edits — all confined to 076:**
1. Inline links added to body para 3: → 075 (complementary loader) and → 087 (base-address reference).
2. Two new Relevant Notes entries for 075 and 087.

No sibling notes edited. Pre-existing links to the fidelity-boundary parent (a-faithful-...) and the zero-cycle-vectoring note retained.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)

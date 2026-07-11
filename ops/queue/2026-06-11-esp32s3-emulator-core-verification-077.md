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

BACKWARD pass (`/revisit --handoff`). Goal: find OLDER insights / sibling claims that should reference THIS note (077, the SRAM IRAM/DRAM aliasing model) but don't, and add inline links FROM them TO this note. Genuine instantiate/depend connections only — no link inflation.

Discovery: emulation.md MOC + esp32-s3.md stub (both HOT, untouched), the verified sibling list (`ls knowledge/`), and a content grep (`rg -i 'iram|dram|sram|0x4037|0x3fc88|aliase|480|single window|self-modif|trampoline'`). qmd indexes the main repo, not this worktree, so discovery ran off the MOC + grep. The grep's hardware-board hits are generic spec mentions (board DRAM/IRAM sizes), not the emulator aliasing concept — excluded.

Added ONE genuine backward link (1 dependent note, 2 link sites):
- **a-faithful-instruction-set-emulator-earns-trust-... (umbrella, claim being instantiated by 077).** Its body (the memory paragraph) names the cut verbatim — "Memory is one 480 KB SRAM window aliased across the IRAM and DRAM buses, with no cache, no SRAM0..." — and inline-links its sibling memory cuts (flash-mapped IROM/DROM, XOR checksum) but had NO link to 077, the note that owns that aliasing claim. Added (a) an inline body link on the "one 480 KB SRAM window aliased across the IRAM and DRAM buses" phrase, matching the adjacent inline-link pattern; (b) a Relevant Notes entry under "Cuts stated as scope/conservatism choices." Genuine: the umbrella's example sentence is a direct instance of 077's claim.

Examined and deliberately EXCLUDED (no genuine backward dependency, or already satisfied):
- 075 (sram-only loader) — already links to 077 inline + Relevant Notes (reciprocated in connect). No edit.
- 087 (memory-map reference) — already links to 077 twice (Memory map body + Relevant Notes; reciprocated in connect). No edit.
- flash-mapped IROM/DROM note — serves the *flash-cache* window (0x42xxxxxx/0x3Cxxxxxx), a different region; does not depend on the SRAM aliasing. Skipped (link inflation risk).
- windowed-register spill/fill note — spills register frames "to the stack," but the claim is about ABI memory *layout*, observationally equivalent regardless of bus aliasing; aliasing is not load-bearing. Skipped (link inflation risk; advisor concurred).
- special-register hardcoded-constants note — RSR/WSR special regs are not memory-mapped; links only to 087 (correct). No backward dependency on 077.

Edits confined to the umbrella note + this task file. Connect-phase links into 077 left intact. ONE PHASE ONLY — no verify run.

## verify
(to be filled by verify phase)

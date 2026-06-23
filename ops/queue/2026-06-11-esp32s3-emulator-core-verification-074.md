---
claim: "the ESP-IDF app image checksum is the XOR of all segment data bytes seeded with 0xEF stored as the last byte of the 16-aligned image body"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 074: the esp-idf app image checksum is an xor of segment bytes seeded 0xef in the last byte of the 16-aligned body

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 176-181)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Concrete image-format fact (slice 5) an emulator-loader must compute to validate raw images; two-source verified (esp_app_format.h + esptool).

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[the-esp-idf-app-image-checksum-is-the-xor-of-all-segment-data-bytes-seeded-with-0xef-stored-as-the-last-byte-of-the-16-aligned-image-body]]
Path: knowledge/the-esp-idf-app-image-checksum-is-the-xor-of-all-segment-data-bytes-seeded-with-0xef-stored-as-the-last-byte-of-the-16-aligned-image-body.md

Summary: Created the insight note transforming source lines 176-181. Body explains the algorithm exactly — `acc = 0xEF`, XOR-fold over every byte of every segment's data payload (headers excluded), result placed as the final byte of the image body padded to a 16-byte boundary (padding counts the checksum byte itself). Explains how a raw-image loader validates by re-folding from the seed and comparing at the computable last-byte offset, and frames the unverified SHA-256 trailer (present when `hash_appended` is set) as a deliberate documented cut. Linked to the parent cut-list note, a sibling slice note, and the esp32-s3 / emulation MOCs.

## connect

Ran /connect --handoff (reflect/connect phase only). Dual discovery: emulation.md + esp32-s3.md topic maps on disk (qmd protopulse-vault indexes main repo, not this worktree, so verified sibling filenames via `ls knowledge/`), plus a vault-wide inbound-link grep substituting for semantic search.

**MOC membership (the deliverable):**
- Added 074 to `knowledge/emulation.md` → "Memory & image loading" section, immediately after the SRAM-only loader (075) bullet — the tightest pair. The note was previously absent from any MOC body; its `topics:` footer is not membership.
- `knowledge/esp32-s3.md` is an auto-generated stub with no curated note list (Knowledge Notes section is "_Populated by /connect or manual curation._"). Left untouched — adding a single bullet to an unstructured stub would be noise; membership rests on emulation.md, the real MOC. The note's `topics: [esp32-s3]` footer remains.

**Reciprocation (genuine, confirmed by inbound grep):**
- `grep -rln "the-esp-idf-app-image-checksum-is-the-xor" knowledge/` found ONE inbound source: 075 (the SRAM-only loader), which a concurrent task had already given both an inline body wiki-link AND a Relevant Notes entry pointing AT 074. That made 074↔075 a true reciprocation, not just a new link.
- Reciprocated in 074: added 075 to 074's Relevant Notes ("the loader that runs this fold…") and converted the existing body phrase "the `@protopulse/emu` loader does exactly this fold" into an inline wiki-link to 075.

**Links deliberately NOT added (overreach avoided):** 074→076 (flash-mapped vaddrs) and 074→077 (aliased SRAM window). Both relationships are real but subtle; 074's body does not invoke them, and MOC co-membership in "Memory & image loading" already connects the cluster. Forcing them would dilute. The parent cut-list note (`a-faithful-...`) and the 24-bit-Xtensa sibling links were already present from the create phase and remain genuine.

Collision discipline: re-read emulation.md immediately before editing (it is the hot shared file for the 075/076/077 concurrent batch), anchored the append on the unique 075 bullet, single-line insert.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)

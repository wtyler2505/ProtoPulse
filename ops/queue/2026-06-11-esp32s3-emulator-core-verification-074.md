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

Ran /revisit --handoff (BACKWARD pass only). Goal: find OLDER notes and siblings that should reference 074 but don't, and add inline links FROM them TO 074.

**Discovery:** grep over `knowledge/` for app-image / checksum / 0xEF / esptool / segment / SHA terms (qmd indexes the main repo, not this worktree, so used filesystem grep). Surfaced the full emulation batch plus two non-batch candidates.

**The one genuine backward link (added):** `a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models` — the umbrella cut-list note. Its body (line 21) already states claim 074 verbatim: "it verifies the XOR checksum but skips the SHA-256 trailer" — that sentence IS 074's exact cut — yet the note had ZERO links to 074 (confirmed `grep -c` = 0). Two edits:
  1. **Inline body link** — converted the phrase "verifies the XOR checksum but skips the SHA-256 trailer" into a wiki-link to 074. This is the strongest, least-padded backward connection: an existing prose instantiation now points at the note that owns it.
  2. **Relevant Notes list entry** — added 074 to the "Cuts stated as scope/conservatism choices" group (verify-XOR / skip-SHA is a disclosed boundary, not a refusal — correct category). The note's own framing catalogs *every* modeled-behavior+cut instance, so 074's absence there was a real gap; sibling 075 (the loader) was listed but 074 (the checksum cut itself) was not.

**Links deliberately NOT added (overreach avoided):**
- `pico-uf2-drag-and-drop-bootloader-eliminates-external-programmers` (older, non-batch) — mentions `esptool` only as an upload-UX contrast for the Pico; does not touch the ESP-IDF image format or checksum. No dependency. Link inflation.
- `hardware-board-nodemcu-esp32s` — hardware board note; only hit was an unrelated GPIO docs URL.
- 074→076 (flash-mapped) and the memory-map reference note — both parse/own the segment table but neither computes or depends on the checksum; bodies don't invoke it. Confirmed neither links to 074. MOC co-membership in "Memory & image loading" already connects the cluster (this matches the connect phase's earlier deliberate decision).

**Result:** 1 genuine backward connection (the parent cut-list note, inline + list), expected outcome for a net-new note in a batch where /connect already wired the tight cluster (075 + emulation.md MOC). No manufactured links.

Collision discipline: re-read the parent note fully immediately before editing (it is the hottest shared file in this batch — every sibling task may touch it); anchored the inline edit on the unique line-21 sentence and the list edit on the unique SAR-ADC bullet, single-line inserts.

## verify
(to be filled by verify phase)

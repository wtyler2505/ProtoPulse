---
claim: "an SRAM-only emulator can still load ESP-IDF app images by loading only SRAM-resident segments and refusing flash-mapped ones"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 075: an sram-only emulator loads esp-idf images by taking sram segments and refusing flash-mapped ones

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 169-187)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Loader scope cut: refusing 0x42xxxxxx/0x3Cxxxxxx segments is the honest boundary when no flash cache is modeled.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create
Note: [[an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones]]
Path: knowledge/an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones.md

Summary: Created the insight note transforming source lines 169-187. Frames the claim around segment-granular loading: the loader walks `segment_count` × `esp_image_segment_header_t`, copies segments whose `load_addr` lands in the 480 KB SRAM window, and refuses (with a message) flash-mapped buses 0x42xxxxxx (IROM) / 0x3Cxxxxxx (DROM) because the flash cache is unmodeled — a documented cut, not a silent skip. Also notes XOR checksum verified / SHA-256 trailer skipped. Linked to the sibling principle note [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]]. Claim-074 (checksum) and claim-076/077 (flash-cache windows, SRAM aliasing) notes do not yet exist in knowledge/, so no cross-links to them were added.

## connect

Ran /connect --handoff. Dual discovery: emulation.md + esp32-s3.md MOCs (read on disk) plus qmd semantic search (protopulse-vault returned no match — worktree note set is not indexed there, as warned; on-disk MOC + sibling reads are the authoritative surface for this worktree).

MOC membership: already satisfied — emulation.md line 48 lists this note under "Memory & image loading (SRAM-only window; flash-mapped refused)". The note also carries `esp32-s3` in topics frontmatter; esp32-s3.md is an auto-generated stub explicitly awaiting a human "real MOC?" decision, so it was not force-populated (membership is covered by the curated emulation.md).

Links added (all inline + Relevant Notes, em-dash annotated to match vault style; edits confined to note 075 only):
- [[the-esp32-s3-maps-one-sram-block-at-both-an-iram-and-a-dram-address-so-an-emulator-can-model-it-as-a-single-window-aliased-to-two-bus-addresses]] (077) — inline at "480 KB SRAM window are copied"; reciprocates the pre-existing 077→075 link (077 already pointed at this note in prose + Relevant Notes).
- [[flash-mapped-irom-and-drom-segments-carry-post-mapping-virtual-addresses-so-an-emulator-serves-them-read-only-straight-from-the-image]] (076) — inline at the flash-bus refusal; 076 already references this note's policy in prose ("read-only counterpart to the loader policy that accepts only SRAM-resident segments"), so this links the pair explicitly.
- [[the-esp-idf-app-image-checksum-is-the-xor-of-all-segment-data-bytes-seeded-with-0xef-stored-as-the-last-byte-of-the-16-aligned-image-body]] (074) — inline at the XOR-checksum sentence; the checksum prose was a ready-made anchor.

Faithful-emulator umbrella ([[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]], 063) link was already present from create phase — this is a cuts-as-refusals claim, correctly grouped there.

No reweave/verify (one phase only).

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)

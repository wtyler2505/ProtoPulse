---
description: ESP-IDF app images close with a one-byte XOR checksum seeded 0xEF over every segment's data, placed at the final 16-aligned offset before any SHA trailer
type: claim
confidence: verified
audience: [intermediate]
created: 2026-06-23
topics:
  - esp32-s3
  - emulation
provenance:
  source: "[[2026-06-11-esp32s3-emulator-core-verification]]"
  verified: 2026-06-23
  reliability: high
---
# The ESP-IDF app image checksum is the XOR of all segment data bytes seeded with 0xEF, stored as the last byte of the 16-aligned image body

After the 24-byte `esp_image_header_t` and its run of `segment_count` segment-header-plus-data records, an ESP-IDF app image ends with a single integrity byte. That byte is `ESP_CHECKSUM_MAGIC = 0xEF` XOR-folded over every byte of every segment's *data* payload — not the headers, not the load addresses, just the segment bytes. The result is then placed as the last byte of an image body that has been padded out to a 16-byte boundary, where the padding count includes the checksum byte itself (pad to 16 counting one checksum byte). So the checksum's position is computable: it is always the final byte of the 16-aligned body, and everything before it up to the first segment is what feeds the fold.

This is why a raw-image loader can validate without parsing intent. It walks the segment table to learn each `data_len`, accumulates `acc ^= byte` across all segment data starting from `acc = 0xEF`, then seeks to the last byte of the 16-aligned body and compares: a match means the segment bytes arrived intact. The [[an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones|`@protopulse/emu` loader does exactly this fold]], which is cheap and deterministic — a single pass, no crypto.

The deliberate boundary is what comes *after*. When the header's `hash_appended` flag is set, a SHA-256 digest follows the checksum byte; the emulator skips verifying it, because the XOR fold already proves byte-level integrity for the in-process load it needs, and SHA verification would model nothing the emulator depends on. Naming that skip — checksum verified, SHA trailer not — is the same fidelity-boundary discipline the core applies everywhere: validate what load correctness requires, disclose what is left unchecked.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[an-sram-only-emulator-can-still-load-esp-idf-app-images-by-loading-only-sram-resident-segments-and-refusing-flash-mapped-ones]] — the loader that runs this fold; it walks the same segment table to copy SRAM-resident segments and refuse flash-mapped ones, then validates with the checksum described here
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the parent cut-list note; the SHA-skip here is one of those documented cuts
- [[emulating-only-24-bit-xtensa-core-instructions-is-sufficient-because-the-esp-toolchain-assembler-emits-no-16-bit-code-density-forms]] — a sibling slice-derived fact about what the same emulator chooses to model

Topics:
- [[esp32-s3]]
- [[emulation]]

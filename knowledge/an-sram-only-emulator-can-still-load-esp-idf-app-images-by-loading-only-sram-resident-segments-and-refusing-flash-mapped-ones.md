---
description: An SRAM-only ESP32-S3 emulator stays useful by loading per-segment SRAM targets and refusing IROM/DROM flash-mapped ones as a documented cut
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
# An SRAM-only emulator can still load ESP-IDF app images by loading only SRAM-resident segments and refusing flash-mapped ones

A naive reading says an emulator that models no flash cache cannot run a real ESP-IDF binary, since those images target both SRAM and flash-mapped address space. The `@protopulse/emu` Esp32s3Core shows why that conclusion is wrong: the app-image format is *segment-granular*, so the loader can accept the parts it understands and refuse the parts it doesn't, image-by-image, rather than rejecting the whole binary.

The mechanism follows the on-disk format directly. After the 24-byte `esp_image_header_t` (magic `0xE9`, `segment_count`, `entry_addr`, `chip_id = 0x0009` for the S3), the loader walks `segment_count` records — each an `esp_image_segment_header_t` carrying a `load_addr` (u32 little-endian) and `data_len`. For every segment it inspects the load address: addresses that fall inside the 480 KB SRAM window are copied into emulated memory — a window that is itself [[the-esp32-s3-maps-one-sram-block-at-both-an-iram-and-a-dram-address-so-an-emulator-can-model-it-as-a-single-window-aliased-to-two-bus-addresses|a single array aliased to both the IRAM and DRAM bus addresses]], so a segment lands in one buffer regardless of which bus its vaddr names; addresses on the flash-mapped buses — [[the-esp32-s3-memory-map-and-peripheral-register-set-spans-aliased-sram-windows-flash-cache-irom-drom-windows-and-gpio-uart-sens-timg-and-interrupt-matrix-register-banks-at-fixed-base-addresses|`0x42xxxxxx` (instruction / IROM) and `0x3Cxxxxxx` (data / DROM), the exact region boundaries tabulated in the memory map]] — are *refused with a message*, because the flash cache that would back those windows is not modeled. The refusal is deliberate and visible, not a silent skip, so the caller knows exactly which segments never loaded.

This is the honest boundary rather than a workaround. The alternative — faking a flash mapping the core cannot actually service — would let a binary appear to load and then diverge from silicon undetectably, which is worse than a named refusal. (The complementary policy, for an emulator that *does* want those windows, is to serve them read-only straight from the image — [[flash-mapped-irom-and-drom-segments-carry-post-mapping-virtual-addresses-so-an-emulator-serves-them-read-only-straight-from-the-image|the segment vaddrs are already post-MMU-mapping addresses]] — but the SRAM-only core declines even that and simply refuses.) The same loader verifies the XOR checksum ([[the-esp-idf-app-image-checksum-is-the-xor-of-all-segment-data-bytes-seeded-with-0xef-stored-as-the-last-byte-of-the-16-aligned-image-body|seeded `0xEF`, the last byte of the 16-byte-aligned body]]) but skips the appended SHA-256 trailer; each check and each cut is stated so a downstream user knows what was validated. The result is a loader that is useful for SRAM-resident firmware and clear about where its fidelity stops.

---

Source: [[2026-06-11-esp32s3-emulator-core-verification]]

Relevant Notes:
- [[a-faithful-instruction-set-emulator-earns-trust-by-documenting-every-deliberate-cut-alongside-what-it-models]] — the general principle: this segment-refusal is one instance of pairing each capability with its documented cut
- [[the-esp32-s3-maps-one-sram-block-at-both-an-iram-and-a-dram-address-so-an-emulator-can-model-it-as-a-single-window-aliased-to-two-bus-addresses]] — the aliased single-window this loader fills; SRAM-resident segments land in one buffer no matter which bus their vaddr names
- [[flash-mapped-irom-and-drom-segments-carry-post-mapping-virtual-addresses-so-an-emulator-serves-them-read-only-straight-from-the-image]] — the read-only counterpart policy for the IROM/DROM segments this loader instead refuses
- [[the-esp-idf-app-image-checksum-is-the-xor-of-all-segment-data-bytes-seeded-with-0xef-stored-as-the-last-byte-of-the-16-aligned-image-body]] — the XOR-fold this loader runs over the same segment table; the validation half of "validate what's required, disclose what's cut"
- [[the-esp32-s3-memory-map-and-peripheral-register-set-spans-aliased-sram-windows-flash-cache-irom-drom-windows-and-gpio-uart-sens-timg-and-interrupt-matrix-register-banks-at-fixed-base-addresses]] — the SRAM window and IROM/DROM flash-bus boundaries this loader keys each segment's copy-or-refuse decision on

Topics:
- [[esp32-s3]]
- [[emulation]]

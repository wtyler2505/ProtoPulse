---
description: "The MFRC522 (and most 13.56MHz RFID modules) only reads ISO 14443A tags (MIFARE Classic/Ultralight) at ~5cm range — this eliminates long-range tracking, multi-standard NFC, and non-MIFARE tags from the design space"
type: claim
source: "docs/parts/rc522-mfrc522-rfid-reader-13mhz-spi-3v3.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[sensors]]"
related_components:
  - "rc522-mfrc522-rfid-reader"
---

# RFID 13MHz reads only ISO 14443A tags within 5cm limiting use to contact-range applications

The RC522 module uses the NXP MFRC522 IC operating at 13.56MHz — the HF (High Frequency) RFID band. It communicates exclusively with ISO 14443A-compatible tags: MIFARE Classic 1K/4K and MIFARE Ultralight. It does NOT read:

- ISO 14443B tags (used in some government IDs)
- ISO 15693 tags (longer range "vicinity" cards)
- FeliCa (Sony's contactless standard, common in Japan)
- UHF RFID tags (the kind in retail anti-theft systems, 860-960MHz)
- NFC Forum Type 2/4 NDEF messages (partial support only)

The practical read range is ~5cm and depends heavily on antenna size (the PCB trace antenna on the module vs. the tag's coil). Larger credit-card-sized tags read at the full 5cm; small key fobs may need 2-3cm.

**Design implications:**

1. **Access control / attendance** — Perfect use case. Present card → read UID → match against database. The short range is actually a feature (prevents accidental reads).
2. **Inventory tracking at distance** — Wrong technology. Need UHF RFID (not available in common Arduino modules).
3. **NFC phone interaction** — Partially works. Android phones can emulate ISO 14443A, but iOS is restricted. Not reliable for consumer-facing NFC applications.
4. **Multi-tag reading** — The MFRC522 supports anti-collision per ISO 14443A-3, allowing sequential reads of multiple tags in the field, but throughput is limited.

**For the bench coach:** When a user adds an RC522 to their design, ask what they're reading. If it's "any NFC tag" or "tags from far away," they need a different module (PN532 for broader NFC support, or a UHF reader for range).

---

Relevant Notes:
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] -- RC522 is 3.3V-only, part of the level-shifting pattern
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] -- RC522 SPI wiring changes per board

Topics:
- [[communication]]
- [[sensors]]

---
description: "MIFARE Classic cards ship with well-known default keys (FFFFFFFFFFFFh) and the Crypto-1 cipher was broken in 2008 — these cards provide identification (who are you?) not security (prove it). Real access control needs MIFARE DESFire or proper challenge-response"
type: claim
source: "docs/parts/rc522-mfrc522-rfid-reader-13mhz-spi-3v3.md"
confidence: proven
topics:
  - "[[communication]]"
related_components:
  - "rc522-mfrc522-rfid-reader"
---

# MIFARE Classic default keys are public knowledge making it unsuitable for real security

MIFARE Classic 1K/4K cards use the proprietary Crypto-1 cipher for sector authentication. This was reverse-engineered and publicly broken in 2008 (the "Darkside" and "Nested" attacks). Any card using MIFARE Classic can be cloned with cheap equipment (~$20 Proxmark3 clone or even an Android phone with NFC).

The cards ship with factory default keys: `FF FF FF FF FF FF` for Key A and Key B on all sectors. Most Arduino tutorials never change these keys, meaning the "security" of a student access control project is equivalent to writing a UID on a sticky note.

**What this means for maker projects:**

1. **UID-only authentication** (most Arduino RFID tutorials) — The UID is read-only and unique per card, but it's broadcast in cleartext. Anyone with a reader can capture it. Suitable for: personal projects, demos, non-critical identification.
2. **Sector data authentication** — Even with custom keys, Crypto-1 is broken. Suitable for: keeping honest people honest, low-stakes applications.
3. **Actual security** — Requires MIFARE DESFire EV2/EV3 (AES-128) or NTAG 424 DNA (with server-side verification). The RC522 cannot communicate with DESFire cards; you need a PN532 or PN5180.

**For the bench coach:** If a user describes their project as "secure door lock" or "payment system," warn that MIFARE Classic provides identification, not authentication. For hobby/demo purposes it's fine. For anything protecting real assets, recommend upgrading the card type AND the reader module.

---

Relevant Notes:
- [[rfid-13mhz-reads-only-iso-14443a-tags-within-5cm-limiting-use-to-contact-range-applications]] -- Range and protocol constraints of the same module

Topics:
- [[communication]]

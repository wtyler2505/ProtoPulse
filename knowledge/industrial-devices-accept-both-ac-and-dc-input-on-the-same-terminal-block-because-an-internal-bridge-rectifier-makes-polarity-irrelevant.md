---
description: "When an industrial device spec shows both a DC voltage range (8-20V DC) and an AC voltage range (20-24V AC) on the same input terminal, it has an internal bridge rectifier — polarity doesn't matter on AC, and the rectifier turns the AC input into usable DC internally, simplifying field wiring at the cost of two diode drops"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[power-systems]]"
---

# Industrial devices accept both AC and DC input on the same terminal block because an internal bridge rectifier makes polarity irrelevant

When a device datasheet lists both a DC range AND an AC range on the same input terminal (e.g. the AXIS Q1755 accepts 8-20V DC OR 20-24V AC on its terminal block), the device has an internal bridge rectifier.

Implications:
- **Polarity doesn't matter** on either AC or DC input — the bridge rectifier produces the same DC bus regardless of which terminal is "+"
- **Installers can wire it wrong** and the device still works, which is a deliberate field-tolerance design choice for industrial/security equipment
- **The AC range is HIGHER than the DC range** because two diode drops (~1.4V) plus the √2 peak relationship means a 24V AC input produces about the same internal DC as a 20V DC input
- **Filtering is required on the AC side** — there's usually a bulk cap after the bridge; the device may specify minimum AC current capacity (VA rating, 17.4VA here) higher than DC watts to account for the PFC and ripple

Why industrial/commercial equipment uses this pattern:
- **Legacy compatibility** — older CCTV and alarm systems ran on 24V AC transformers; new equipment must accept those installations
- **Field wiring reliability** — electricians and installers don't always check polarity
- **Transformer cost** — a bare 24V AC transformer is cheaper than a regulated 12V DC supply, and the device handles rectification internally

Recognize the pattern at bench check: if the device spec says "dual AC/DC input," don't worry about polarity on the terminal block. If it says DC only, you MUST get polarity right — the device likely has a polarity-protected input that will refuse to power on (best case) or smoke (worst case) on reversed polarity.

---

Source: docs_and_data

Relevant Notes:
- [[polarity-protection-diode-trades-one-volt-of-headroom-for-dead-short-absorption-during-reversed-power]] — alternative protection strategy for DC-only devices

Topics:
- [[power-systems]]

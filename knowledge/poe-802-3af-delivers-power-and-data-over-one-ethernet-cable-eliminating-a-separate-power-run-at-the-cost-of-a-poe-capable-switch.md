---
description: "Power over Ethernet IEEE 802.3af collapses power and data onto a single Cat5/Cat6 cable, which simplifies installation (one cable pull per device) but requires a PoE-capable switch or midspan injector and limits delivered power to about 12.95W at the device (Class 3)"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[power-systems]]"
---

# PoE 802.3af delivers power and data over one Ethernet cable, eliminating a separate power run at the cost of a PoE-capable switch

IEEE 802.3af (the original PoE standard, 2003) delivers DC power over the same 4-pair Ethernet cable that carries data. The architectural value is not efficiency — it's installation simplicity: one cable pull, one connector, power and network together.

Key numbers:
- **48V DC nominal** on the cable (44-57V operating range)
- **15.4W max at the source** (PSE — Power Sourcing Equipment)
- **12.95W max at the device** (PD — Powered Device) after cable losses
- **Class 3 allocation** covers 6.49-12.95W — the typical slot for IP cameras, VoIP phones, WAPs

Device side: a PoE-compliant device like the AXIS Q1755 negotiates its power class with the switch during link-up. Devices that draw more than their class pay a penalty: the switch may refuse power, the LLDP negotiation may fail, or the device will run intermittently.

Follow-on standards unlock more power: 802.3at (PoE+, 25.5W), 802.3bt (PoE++, 60-100W for Type 3 and 4). A device designed for 802.3af works on higher-wattage switches; the reverse is only true if the power budget fits.

Integration requirement: the switch/injector MUST support the standard. A "passive PoE" dumb injector that just shoves 48V down the cable without negotiation can damage compliant devices, and vice versa — compliant switches refuse to power passive-PoE devices.

---

Source: [[docs_and_data]]

Relevant Notes:
- [[rs-485-differential-signaling-survives-long-cable-runs-and-electrical-noise-where-single-ended-serial-would-fail]] — another deployment pattern for long-distance device networks

Topics:
- [[communication]]
- [[power-systems]]

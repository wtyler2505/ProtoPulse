---
description: "ATmega328P has 2 VCC pins, ATmega2560 has 4, many ICs separate AVCC from DVCC -- each VCC pin needs its own 100nF capacitor because on-die power distribution does not internally connect them for high-frequency purposes"
type: knowledge-note
source: "docs/parts/100nf-ceramic-capacitor-104-50v-decoupling-bypass.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Multi-VCC ICs need one decoupling capacitor per VCC pin not one per package

Many ICs have multiple power supply pins, and each one requires its own decoupling capacitor:

| IC | VCC Pins | Decoupling Needed |
|----|----------|-------------------|
| ATmega328P (Arduino Uno) | VCC + AVCC | 2 x 100nF |
| ATmega2560 (Arduino Mega) | 2x VCC + AVCC + AREF | 4 x 100nF |
| 74HC595 shift register | VCC | 1 x 100nF |
| ESP32 (module) | Usually pre-decoupled | On-module caps present |
| Op-amp (dual supply) | V+ and V- | 2 x 100nF (one per rail) |

**Why one-per-pin, not one-per-package:** Inside the IC die, the bond wires and internal traces connecting multiple VCC pads have significant inductance at MHz frequencies. A single external decoupling capacitor on one VCC pin does not effectively decouple the other VCC pin because the internal inductance creates too much impedance between them. Each pin is, electrically, a separate high-frequency power entry point.

**The AVCC trap:** Many MCUs have a separate AVCC pin for the analog subsystem. Even when AVCC is externally connected to VCC (which is common on simple designs), it STILL needs its own decoupling capacitor. The purpose is not just to provide power -- it is to isolate the analog power domain from digital switching noise. A single cap on VCC does nothing for AVCC noise isolation.

**BOM implication:** The "one cap per IC" rule underestimates the capacitor count. A design with 5 ICs might need 8-12 decoupling capacitors, not 5. ProtoPulse's DRC should count VCC pins, not IC packages, when checking decoupling completeness.

**The cross-voltage-domain case (level shifters):** the rule also applies to ICs where the multiple VCC pins intentionally sit on DIFFERENT supply domains, not just duplicated rails. The TXS0108E auto-direction level shifter has VCCA (1.2-3.6V) and VCCB (1.65-5.5V) on two physically separate rails — one per voltage side. The spec requires a 100nF ceramic decoupling cap on EACH rail, placed as close to its pin as possible. Omitting either cap degrades signal integrity on the corresponding side, and the failure is asymmetric — losing the VCCB cap corrupts high-side edges but leaves low-side clean, which makes the bug hard to bisect. The DRC rule generalizes: for any IC, count each distinct supply domain as a separate decoupling requirement, regardless of whether the domains are redundant rails or cross-voltage translation rails.

---

Relevant Notes:
- [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]] -- The per-IC rule that this note refines to per-pin
- [[analog-ics-need-decoupling-more-critically-than-digital-because-supply-noise-directly-contaminates-signal-measurements]] -- AVCC decoupling is especially critical for analog accuracy
- [[txs0108e-vcca-must-be-the-lower-voltage-rail-because-the-chip-enforces-asymmetric-supply-roles]] -- the cross-voltage-domain case that also requires per-rail decoupling

Topics:
- [[passives]]
- [[eda-fundamentals]]

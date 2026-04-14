---
description: "The TB6612 includes internal clamp diodes on all four outputs, matching the L293D and unlike the L298N — this changes the selection calculus because the L298N's 2A advantage over the TB6612 is partially consumed by the need to add four external fast-recovery diodes, a cost the TB6612 eliminates"
type: claim
source: "docs/parts/osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[shields]]"
related_components:
  - "osepp-tb6612-motor-shield"
  - "l298n-dual-h-bridge-motor-driver"
  - "l293d-dual-h-bridge-ic"
---

# TB6612 internal flyback diodes eliminate the external protection burden that L298N requires

Every inductive load produces a back-EMF spike when switched off. The standard protection is a flyback diode per output, clamped to the supply rails. The L293D integrates these diodes on-die (the "D" suffix in the part number marks their presence — see [[the-d-suffix-on-l293d-denotes-built-in-clamp-diodes-and-the-non-d-variant-is-a-destructive-substitution]]). The L298N omits them entirely, requiring four external fast-recovery diodes (see [[l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory]]). The TB6612 matches the L293D in this regard: all four outputs have integrated body diodes from the MOSFET structure itself, clamping back-EMF without external parts.

**Why MOSFETs get flyback protection "for free":** The MOSFET body diode is a parasitic PN junction between drain and source that exists because of how the transistor is manufactured. In the standard low-side MOSFET orientation within an H-bridge, this body diode is anti-parallel to the motor current and conducts exactly when back-EMF would otherwise destroy the transistor. No extra silicon area is required, and switching speed (trr) of modern body diodes is fast enough to clamp motor-scale spikes. The TB6612 datasheet explicitly rates these internal diodes for the full motor current range.

**Why this matters for shield comparison:** The raw current specs suggest the L298N (2A) is better than the TB6612 (1.2A) whenever 1.2A is insufficient. But the L298N's 2A advantage comes with hidden costs: four external diodes, a heatsink, and the fast-recovery diode selection discipline (1N4007 is too slow; 1N5819 Schottky or UF4007 required). For a hobby project, adding four through-hole diodes plus a heatsink adds board area, soldering time, and BOM cost — and the L298N shield may or may not include them depending on the specific model variant. The TB6612 shield needs none of this. Effective comparable cost shifts the break-even point toward the TB6612.

**For beginners this is especially decisive:** Pre-assembled L298N modules from Amazon/AliExpress sometimes ship with onboard flyback diodes and sometimes do not, with no reliable visual indicator. A TB6612 shield has no such ambiguity — every output is always protected because the diodes are inside the IC. The common beginner failure mode of "motor runs fine for weeks then suddenly the driver is dead" usually traces to missing flyback diodes on an L298N; the TB6612 eliminates that entire failure class.

**Complementary, not replacement for bypass capacitors:** Internal diodes clamp the large inductive spike but do not absorb the high-frequency ringing that also appears during switching. A bypass capacitor across motor terminals (100nF ceramic + optional 10uF electrolytic) is still recommended per [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]]. The TB6612's internal diodes handle the diode's job; they do not cover the capacitor's job.

---

Source: [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]]

Relevant Notes:
- [[l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory]] — the counterpoint showing the L298N's protection burden
- [[the-d-suffix-on-l293d-denotes-built-in-clamp-diodes-and-the-non-d-variant-is-a-destructive-substitution]] — the L293D has integrated diodes via a different mechanism (explicit diode die)
- [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]] — complementary protection that internal diodes do not replace
- [[drc-should-flag-direct-gpio-to-inductive-load-connections-and-suggest-driver-plus-flyback-subcircuit]] — the validation rule that TB6612-based designs can satisfy without external parts

Topics:
- [[actuators]]
- [[shields]]

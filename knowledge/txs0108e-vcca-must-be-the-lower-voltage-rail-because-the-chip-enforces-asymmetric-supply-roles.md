---
description: "The TXS0108E's A-side and B-side are not interchangeable — VCCA is spec'd 1.2-3.6V and VCCB is spec'd 1.65-5.5V with the hard constraint that VCCA must be less than or equal to VCCB, so swapping the rails puts the chip outside its operating envelope and produces undefined behavior even when both voltages are legal individually"
type: claim
source: "docs/parts/txs0108e-8-channel-bidirectional-level-shifter-auto-direction.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[eda-fundamentals]]"
related_components:
  - "txs0108e-level-shifter"
---

# TXS0108E VCCA must be the lower voltage rail because the chip enforces asymmetric supply roles

Most cross-voltage design thinking assumes level shifter sides are symmetric — pick which side gets 3.3V and which gets 5V based on wiring convenience. The TXS0108E breaks this assumption. The A-side and B-side have different allowed supply ranges, and the chip requires VCCA to be the lower voltage of the two. Swapping the sides is not a routing decision; it violates the chip's operating spec.

**The asymmetric ranges are structural:**

| Pin | Allowed supply range | Role |
|-----|----------------------|------|
| VCCA | 1.2V to 3.6V | Low-voltage side — must be <= VCCB |
| VCCB | 1.65V to 5.5V | High-voltage side — must be >= VCCA |

**Why the constraint exists:** the one-shot edge accelerators (see [[active-level-shifters-use-one-shot-edge-accelerators-to-drive-rising-edges-breaking-the-bss138-rc-ceiling]]) use level-detection circuits that reference VCCA as the low-rail threshold and VCCB as the high-rail threshold. If VCCA exceeds VCCB, the circuit's threshold assumptions invert and the direction-sensing fails before any signal arrives. The chip may still pass signals at rest but will not translate correctly during transitions.

**The legal-but-wrong failure mode:** both 3.3V and 5V are inside the allowed ranges individually. Putting 5V on VCCA and 3.3V on VCCB violates no single voltage rating, but violates the VCCA <= VCCB invariant. The chip doesn't fail hard (no magic smoke) — it just translates unreliably, which is the worst failure mode because it passes continuity checks and looks alive on a scope during DC probing.

**Wiring rule for mixed-MCU projects:** when bridging an ESP32 (3.3V) to an Arduino Uno (5V), VCCA goes to the ESP32 rail and VCCB goes to the Uno rail. This is NOT interchangeable. When bridging a 1.8V sensor to a 3.3V MCU, VCCA still goes to the lower rail (1.8V sensor side). The A-side always faces the lower-voltage device.

**The DRC-level consequence:** a schematic with VCCA connected to 5V and VCCB connected to 3.3V passes voltage-range checks on each pin individually but fails the cross-pin invariant. Catching this requires a rule that compares VCCA and VCCB supplies during schematic review. ProtoPulse's level-shifter DRC should include this cross-pin check, not just per-pin voltage bounds.

---

Source: [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]]

Relevant Notes:
- [[active-level-shifters-use-one-shot-edge-accelerators-to-drive-rising-edges-breaking-the-bss138-rc-ceiling]] — the mechanism whose threshold logic forces the asymmetry
- [[signal-topology-not-voltage-alone-determines-level-shifter-selection]] — the broader selection framework this wiring rule sits inside
- [[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]] — the passive counterpart where side symmetry is different (BSS138 is truly symmetric per channel)

Topics:
- [[shields]]
- [[eda-fundamentals]]

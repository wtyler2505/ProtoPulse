---
description: "Fast-blow fuses nuisance-trip on motor startup inrush; slow-blow at 125% peak (NEC 240) survives inrush while still blowing fast enough (<1s at 500%) to protect #4 AWG wiring from fire"
type: claim
source: "docs/parts/main-power-switch-anl-fuse-100a-disconnect-for-36v.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "anl-100-fuse"
---

# Slow-blow fuse sizing at 125 percent peak prevents nuisance trips while protecting wiring

Motor systems have a fundamental tension between overcurrent protection and operational current surges. A motor that draws 16A continuously can pull 3-5x that during startup (48-80A), and a stalled motor draws even more. Four motors starting simultaneously can briefly demand 200-300A. A fast-blow fuse sized to protect the wiring (100A) would blow on the first simultaneous motor start.

**The NEC Article 240 resolution:** Use a time-delay (slow-blow) fuse sized at 125% of the maximum expected continuous current. For a 4-motor system with 80A peak sustained draw: 1.25 x 80A = 100A.

**The ANL-100 time-current curve makes this work:**

| Current draw | Duration before blow | Scenario |
|---|---|---|
| 100A (100%) | Indefinite | Normal peak operation -- fuse holds |
| 125A (125%) | >1 hour | Mild overload -- enough time to notice and shut down |
| 200A (200%) | ~60 seconds | Severe overload or partial short -- blows before wire damage |
| 300A (300%) | 1-5 seconds | Hard overload -- blows fast |
| 500A (500%) | <1 second | Dead short -- blows almost instantly |
| 1000A (1000%) | <100ms | Catastrophic short -- blows before wire temperature rises |

The key insight is the INVERSE time characteristic: the worse the fault, the faster the protection. A dead short (the most dangerous scenario) clears in under 100ms, well before #4 AWG wire reaches ignition temperature. A mild overload takes minutes, giving the operator time to notice something is wrong before the fuse sacrifices itself.

**Wire protection coordination:** The 100A fuse must protect the wire it's attached to. #4 AWG has an ampacity of 85-95A (depending on insulation and ambient temperature). The fuse holds at 100A continuously but the wire can handle 85-95A continuously -- the fuse is slightly oversized for the wire. This is acceptable because the derating ensures the fuse blows before the wire overheats at any fault current above 125%.

---

Relevant Notes:
- [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]] -- placement of this fuse in the power chain
- [[individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system]] -- downstream per-circuit fuses provide more granular protection
- [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] -- the per-controller 20A fuse that coordinates with this 100A main fuse

Topics:
- [[power-systems]]
- [[eda-fundamentals]]

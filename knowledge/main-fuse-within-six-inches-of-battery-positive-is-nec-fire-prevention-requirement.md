---
description: "Any wire between battery positive and the first fuse is UNPROTECTED -- NEC requires the fuse within 6 inches of the terminal to minimize the length of unprotected wire that could short and start a fire"
type: claim
source: "docs/parts/main-power-switch-anl-fuse-100a-disconnect-for-36v.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "anl-100-fuse"
---

# Main fuse within six inches of battery positive is NEC fire prevention requirement

The wire between a battery's positive terminal and the first overcurrent protection device (fuse) is the most dangerous wire in the entire system. It has zero protection. If this wire shorts to ground -- through abrasion against a metal chassis, a loose terminal touching a frame bolt, or a rodent chewing through insulation -- the full short-circuit current of the battery flows through the fault. For a 10S lithium ion pack, that can exceed 500A.

A 500A short through #4 AWG wire will heat the wire to glowing temperatures in seconds and ignite any nearby insulation, plastic, fabric, or fuel. The battery's internal BMS may trip, but not all BMS units have reliable short-circuit protection (especially salvaged ones), and some have a 50-100ms delay that's enough for ignition.

The NEC (National Electrical Code, Article 240) requirement: the fuse must be within 6 inches (15cm) of the battery positive terminal. The sizing rule: 125% of the maximum continuous current draw (NEC Article 240). For a 4-motor rover with 80A peak: 1.25 x 80A = 100A.

**ANL-100 slow-blow (time-delay) fuse selection rationale:**
- Slow-blow is required because motor startup inrush can briefly exceed the rated current (200% for 60 seconds is within the time-current curve)
- Fast-blow fuses would nuisance-trip on every motor start
- The 100A rating means the fuse holds indefinitely at rated current but blows in <1 second at 500% (500A) and <100ms at 1000% (1000A)
- 80V DC voltage rating exceeds the 42V maximum of a fully charged 10S pack

**ProtoPulse implication:** The power distribution schematic should show fuse placement distance from battery terminal. The DRC should flag any fuse that is more than 6 inches from the battery positive or sized below 125% of peak current.

---

Relevant Notes:
- [[ac-switches-cannot-interrupt-dc-arcs-and-will-cause-fire-or-explosion-in-battery-systems]] -- the switch downstream of this fuse must also be DC-rated
- [[star-ground-at-distribution-board-prevents-ground-loops-in-multi-circuit-systems]] -- the ground path architecture that complements this positive-side fuse
- [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] -- per-controller fuses downstream provide additional granular protection

Topics:
- [[power-systems]]
- [[eda-fundamentals]]

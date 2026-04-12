---
description: "All circuit ground returns meet at a single point (star topology) on the distribution board -- prevents motor current from flowing through sensor ground paths and creating noise or false readings"
type: claim
source: "docs/parts/power-distribution-board-fused-terminal-block-for-36v-system.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "power-distribution-board"
---

# Star ground at distribution board prevents ground loops in multi-circuit systems

In a system with four 16A motor controllers and several sensitive electronics circuits, the ground return path matters as much as the power distribution path. If motor grounds daisy-chain through the electronics ground bus (series topology), motor current creates voltage drops across the shared ground wire that appear as noise on every sensor, ADC, and communication bus downstream.

**The problem (series/daisy-chain ground):**
```
MC1 GND → MC2 GND → MC3 GND → MC4 GND → Buck GND → Battery (-)
           ↑ Motor current from MC1 flows through all these segments
             Each segment has I*R voltage drop that shifts the "ground" reference
```

At 16A through even #14 AWG wire (8.3 mohm/ft), a 2-foot ground wire between motor controller and the next stage creates a 0.27V ground shift. Four motors running simultaneously can shift the electronics ground by over 1V -- enough to corrupt ADC readings, cause I2C errors, or trigger spurious interrupts.

**The solution (star ground at distribution board):**
```
MC1 GND ────→ GND BUS BAR ←──── Battery (-)
MC2 GND ────→ GND BUS BAR
MC3 GND ────→ GND BUS BAR
MC4 GND ────→ GND BUS BAR
Buck 12V GND → GND BUS BAR
Buck 5V GND ─→ GND BUS BAR
```

Every circuit returns directly to a single, heavy copper bus bar. Motor current flows from MC1 directly to the bus bar and back to the battery without passing through any other circuit's ground path. The bus bar itself has negligible resistance due to its massive cross-section.

**ProtoPulse implication:** The power distribution schematic should enforce star ground topology and flag any daisy-chained ground returns. The DRC should check that all ground returns terminate at a common bus, not at each other.

---

Relevant Notes:
- [[individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system]] -- positive-side isolation complements ground-side star topology
- [[parallel-power-rails-from-battery-are-more-reliable-than-cascaded-regulators]] -- parallel topology extends to ground returns, not just power
- [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]] -- the upstream protection that feeds this distribution point

Topics:
- [[power-systems]]
- [[eda-fundamentals]]

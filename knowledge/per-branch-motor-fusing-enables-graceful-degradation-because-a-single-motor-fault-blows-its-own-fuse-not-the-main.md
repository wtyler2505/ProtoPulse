---
description: "Each of four motor controllers gets its own inline 10A fuse so a stall or short in one motor blows only that fuse, leaving the other three motors running for a limp-home capability that a single main fuse would destroy"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-36v-battery-power-distribution-4-tier-system.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "riorand-zs-x11h"
  - "hoverboard-10s-battery-pack"
---

# Per-branch motor fusing enables graceful degradation because a single motor fault blows its own fuse not the main

A 4WD rover with a single 40A main fuse and no per-motor protection has a brittle failure mode: when any one motor stalls, shorts, or locks up, the combined current trips the main fuse and all four motors die at once. The rover becomes a brick in the field. Adding a 10A inline fuse per motor controller transforms this: the faulted motor's individual fuse blows first, isolating that wheel while the other three keep operating.

The math: a 4-motor system has 40A of shared capacity on the main fuse. A single motor's peak is around 15A (12A continuous plus inrush), and a stalled motor can pull 25A+. A 10A per-branch fuse sized slightly below a healthy motor's peak draw but well above its continuous load will blow in milliseconds on a dead short, before the combined overcurrent reaches the 40A main threshold. The isolation is automatic and requires no MCU intervention.

The design pattern generalizes: any time N parallel loads share a power bus, individual branch fusing provides failure isolation that a single bus fuse cannot. Each branch fuse protects its wiring segment and contains the fault to one subsystem. The main fuse becomes a last-resort protector for the bus itself, not the primary protection for each consumer. This is the motor-specific instance of the broader distribution-board pattern in [[individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system]], which adds the 12V buck branch and the bolt-down voltage-rating gotcha (32V automotive fuses are marginal on a 42V bus).

The fuse-class selection must follow the interrupt-capacity physics: per-branch 10A fuses sit well below the degradation threshold so standard ATC blade fuses are adequate, but the upstream 100A main cannot use blade-class hardware -- it must be the ceramic bolt-down class described in [[anl-marine-fuse-class-is-the-correct-selection-for-rover-main-bus-above-60a-because-automotive-blade-fuses-lose-interrupt-capacity-at-dc]]. The two tiers are not interchangeable, and the hierarchy breaks if either tier is wrong.

This is the same reasoning that drives residential electrical code: one main breaker per panel, but individual circuit breakers per room/load. When the microwave shorts, only its breaker trips -- the refrigerator keeps running. Apply the same thinking to a rover: when motor 2 shorts, only motor 2 dies.

Per-branch fusing is especially load-bearing for the ZS-X11H specifically, since [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] -- the inline branch fuse is not an optional redundancy layer but the sole overcurrent protection the controller has.

The trade-off: more fuses means more places to fail and more parts to diagnose. A blown branch fuse produces a confusing symptom ("one wheel doesn't spin but the rover still drives") that requires systematic testing to locate. This is better than "rover is dead" but worse than "rover is working" -- an intermediate state that firmware should detect and report. Hall sensor feedback from each motor can catch a dead wheel immediately, since [[hall-sensor-feedback-from-bldc-hub-motors-provides-rpm-and-direction-without-encoders]].

---

Source: [[wiring-36v-battery-power-distribution-4-tier-system]]

Relevant Notes:
- [[individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system]] -- overlapping-scope sibling: same fault-isolation pattern but from the distribution-board perspective (covers 12V buck branches too, and the 32V vs 58V blade-fuse rating gotcha)
- [[anl-marine-fuse-class-is-the-correct-selection-for-rover-main-bus-above-60a-because-automotive-blade-fuses-lose-interrupt-capacity-at-dc]] -- upstream-tier counterpart: the main bus needs ANL class while branches can use blade class; the hierarchy is what makes graceful degradation work
- [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] -- the controller-specific justification for why per-branch fusing is load-bearing, not redundant
- [[slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring]] -- the sizing math applies to branch fuses as well as main fuses
- [[power-budget-hierarchy-ensures-continuous-is-below-peak-is-below-fuse-is-below-wire-ampacity]] -- per-branch fuses need the same hierarchy on the branch wiring
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] -- per-branch fuses complement firmware limiting; both are needed

Topics:
- [[power-systems]]
- [[eda-fundamentals]]

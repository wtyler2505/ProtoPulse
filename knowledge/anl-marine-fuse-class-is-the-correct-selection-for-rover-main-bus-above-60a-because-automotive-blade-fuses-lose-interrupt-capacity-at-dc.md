---
description: "Standard ATC/ATO automotive blade fuses are rated 32V DC with interrupt capacity that degrades at higher voltages and currents -- ANL marine/industrial fuses with bolt-down studs and ceramic bodies are rated 125V DC and maintain reliable interrupt behavior at the 100A currents a rover main bus demands"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-36v-battery-power-distribution-4-tier-system.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "anl-100-fuse"
---

# ANL marine fuse class is the correct selection for rover main bus above 60A because automotive blade fuses lose interrupt capacity at DC

The standard automotive fuse ecosystem (ATC, ATO, Mini, Maxi) is engineered around 12V DC automotive buses. The fuse bodies are plastic, the element is stamped metal, and the voltage rating is typically 32V DC. At 32V, these fuses are marginally qualified for 36V rover service -- the interrupt capacity (the current they can actually break on a short circuit) degrades rapidly above their rated voltage. A "100A" Maxi blade fuse asked to interrupt a 200A short at 42V may fail to break cleanly: the arc across the melted element sustains until something else in the circuit gives up, which could mean wire insulation catching fire.

ANL fuses (Automotive Naval Limited) belong to a different class entirely. They are designed for marine, RV, and industrial DC applications where higher voltages (12V to 48V+) and larger currents (80A to 500A) are routine. The body is ceramic, the element is a large copper or zinc alloy strip, and the mounting is bolt-down via M8 or M10 studs rather than spring clips. The interrupt rating at 32V DC is typically 6000A -- enough to cleanly break any fault current a reasonable rover battery can deliver.

The slow-blow characteristic of ANL fuses is a second reason they suit rover service. Motor inrush current on a 4-motor system can briefly exceed 200A during simultaneous startup, well above the 100A steady-state limit the main bus protects. A fast-blow fuse at 100A would nuisance-trip on every startup. The ANL's slow-blow curve tolerates short-duration overcurrent (>100% for <1 second) while still reliably blowing on sustained overcurrent (>500% for <0.1 second). This matches motor startup physics, since [[slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring]].

The practical selection rule: if the main bus current exceeds 50-60A, or the bus voltage exceeds 30V, ANL class fuses are the correct choice. Below those thresholds, larger Maxi blade fuses are adequate. For per-branch fuses on individual motor controllers (10A each), standard ATC automotive fuses are fine -- the voltage is still 36V but the current is well below the interrupt-capacity degradation point.

The cost is modest. An ANL 100A fuse is around $6-10; the bolt-down fuse block is $15-25. Both are one-time purchases that protect a battery pack worth $100+ and wiring worth hours of install labor.

---

Source: [[wiring-36v-battery-power-distribution-4-tier-system]]

Relevant Notes:
- [[slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring]] -- the sizing rule this fuse selection obeys
- [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]] -- the placement rule that applies to ANL fuses as well
- [[ac-switches-cannot-interrupt-dc-arcs-and-will-cause-fire-or-explosion-in-battery-systems]] -- the same physics (DC arc suppression) drives both switch and fuse selection

Topics:
- [[power-systems]]
- [[eda-fundamentals]]

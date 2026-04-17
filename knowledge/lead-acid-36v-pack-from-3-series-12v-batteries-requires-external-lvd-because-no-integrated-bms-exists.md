---
description: "Three 12V SLA batteries wired in series produce 36V but lack the integrated BMS that lithium packs include -- protecting lead acid from over-discharge requires an external low-voltage disconnect module, since continued discharge below 10.5V per battery causes permanent sulfation damage"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-36v-battery-power-distribution-4-tier-system.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
---

# Lead acid 36V pack from 3 series 12V batteries requires external LVD because no integrated BMS exists

Lithium-ion packs for rover applications almost always ship with a BMS that handles cell balancing, overcurrent, overvoltage, undervoltage, and short-circuit protection. Lead-acid packs built from 3 series-connected 12V batteries do not. The batteries are designed to be drop-in replacements for automotive starting applications where alternator regulation handles charging and low-discharge protection is not critical. Wiring three in series for a 36V rover bus inherits none of the protection infrastructure. (On the lithium side, even a present BMS is not automatically trustworthy -- see [[salvaged-bms-has-unknown-thresholds-and-must-be-verified-before-trusting-with-project-safety]] -- but "untrusted BMS" is a different problem than "no BMS at all".)

The critical missing protection is over-discharge. Lead-acid chemistry is permanently damaged by discharge below about 10.5V per battery (31.5V for the 3S pack). Sulfate crystals form on the plates and do not dissolve back on recharge, permanently reducing capacity. A single deep-discharge event can lose 20-30% of pack capacity; repeated events turn a 12Ah pack into a 3Ah pack over a few cycles. The battery keeps working, just at a fraction of rated capacity, confusing troubleshooting.

The mitigation is an external low-voltage disconnect (LVD) module -- typically an automotive-grade relay circuit rated for 36V/40A -- wired between the battery pack and the main bus. When pack voltage drops to 31.5V, the relay opens and disconnects the load. [[lvd-hysteresis-with-reconnect-voltage-above-cutoff-prevents-oscillation-at-the-threshold-boundary]] applies: the reconnect threshold should be higher than the cutoff (typically 33V) to allow real recovery rather than instant reconnection.

Lead-acid packs also lack cell balancing. In a 3S pack, each 12V battery ages independently. After a year of use, one battery may hold 11V at rest while the other two hold 12.5V. Charging the pack as a unit (41.4V constant voltage) overcharges the good ones while undercharging the weak one, accelerating divergence. For long-term reliability, each 12V battery needs periodic individual charging and capacity testing.

The trade-off makes lead-acid attractive despite these gaps. The packs are cheap, readily available, tolerate abuse (short circuits don't cause fires), and don't require specialized chargers. For a workshop rover that lives plugged in and rarely deep-discharges, lead-acid plus an external LVD is a reasonable choice. For an untethered field rover, the lithium chemistries are worth the added cost and complexity -- but note that switching chemistry is not a drop-in: a [[lifepo4-12s-pack-nominal-38v4-exceeds-36v-design-target-and-must-be-verified-against-controller-upper-limit|12S LiFePO4 replacement]] sits 2.4V higher at nominal and 1.8V higher at full charge than a 10S NMC pack, cascading into downstream voltage-tolerance changes throughout the bus.

---

Source: [[wiring-36v-battery-power-distribution-4-tier-system]]

Relevant Notes:
- [[nmc-vs-lifepo4-is-a-tradeoff-between-energy-density-and-cycle-life-safety]] -- the lithium alternative comparison
- [[lvd-hysteresis-with-reconnect-voltage-above-cutoff-prevents-oscillation-at-the-threshold-boundary]] -- how the external LVD must be configured
- [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]] -- contrasts with lead acid: no such integrated protection exists
- [[salvaged-bms-has-unknown-thresholds-and-must-be-verified-before-trusting-with-project-safety]] -- the lithium-side caveat: a present BMS is not a trusted BMS without empirical verification
- [[lifepo4-12s-pack-nominal-38v4-exceeds-36v-design-target-and-must-be-verified-against-controller-upper-limit]] -- a concrete lithium alternative with its own downstream-voltage burden, not a drop-in replacement

Topics:
- [[power-systems]]
- [[eda-fundamentals]]

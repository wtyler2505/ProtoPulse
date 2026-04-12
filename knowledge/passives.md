---
description: "Passive component knowledge -- capacitor types and selection, transistor biasing, resistor networks, shift registers, and discrete component design patterns"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# passives

Capacitor selection (ceramic vs electrolytic vs film), transistor switching circuits, potentiometer circuits, shift register cascading, and discrete component design patterns for the inventory. Covers decoupling, bulk filtering, BJT switching, and IO expansion.

## Knowledge Notes

### Crystal & Timing
- [[npo-c0g-dielectric-is-mandatory-for-crystal-load-capacitors-because-temperature-driven-capacitance-drift-shifts-oscillator-frequency]] — NPO/C0G drifts <1% vs X7R ~15% vs Y5V ~80%; wrong dielectric = clock drift with temperature
- [[crystal-load-capacitance-equals-the-series-combination-of-two-matched-caps-plus-stray-capacitance]] — Two 22pF caps + stray = ~20pF load for 16MHz crystals; the formula that determines what cap value to buy
- [[unmarked-small-ceramic-capacitors-are-a-practical-inventory-hazard-requiring-physical-separation-or-labeling]] — 22pF and 100nF discs look identical; swapping silently shifts oscillator frequency or degrades decoupling

### LED Current Limiting
- [[led-forward-voltage-varies-by-color-creating-a-graduated-resistor-selection-problem]] — Red 1.8-2.2V through blue/white 3.0-3.4V; resistor must match color Vf
- [[blue-and-white-leds-are-marginal-at-3v3-because-forward-voltage-nearly-equals-supply-voltage]] — 0-0.3V headroom at 3.3V means no room for current-limiting resistor
- [[330-ohm-resistor-is-the-safe-universal-default-for-any-led-color-at-5v]] — 6-10mA at 5V depending on color; safe for all GPIO budgets
- [[led-polarity-has-four-physical-identification-methods-and-getting-it-wrong-is-a-silent-failure]] — Reversed polarity = zero light, zero damage, maximum confusion
- [[rgb-common-cathode-leds-need-three-independent-resistors-and-three-pwm-pins-for-color-mixing]] — Different Vf per channel means different resistor per channel; consumes 3 PWM pins

### Decoupling & Bypass
- [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]] — The universal rule: one 100nF per VCC pin, as close as possible
- [[missing-decoupling-capacitors-produce-three-distinct-failure-modes]] — Brownout resets, ADC noise, and serial glitches from missing caps
- [[analog-ics-need-decoupling-more-critically-than-digital-because-supply-noise-directly-contaminates-signal-measurements]] — ADCs/DACs/op-amps couple supply noise directly into signal path
- [[multi-vcc-ics-need-one-decoupling-capacitor-per-vcc-pin-not-one-per-package]] — ATmega328P needs 2 caps (VCC + AVCC), not 1
- [[dielectric-tolerance-is-irrelevant-for-decoupling-because-the-exact-capacitance-value-does-not-matter-for-transient-suppression]] — X7R/Y5V acceptable for decoupling; save NPO for timing
- [[three-digit-ceramic-capacitor-codes-encode-picofarads-as-two-significant-digits-times-a-power-of-ten-multiplier]] — 104 = 100nF, 103 = 10nF, 220 = 22pF

### Bulk Filtering & Electrolytic Safety
- [[electrolytic-capacitor-voltage-derating-to-80-percent-of-rated-voltage-is-mandatory-for-reliability]] — 80% max operating voltage is the standard derating rule
- [[ripple-current-rating-is-the-hidden-selection-constraint-for-electrolytic-capacitors-in-power-supply-filtering]] — The spec beginners skip; exceeding it kills caps faster than voltage
- [[every-10c-above-rated-temperature-halves-aluminum-electrolytic-capacitor-lifespan]] — Arrhenius rule: keep caps away from heat sources
- [[dormant-aluminum-electrolytics-require-reforming-before-full-voltage-application]] — Shelf life is finite; reform before using old stock
- [[reversed-polarity-on-aluminum-electrolytic-capacitors-causes-violent-catastrophic-failure]] — Unlike LEDs, reversed electrolytics explode
- [[high-voltage-capacitors-store-dangerous-energy-that-persists-after-circuit-power-off]] — 9.4J at 200V; discharge procedure mandatory
- [[dielectric-absorption-causes-voltage-recovery-in-discharged-electrolytic-capacitors]] — Caps recover voltage after discharge; check twice
- [[electrolytic-capacitor-part-numbers-encode-voltage-series-capacitance-tolerance-in-sequential-segments]] — 200MXR470M decoding; different from ceramic 3-digit codes
- [[axial-electrolytic-form-factor-exits-leads-from-both-ends-and-is-common-in-vintage-equipment-but-rare-in-modern-pcb-designs]] — Axial vs radial mounting; breadboard awkwardness; vintage/surplus signal
- [[industrial-grade-electrolytic-capacitors-are-rated-for-5000-plus-hours-versus-2000-hours-for-generic-parts-making-manufacturer-reputation-a-selection-criterion]] — CDE/Rubycon 5000h vs generic 2000h; quality gap amplified by temperature derating
- [[axial-cylindrical-components-can-roll-off-a-workbench-and-must-be-secured-during-handling]] — Physical bench safety for cylindrical axial parts

### Part Identification
- [[systematic-part-identification-workflow-for-unidentified-inventory-read-markings-then-cross-reference-then-measure]] — Three-step procedure: markings, distributor lookup, instrument measurement

### MOSFET Switching
- [[logic-level-mosfet-gate-threshold-below-3v-eliminates-need-for-gate-driver-circuit]] — P30N06LE driven directly from 3.3V/5V GPIO without gate driver
- [[floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot]] — 10K gate-source resistor prevents floating gate during MCU reset
- [[low-side-mosfet-switching-puts-load-between-supply-and-drain-with-source-at-ground]] — standard N-channel topology for MCU-driven load switching

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]

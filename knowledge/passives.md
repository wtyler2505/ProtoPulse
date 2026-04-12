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

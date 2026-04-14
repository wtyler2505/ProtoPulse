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

### Film Capacitors
- [[film-capacitors-have-essentially-unlimited-lifespan-because-there-is-no-electrolyte-to-dry-out]] — No electrolyte = no degradation clock; practical 20-50+ year life
- [[polyester-film-capacitors-self-repair-minor-dielectric-breakdowns-by-vaporizing-metallized-film-around-the-fault]] — Self-healing via metallized electrode vaporization at fault sites
- [[polyester-film-capacitors-have-less-capacitance-drift-than-ceramic-and-no-piezoelectric-effect-making-them-superior-for-audio-and-timing]] — Film vs ceramic stability; no microphonics for audio
- [[film-capacitors-across-relay-or-switch-contacts-suppress-contact-arcing-as-snubber-circuits]] — Snubber topology: cap across contacts quenches arc, distinct from flyback diode
- [[high-voltage-rating-on-a-small-capacitor-does-not-imply-danger-because-stored-energy-depends-on-capacitance-times-voltage-squared]] — 75nF/400V = 6mJ vs 470uF/200V = 9.4J; safety should key on energy not voltage

### AC Mains / X-Class / Y-Class Capacitors
- [[class-x2-capacitors-connect-across-live-and-neutral-where-short-circuit-failure-only-trips-a-fuse-not-shocks-a-user]] — X2 class safety rating: fail-short to fuse, not to shock
- [[x-class-capacitors-filter-line-to-line-while-y-class-filter-line-to-ground-and-swapping-them-is-a-certification-violation]] — X vs Y topology: line-to-line vs line-to-ground; swap = certification violation
- [[x2-capacitor-rated-275v-ac-targets-230v-mains-with-headroom-for-peak-voltage-and-transients-not-just-rms]] — 275V AC rating targets 230V mains peak + transient headroom
- [[capacitor-climatic-category-encodes-min-temp-max-temp-and-humidity-duration-as-three-slash-separated-numbers]] — three-slash climatic code: min/max/humidity duration

### BJT Switching
- [[bjt-saturation-requires-base-current-above-collector-current-divided-by-minimum-hfe-making-base-resistor-calculation-a-forced-gain-problem]] — Ib > Ic/hFE_min; base resistor sizing is the fundamental BJT design step
- [[to-92-package-limits-power-dissipation-to-625mw-and-requires-derating-above-25c-making-thermal-math-mandatory-for-high-current-switching]] — 625mW free-air limit; partial saturation dramatically increases dissipation
- [[bjt-switching-tops-out-at-600ma-in-to-92-and-the-transition-to-mosfet-is-a-hard-architecture-boundary]] — Hard boundary: BJT for <600mA, MOSFET above; not a gradual preference
- [[3v3-gpio-driving-a-bjt-base-loses-21-percent-of-supply-voltage-to-vbe-leaving-less-headroom-for-the-base-resistor]] — 2.6V headroom at 3.3V vs 4.3V at 5V; use lower R_base or higher-hFE transistor
- [[drc-should-flag-direct-gpio-to-inductive-load-connections-and-suggest-driver-plus-flyback-subcircuit]] — DRC rule: inductive load needs driver transistor + flyback diode
- [[s8050-vce-saturation-voltage-is-double-that-of-pn2222a-at-equivalent-current-making-it-dissipate-twice-the-switching-power]] — S8050 0.6V vs PN2222A 0.3V Vce(sat); gain-vs-efficiency trade-off
- [[transistor-selection-trades-voltage-ceiling-for-gain-and-the-decision-boundary-is-load-voltage-plus-gpio-voltage]] — PN2222A vs S8050 decision tree: load voltage first, then GPIO voltage

### Potentiometers
- [[a-potentiometer-wired-as-voltage-divider-converts-mechanical-rotation-to-proportional-analog-voltage-for-mcu-analogread]] — VCC-wiper-GND pattern; self-contained divider, no external resistor needed
- [[b-taper-linear-potentiometer-is-for-voltage-sensing-and-a-taper-logarithmic-is-for-audio-volume-and-confusing-them-is-a-silent-design-error]] — B vs A taper; wrong choice looks like a software bug
- [[potentiometer-20-percent-resistance-tolerance-is-irrelevant-in-voltage-divider-mode-because-output-depends-on-wiper-position-ratio-not-absolute-resistance]] — 20% tolerance cancels in divider mode; ratio, not absolute value

### MOSFET Switching
- [[logic-level-mosfet-gate-threshold-below-3v-eliminates-need-for-gate-driver-circuit]] — P30N06LE driven directly from 3.3V/5V GPIO without gate driver
- [[floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot]] — 10K gate-source resistor prevents floating gate during MCU reset
- [[low-side-mosfet-switching-puts-load-between-supply-and-drain-with-source-at-ground]] — standard N-channel topology for MCU-driven load switching
- [[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]] — BSS138 body-diode enables passive bidirectional level shifting
- [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]] — 400kHz ceiling forces TXS/74HCT for faster signals

### Diodes & Protection
- [[relay-coil-is-an-inductor-that-generates-destructive-back-emf-spikes-when-de-energized]] — relay de-energization spike; flyback diode is the canonical mitigation
- [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]] — bypass cap across motor terminals absorbs back-EMF

### Part Identification Workflow
- [[systematic-part-identification-workflow-for-unidentified-inventory-read-markings-then-cross-reference-then-measure]] — Three-step procedure: markings, distributor lookup, instrument measurement
- [[salvaged-generic-components-have-no-datasheets-so-specs-must-be-determined-empirically]] — salvaged parts require empirical characterization (no datasheets)
- [[axial-cylindrical-components-can-roll-off-a-workbench-and-must-be-secured-during-handling]] — physical bench safety for axial cylindrical parts

### Shift Registers
- [[74hc595-trades-3-gpio-pins-for-n-times-8-digital-outputs-via-serial-shift-and-parallel-latch]] — The canonical IO expansion: 3 pins → 8 outputs per chip, daisy-chainable to 80+
- [[74hc595-output-current-is-6ma-per-pin-and-70ma-total-making-it-led-capable-but-not-actuator-capable]] — LED-driving budget constraints; need ULN2003/MOSFET above 6mA per output
- [[74hc595-latch-separates-data-shifting-from-output-update-preventing-glitches-during-serial-load]] — Two-stage architecture prevents visual glitches during serial data load
- [[74hc595-oe-pin-on-pwm-enables-hardware-brightness-control-of-all-outputs-simultaneously]] — OE pin on PWM = free global brightness control from one GPIO
- [[74hc595-srclr-and-oe-are-active-low-control-pins-that-must-be-tied-correctly-or-outputs-fail-silently]] — Active-LOW gotcha: SRCLR→VCC, OE→GND, or silent failure
- [[daisy-chained-74hc595s-share-clock-and-latch-lines-so-n-chips-update-simultaneously-from-one-latch-pulse]] — Cascading topology: QH'→SER, shared clock/latch, 3 pins for any chain length

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]

---
description: "Power system knowledge -- battery management, voltage regulation, power distribution, fusing, emergency stop, and multi-voltage tier design for 36V rover systems"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# power-systems

Battery management, voltage regulation, power distribution architecture, fusing strategy, and safety systems for the inventory. Covers LiPo/BMS, buck converters, linear regulators, MOSFETs, E-stop circuits, and multi-tier power distribution.

## Knowledge Notes
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] — four voltage tiers with different supply, regulation, and isolation requirements
- [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]] — Darlington architecture wastes up to 40% of supply voltage as heat; MOSFET drivers solve this
- [[relay-coil-draws-70ma-which-exceeds-gpio-limits-on-every-common-mcu]] — relay coil current requires driver transistor between GPIO and coil
- [[relay-coil-is-an-inductor-that-generates-destructive-back-emf-spikes-when-de-energized]] — flyback diode clamps back-EMF; 1N4007 correct for relay (not motor) frequencies
- [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]] — 36V nominal is only a moment on the discharge curve; full range is 30-42V
- [[salvaged-bms-has-unknown-thresholds-and-must-be-verified-before-trusting-with-project-safety]] — unknown overcurrent, undervoltage, thermal thresholds on salvaged BMS
- [[lithium-ion-charging-requires-cc-cv-profile-and-a-raw-power-supply-will-overcharge-cells]] — bench PSU skips CC phase; use purpose-built 10S charger
- [[nmc-vs-lifepo4-is-a-tradeoff-between-energy-density-and-cycle-life-safety]] — chemistry choice cascades into charger, BMS, motor performance, and safety
- [[switching-buck-converters-waste-watts-not-volts-making-them-essential-for-large-voltage-differentials]] — linear regulators waste 31W at 36V->5V; switching wastes ~1W
- [[parallel-power-rails-from-battery-are-more-reliable-than-cascaded-regulators]] — parallel topology isolates failure and noise between 12V and 5V rails
- [[counterfeit-lm2596-chips-are-common-on-cheap-modules-and-fail-under-heavy-load]] — test at full current before deployment; $1 modules are frequently fake
- [[linear-regulator-heat-dissipation-equals-voltage-drop-times-current-making-high-differential-applications-dangerous]] — P=(Vin-Vout)*I makes linear regs impractical above ~10V differential
- [[78xx-regulators-require-input-and-output-capacitors-close-to-pins-for-stability]] — 0.33uF input + 0.1uF output within 10mm of pins

### Breadboard Power
- [[independent-per-rail-voltage-selection-enables-mixed-voltage-breadboard-prototyping-without-isolation-circuits]] — MB V2 dual-voltage via independent jumpers per rail
- [[breadboard-power-module-700ma-total-budget-excludes-servos-and-motors-requiring-separate-power]] — AMS1117 total budget excludes all actuators
- [[wrong-jumper-voltage-on-breadboard-power-module-silently-destroys-3v3-components-with-no-warning]] — overvoltage from jumper misconfiguration is irreversible

### Emergency Stop + Safety
- [[emergency-stop-must-use-normally-closed-contacts-because-wire-failure-must-equal-safe-shutdown]] — NC contacts ensure any failure mode = power cut
- [[two-stage-estop-separates-control-circuit-from-power-circuit-for-safe-high-current-interruption]] — 12/24V control circuit operates 36V/100A contactor
- [[dc-contactor-must-have-magnetic-blowout-arc-suppression-or-contacts-will-weld-under-dc-load]] — DC arcs do not self-extinguish at zero-crossing
- [[twist-to-release-estop-prevents-accidental-restart-after-emergency-shutdown]] — latching mechanism requires deliberate rotation to re-engage

### Fusing + Main Disconnect
- [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]] — unprotected wire between battery and fuse must be minimized
- [[ac-switches-cannot-interrupt-dc-arcs-and-will-cause-fire-or-explosion-in-battery-systems]] — DC disconnect must have DC-specific interrupt rating
- [[slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring]] — time-delay characteristics coordinate with motor inrush

### Power Distribution
- [[star-ground-at-distribution-board-prevents-ground-loops-in-multi-circuit-systems]] — all grounds return to single bus bar
- [[individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system]] — per-circuit fuses enable graceful degradation
- [[power-budget-hierarchy-ensures-continuous-is-below-peak-is-below-fuse-is-below-wire-ampacity]] — four-number ordering constraint

### LCD Panel Power
- [[tft-lcd-panels-require-four-distinct-voltage-rails-serving-different-panel-subsystems]] — AVDD, VGH, VGL, VCOM each serve a different panel subsystem
- [[lcd-panel-power-rail-sequencing-on-power-up-and-power-down-prevents-latch-up-damage]] — Wrong order triggers destructive latch-up
- [[vcom-voltage-is-panel-specific-and-requires-the-lcd-panels-own-datasheet-to-calibrate]] — No universal VCOM default; requires per-panel calibration
- [[step-up-converters-combined-with-charge-pumps-generate-both-positive-and-negative-rails-from-a-single-positive-input]] — Boost + charge pump generates full rail set from single input
- [[multi-rail-pmics-still-require-external-inductors-capacitors-and-diodes-per-rail-and-are-not-standalone-solutions]] — "Integrated" PMICs need 15-25 external components
- [[salvaged-lcd-driver-boards-are-practical-pmic-sources-for-driving-recovered-tft-panels]] — Salvage shortcut avoids TQFN soldering

### Capacitor Reliability
- [[electrolytic-capacitor-voltage-derating-to-80-percent-of-rated-voltage-is-mandatory-for-reliability]] — 80% max operating voltage for lifespan
- [[every-10c-above-rated-temperature-halves-aluminum-electrolytic-capacitor-lifespan]] — Arrhenius rule; placement near heat is a primary killer
- [[ripple-current-rating-is-the-hidden-selection-constraint-for-electrolytic-capacitors-in-power-supply-filtering]] — The spec beginners ignore; exceeds voltage in lifespan impact
- [[high-voltage-capacitors-store-dangerous-energy-that-persists-after-circuit-power-off]] — 9.4J at 200V; active discharge mandatory
- [[dielectric-absorption-causes-voltage-recovery-in-discharged-electrolytic-capacitors]] — Voltage recovery after discharge; check twice
- [[dormant-aluminum-electrolytics-require-reforming-before-full-voltage-application]] — Shelf life finite; reform old stock before use

### MOSFET Switching
- [[logic-level-mosfet-gate-threshold-below-3v-eliminates-need-for-gate-driver-circuit]] — P30N06LE driven directly from 3.3V/5V GPIO
- [[floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot]] — 10K gate-source resistor prevents floating gate during reset
- [[low-side-mosfet-switching-puts-load-between-supply-and-drain-with-source-at-ground]] — standard topology for MCU-driven MOSFET switching

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]

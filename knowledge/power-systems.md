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

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]

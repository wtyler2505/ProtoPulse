---
description: "Motor drivers, LCD power rails, capacitors, and MOSFET switching"
type: moc
topics:
  - "[[power-systems]]"
---

# power-components-switching

Driver efficiency, multi-rail LCD power, electrolytic capacitor reliability, and MOSFET switching circuits.

## Notes
### Driver-efficiency ladder
- [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]] — Darlington architecture wastes up to 40% of supply voltage as heat; MOSFET drivers solve this
- [[tb6612-mosfet-h-bridge-drops-0-5v-versus-darlington-1-8-to-4-9v-because-rds-on-resistance-beats-saturation-voltage]] — architectural reason MOSFET H-bridges (TB6612) beat Darlington H-bridges (L293D, L298N)
- [[tb6612-motor-supply-ceiling-of-13-5v-is-a-hard-selection-boundary-against-l298n-for-24v-and-36v-motor-systems]] — voltage dimension limits MOSFET driver selection; forces L298N use above 13.5V
- [[tb6612-standby-pin-adds-a-fifth-motor-state-below-brake-and-coast-with-sub-microamp-quiescent-current]] — sub-uA sleep mode that MOSFET drivers permit and Darlington drivers cannot
- [[active-current-limiting-motor-drivers-throttle-output-instead-of-crowbar-shutdown-preserving-motion-under-transient-overload]] — active limiting at driver level interacts with fuse coordination at the power budget level
- [[motor-driver-with-integrated-bec-can-power-the-arduino-directly-eliminating-a-separate-buck-converter-if-the-bec-current-is-sufficient]] — integrated BEC removes a discrete buck converter at the cost of shared ground noise

### LCD panel power
- [[tft-lcd-panels-require-four-distinct-voltage-rails-serving-different-panel-subsystems]] — AVDD, VGH, VGL, VCOM each serve a different panel subsystem
- [[lcd-panel-power-rail-sequencing-on-power-up-and-power-down-prevents-latch-up-damage]] — wrong order triggers destructive latch-up
- [[vcom-voltage-is-panel-specific-and-requires-the-lcd-panels-own-datasheet-to-calibrate]] — no universal VCOM default; requires per-panel calibration
- [[step-up-converters-combined-with-charge-pumps-generate-both-positive-and-negative-rails-from-a-single-positive-input]] — boost + charge pump generates full rail set from single input
- [[multi-rail-pmics-still-require-external-inductors-capacitors-and-diodes-per-rail-and-are-not-standalone-solutions]] — "integrated" PMICs need 15-25 external components
- [[salvaged-lcd-driver-boards-are-practical-pmic-sources-for-driving-recovered-tft-panels]] — salvage shortcut avoids TQFN soldering

### Capacitor reliability (bulk + electrolytics)
- [[electrolytic-capacitor-voltage-derating-to-80-percent-of-rated-voltage-is-mandatory-for-reliability]] — 80% max operating voltage for lifespan
- [[every-10c-above-rated-temperature-halves-aluminum-electrolytic-capacitor-lifespan]] — Arrhenius rule; placement near heat is a primary killer
- [[ripple-current-rating-is-the-hidden-selection-constraint-for-electrolytic-capacitors-in-power-supply-filtering]] — the spec beginners ignore; exceeds voltage in lifespan impact
- [[high-voltage-capacitors-store-dangerous-energy-that-persists-after-circuit-power-off]] — 9.4J at 200V; active discharge mandatory
- [[dielectric-absorption-causes-voltage-recovery-in-discharged-electrolytic-capacitors]] — voltage recovery after discharge; check twice
- [[dormant-aluminum-electrolytics-require-reforming-before-full-voltage-application]] — shelf life finite; reform old stock before use
- [[reversed-polarity-on-aluminum-electrolytic-capacitors-causes-violent-catastrophic-failure]] — polarity reversal causes explosion, not just failure; orientation is critical
- [[industrial-grade-electrolytic-capacitors-are-rated-for-5000-plus-hours-versus-2000-hours-for-generic-parts-making-manufacturer-reputation-a-selection-criterion]] — manufacturer grade is a hidden reliability axis beyond datasheet specs

### MOSFET switching
- [[logic-level-mosfet-gate-threshold-below-3v-eliminates-need-for-gate-driver-circuit]] — P30N06LE driven directly from 3.3V/5V GPIO
- [[floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot]] — 10K gate-source resistor prevents floating gate during reset
- [[low-side-mosfet-switching-puts-load-between-supply-and-drain-with-source-at-ground]] — standard topology for MCU-driven MOSFET switching
- [[mcu-controlling-ac-motor-needs-a-relay-or-ssr-because-gpio-cannot-switch-mains-voltage-or-current-directly]] — MOSFETs stop at DC; AC-mains switching requires relay or SSR isolation
- [[relay-coil-draws-70ma-which-exceeds-gpio-limits-on-every-common-mcu]] — relay coil current requires driver transistor between GPIO and coil
- [[relay-coil-is-an-inductor-that-generates-destructive-back-emf-spikes-when-de-energized]] — flyback diode clamps back-EMF; 1N4007 correct for relay (not motor) frequencies

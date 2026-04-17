---
description: "Power system knowledge -- battery + BMS (10S Li-ion, lead-acid, LVD), linear + switching regulation, buck/boost topology, parallel rail distribution, fusing (ANL + slow-blow), two-stage E-stop with DC contactors, AC-mains safety capacitors (X-class line-to-line, Y-class line-to-ground), MOSFET low-side switching, and multi-voltage tier design for 36V rover systems"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# power-systems

Battery management, voltage regulation, power distribution architecture, fusing strategy, AC-mains safety components, and safety systems for the inventory (see [[hardware-components]] for physical specs). Covers LiPo/Li-ion/lead-acid + BMS/LVD, linear vs switching regulation, MOSFETs, E-stop + DC contactor circuits, X/Y mains safety capacitors, and multi-tier power distribution from battery through rails to MCU.

## Knowledge Notes

### Top-level power strategy
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] — four voltage tiers with different supply, regulation, and isolation requirements
- [[parallel-power-rails-from-battery-are-more-reliable-than-cascaded-regulators]] — parallel topology isolates failure and noise between 12V and 5V rails
- [[power-budget-hierarchy-ensures-continuous-is-below-peak-is-below-fuse-is-below-wire-ampacity]] — four-number ordering constraint

### Regulators
- [[switching-buck-converters-waste-watts-not-volts-making-them-essential-for-large-voltage-differentials]] — linear regulators waste 31W at 36V->5V; switching wastes ~1W
- [[linear-regulator-heat-dissipation-equals-voltage-drop-times-current-making-high-differential-applications-dangerous]] — P=(Vin-Vout)*I makes linear regs impractical above ~10V differential
- [[78xx-regulators-require-input-and-output-capacitors-close-to-pins-for-stability]] — 0.33uF input + 0.1uF output within 10mm of pins
- [[counterfeit-lm2596-chips-are-common-on-cheap-modules-and-fail-under-heavy-load]] — test at full current before deployment; $1 modules are frequently fake
- [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]] — onboard 5V LDO thermal envelope on Arduino Mega
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] — onboard 3V3 LDO current ceiling determines total ESP32 dev board load
- [[clone-arduino-voltage-regulators-can-overheat-silently-because-there-is-no-thermal-feedback]] — clone boards lack thermal shutdown safety margin
- [[10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts-because-radio-bursts-pull-current-faster-than-the-buck-regulator-responds]] — bulk cap closes the gap between WiFi burst demand and buck-regulator response time

### Driver-efficiency ladder (cross-link to actuators)
- [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]] — Darlington architecture wastes up to 40% of supply voltage as heat; MOSFET drivers solve this
- [[tb6612-mosfet-h-bridge-drops-0-5v-versus-darlington-1-8-to-4-9v-because-rds-on-resistance-beats-saturation-voltage]] — architectural reason MOSFET H-bridges (TB6612) beat Darlington H-bridges (L293D, L298N)
- [[tb6612-motor-supply-ceiling-of-13-5v-is-a-hard-selection-boundary-against-l298n-for-24v-and-36v-motor-systems]] — voltage dimension limits MOSFET driver selection; forces L298N use above 13.5V
- [[tb6612-standby-pin-adds-a-fifth-motor-state-below-brake-and-coast-with-sub-microamp-quiescent-current]] — sub-uA sleep mode that MOSFET drivers permit and Darlington drivers cannot
- [[active-current-limiting-motor-drivers-throttle-output-instead-of-crowbar-shutdown-preserving-motion-under-transient-overload]] — active limiting at driver level interacts with fuse coordination at the power budget level
- [[motor-driver-with-integrated-bec-can-power-the-arduino-directly-eliminating-a-separate-buck-converter-if-the-bec-current-is-sufficient]] — integrated BEC removes a discrete buck converter at the cost of shared ground noise

### Batteries + BMS (Li-ion, LiFePO4, lead-acid)
- [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]] — 36V nominal is only a moment on the discharge curve; full range is 30-42V
- [[linear-voltage-to-percentage-approximation-is-adequate-for-10s-li-ion-despite-the-nonlinear-discharge-curve]] — SOC linearization is adequate for fuel-gauge UI despite curve nonlinearity
- [[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]] — canonical divider for 10S Li-ion → 3V3 ADC
- [[salvaged-bms-has-unknown-thresholds-and-must-be-verified-before-trusting-with-project-safety]] — unknown overcurrent, undervoltage, thermal thresholds on salvaged BMS
- [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]] — single-path BMS output means any trip cuts logic supply
- [[bms-overcurrent-protection-tripping-on-acceleration-is-a-software-problem-solved-by-ramp-rate-limiting-not-a-hardware-fault]] — firmware ramp control is the correct fix, not a hardware upgrade
- [[lead-acid-36v-pack-from-3-series-12v-batteries-requires-external-lvd-because-no-integrated-bms-exists]] — lead-acid chemistry has no native BMS; LVD is mandatory
- [[lvd-hysteresis-with-reconnect-voltage-above-cutoff-prevents-oscillation-at-the-threshold-boundary]] — hysteresis window prevents chattering at the disconnect threshold
- [[lithium-ion-charging-requires-cc-cv-profile-and-a-raw-power-supply-will-overcharge-cells]] — bench PSU skips CC phase; use purpose-built 10S charger
- [[nmc-vs-lifepo4-is-a-tradeoff-between-energy-density-and-cycle-life-safety]] — chemistry choice cascades into charger, BMS, motor performance, and safety
- [[jst-ph-battery-connectors-have-no-universal-polarity-standard-so-reversed-connection-damages-charger-circuits]] — JST-PH polarity convention varies by vendor; verify with meter before connecting
- [[onboard-lipo-charging-via-mcp73831-makes-dev-board-battery-deployment-ready-without-external-circuits]] — MCP73831 integration on dev boards eliminates a discrete charger IC

### Breadboard + low-power power
- [[independent-per-rail-voltage-selection-enables-mixed-voltage-breadboard-prototyping-without-isolation-circuits]] — MB V2 dual-voltage via independent jumpers per rail
- [[breadboard-power-module-700ma-total-budget-excludes-servos-and-motors-requiring-separate-power]] — AMS1117 total budget excludes all actuators
- [[wrong-jumper-voltage-on-breadboard-power-module-silently-destroys-3v3-components-with-no-warning]] — overvoltage from jumper misconfiguration is irreversible

### Emergency stop + safety
- [[emergency-stop-must-use-normally-closed-contacts-because-wire-failure-must-equal-safe-shutdown]] — NC contacts ensure any failure mode = power cut
- [[two-stage-estop-separates-control-circuit-from-power-circuit-for-safe-high-current-interruption]] — 12/24V control circuit operates 36V/100A contactor
- [[dc-contactor-must-have-magnetic-blowout-arc-suppression-or-contacts-will-weld-under-dc-load]] — DC arcs do not self-extinguish at zero-crossing
- [[twist-to-release-estop-prevents-accidental-restart-after-emergency-shutdown]] — latching mechanism requires deliberate rotation to re-engage
- [[estop-auxiliary-contact-to-mcu-enables-firmware-aware-safe-state-that-hardware-disconnection-alone-cannot-signal]] — aux contact lets firmware enter safe-state gracefully rather than brown out

### Fusing + main disconnect
- [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]] — unprotected wire between battery and fuse must be minimized
- [[ac-switches-cannot-interrupt-dc-arcs-and-will-cause-fire-or-explosion-in-battery-systems]] — DC disconnect must have DC-specific interrupt rating
- [[slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring]] — time-delay characteristics coordinate with motor inrush
- [[anl-marine-fuse-class-is-the-correct-selection-for-rover-main-bus-above-60a-because-automotive-blade-fuses-lose-interrupt-capacity-at-dc]] — ANL marine fuse > automotive blade fuse above 60A DC

### Power distribution
- [[star-ground-at-distribution-board-prevents-ground-loops-in-multi-circuit-systems]] — all grounds return to single bus bar
- [[individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system]] — per-circuit fuses enable graceful degradation
- [[100uf-capacitor-on-arduino-5v-input-absorbs-motor-switching-emi-that-causes-mcu-resets]] — bulk cap at MCU power input cleans conducted EMI from motor rails

### AC-mains safety capacitors (Wave H — new territory)
- [[class-x2-capacitors-connect-across-live-and-neutral-where-short-circuit-failure-only-trips-a-fuse-not-shocks-a-user]] — X2 safety class: line-to-line position where shorted-failure mode is safe
- [[x-class-capacitors-filter-line-to-line-while-y-class-filter-line-to-ground-and-swapping-them-is-a-certification-violation]] — X vs Y distinction is safety-critical and regulatory, not interchangeable
- [[metallized-polypropylene-mkp-is-the-standard-x2-dielectric-because-it-combines-self-healing-with-high-pulse-voltage-tolerance]] — MKP dielectric is the de facto standard for AC-mains X2 caps
- [[x2-capacitor-rated-275v-ac-targets-230v-mains-with-headroom-for-peak-voltage-and-transients-not-just-rms]] — 275V AC rating is an RMS + transient budget, not a simple voltage ceiling
- [[ac-line-emi-filter-capacitors-degrade-silently-by-losing-capacitance-so-periodic-measurement-is-the-only-way-to-catch-a-worn-filter]] — X2 capacitor aging is invisible without periodic LCR measurement
- [[ac-line-emi-filters-are-bidirectional-protecting-the-device-from-grid-noise-and-preventing-device-noise-from-entering-the-grid]] — EMI filter has to block ingress AND egress, not just one direction

### LCD panel power (cross-link to displays)
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

### AC/DC input
- [[industrial-devices-accept-both-ac-and-dc-input-on-the-same-terminal-block-because-an-internal-bridge-rectifier-makes-polarity-irrelevant]] — internal bridge rectifier accepts both AC and DC on same terminals, polarity-insensitive but costs two diode drops

### MOSFET switching
- [[logic-level-mosfet-gate-threshold-below-3v-eliminates-need-for-gate-driver-circuit]] — P30N06LE driven directly from 3.3V/5V GPIO
- [[floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot]] — 10K gate-source resistor prevents floating gate during reset
- [[low-side-mosfet-switching-puts-load-between-supply-and-drain-with-source-at-ground]] — standard topology for MCU-driven MOSFET switching
- [[mcu-controlling-ac-motor-needs-a-relay-or-ssr-because-gpio-cannot-switch-mains-voltage-or-current-directly]] — MOSFETs stop at DC; AC-mains switching requires relay or SSR isolation
- [[relay-coil-draws-70ma-which-exceeds-gpio-limits-on-every-common-mcu]] — relay coil current requires driver transistor between GPIO and coil
- [[relay-coil-is-an-inductor-that-generates-destructive-back-emf-spikes-when-de-energized]] — flyback diode clamps back-EMF; 1N4007 correct for relay (not motor) frequencies

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]

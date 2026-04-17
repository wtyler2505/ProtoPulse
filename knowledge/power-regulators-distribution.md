---
description: "Power regulators, distribution topologies, and breadboard power"
type: moc
topics:
  - "[[power-systems]]"
---

# power-regulators-distribution

Voltage regulation, buck/boost converters, LDOs, distribution strategies, and breadboard power limits.

## Notes
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

### Breadboard + low-power power
- [[independent-per-rail-voltage-selection-enables-mixed-voltage-breadboard-prototyping-without-isolation-circuits]] — MB V2 dual-voltage via independent jumpers per rail
- [[breadboard-power-module-700ma-total-budget-excludes-servos-and-motors-requiring-separate-power]] — AMS1117 total budget excludes all actuators
- [[wrong-jumper-voltage-on-breadboard-power-module-silently-destroys-3v3-components-with-no-warning]] — overvoltage from jumper misconfiguration is irreversible

### Power distribution
- [[star-ground-at-distribution-board-prevents-ground-loops-in-multi-circuit-systems]] — all grounds return to single bus bar
- [[individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system]] — per-circuit fuses enable graceful degradation
- [[100uf-capacitor-on-arduino-5v-input-absorbs-motor-switching-emi-that-causes-mcu-resets]] — bulk cap at MCU power input cleans conducted EMI from motor rails

### AC/DC input
- [[industrial-devices-accept-both-ac-and-dc-input-on-the-same-terminal-block-because-an-internal-bridge-rectifier-makes-polarity-irrelevant]] — internal bridge rectifier accepts both AC and DC on same terminals, polarity-insensitive but costs two diode drops

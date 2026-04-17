---
description: "4-tier power distribution from a 36V/10S Li-ion pack: main-bus battery tap → per-branch fusing → per-motor controller feeds → MCU-logic regulated 5V/3.3V rails. Covers ANL fuse sizing, LVD hysteresis, 130K/10K ADC divider, decoupling placement, and separate logic supply discipline."
type: moc
topics:
  - "[[wiring-integration]]"
  - "[[power-systems]]"
  - "[[index]]"
---

# 36V battery power distribution (4-tier system)

4-tier power distribution from a 36V/10S Li-ion pack: main-bus battery tap → per-branch fusing → per-motor controller feeds → MCU-logic regulated 5V/3.3V rails. Covers ANL fuse sizing, LVD hysteresis, 130K/10K ADC divider, decoupling placement, and separate logic supply discipline.

## Knowledge Notes

- [[10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts-because-radio-bursts-pull-current-faster-than-the-buck-regulator-responds]] — ESP32 WiFi TX bursts draw 300mA pulses at kilohertz rates that exceed the LM2596's control loop bandwidth -- a 10uF ceramic bypass cap on
- [[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]] — A 130K top-leg and 10K bottom-leg divider maps 42V full-charge battery voltage to 3.0V at the ESP32 ADC pin, leaving 10 percent headroom
- [[anl-marine-fuse-class-is-the-correct-selection-for-rover-main-bus-above-60a-because-automotive-blade-fuses-lose-interrupt-capacity-at-dc]] — Standard ATC/ATO automotive blade fuses are rated 32V DC with interrupt capacity that degrades at higher voltages and currents -- ANL
- [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]] — The BMS discharge port feeds the entire downstream power tree -- motor bus, buck converters, and MCU -- so an overcurrent or undervoltage
- [[estop-auxiliary-contact-to-mcu-enables-firmware-aware-safe-state-that-hardware-disconnection-alone-cannot-signal]] — An e-stop with an auxiliary NC signal contact feeds a GPIO interrupt so firmware can distinguish a deliberate e-stop event from a power
- [[lead-acid-36v-pack-from-3-series-12v-batteries-requires-external-lvd-because-no-integrated-bms-exists]] — Three 12V SLA batteries wired in series produce 36V but lack the integrated BMS that lithium packs include -- protecting lead acid from
- [[lifepo4-12s-pack-nominal-38v4-exceeds-36v-design-target-and-must-be-verified-against-controller-upper-limit]] — A 12-series LiFePO4 pack reaches 43.8V at full charge and sits at 38.4V nominal -- substantially above a 36V-nominal Li-Ion pack -- which
- [[linear-voltage-to-percentage-approximation-is-adequate-for-10s-li-ion-despite-the-nonlinear-discharge-curve]] — A linear map of 42V=100% to 30V=0% is adequate for rover battery monitoring despite lithium-ion's flat discharge curve in the middle,
- [[lvd-hysteresis-with-reconnect-voltage-above-cutoff-prevents-oscillation-at-the-threshold-boundary]] — A low-voltage disconnect that reconnects at the same voltage it cut off at will oscillate on/off rapidly as the load drops, battery
- [[per-branch-motor-fusing-enables-graceful-degradation-because-a-single-motor-fault-blows-its-own-fuse-not-the-main]] — Each of four motor controllers gets its own inline 10A fuse so a stall or short in one motor blows only that fuse, leaving the other three

## Open Questions
(populated by /extract)

---

Topics:
- [[wiring-integration]]
- [[power-systems]]
- [[index]]

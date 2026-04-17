---
description: "Sensor knowledge -- measurement principles, calibration, interface protocols, and wiring gotchas for IR, Hall, reed, tilt, light, temperature, RTC, RFID, sound/PDM microphone, and compass/IMU sensors in the inventory"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# sensors

Sensor characteristics, filtering requirements, calibration traps, and protocol quirks for the inventory (see [[hardware-components]] for physical parts list). Covers optical, magnetic, environmental, inertial, and touch sensors, with an emphasis on separating physical phenomena from digital artifacts.

## Knowledge Notes

### IR Sensors & Remotes
- [[ir-demodulator-output-is-active-low-which-inverts-the-mental-model-of-signal-received-equals-pin-high]] — active-LOW output inverts beginner expectations
- [[fluorescent-lighting-interferes-with-38khz-ir-receivers-because-the-discharge-frequency-overlaps-the-demodulation-band]] — fluorescent lights cause false IR triggers via 38kHz harmonic overlap
- [[ir-transmitter-requires-software-generated-38khz-carrier-while-receiver-demodulates-in-hardware-creating-a-complexity-asymmetry]] — transmitter generates carrier in software, receiver demodulates in hardware
- [[kit-ir-receiver-modules-from-different-manufacturers-are-functionally-identical-tsop-38khz-demodulators]] — cross-vendor IR receiver modules are all TSOP 38kHz variants
- [[nec-ir-button-codes-are-manufacturer-specific-making-code-first-debugging-impossible-without-reading-your-own-remote]] — NEC codes are manufacturer-specific; dump your own remote first
- [[dead-coin-cell-is-the-invisible-first-failure-mode-on-kit-ir-remotes]] — CR2025/CR2032 failure masquerades as receiver or code problem
- [[bare-ir-led-breakout-modules-have-1-2m-range-and-extending-range-requires-a-driver-transistor]] — bare IR LED range is 1-2m; driver transistor extends

### Hall Effect Sensors
- [[hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position]] — open-collector Hall output; gray-coded 3-phase position
- [[hall-sensor-wiring-order-matters-for-bldc]] — swapping Hall lines corrupts BLDC commutation
- [[78l05-regulator-failure-kills-hall-power-making-motor-appear-dead-when-only-the-regulator-failed]] — Hall power regulator failure masquerades as motor failure
- [[pole-pair-count-is-determined-empirically-by-counting-hall-state-transitions-per-wheel-revolution]] — pole-pair count discovered empirically from Hall transitions
- [[bldc-controller-hall-sensor-outputs-are-push-pull-digital-making-txs-class-shifters-the-correct-bridge-to-3v3-mcus]] — push-pull Hall needs TXS-class level shifter, not passive BSS138

### Reed Switch Sensors
- [[reed-switches-rated-200v-1a-can-directly-switch-real-loads-not-just-signal-level-gpio]] — reed switches can switch real loads directly at 200V/1A
- [[reed-switch-sub-millisecond-response-enables-high-frequency-contactless-event-counting]] — reed sub-millisecond response enables contactless high-speed counting
- [[reed-switch-on-rotating-shaft-enables-contactless-rpm-measurement-via-pulse-counting]] — reed + magnet = contactless RPM sensor
- [[float-mounted-magnet-with-stationary-reed-switch-creates-contactless-liquid-level-sensing]] — reed + floating magnet = contactless liquid level sensor
- [[glass-reed-switch-envelope-is-fragile-and-bending-leads-near-body-cracks-hermetic-seal]] — glass envelope fragility; don't bend leads near body
- [[strong-magnets-permanently-magnetize-reed-switch-contacts-causing-stuck-closed-failure]] — rare-earth magnets can permanently magnetize contacts

### Tilt & Motion Sensors
- [[tilt-switch-mount-orientation-determines-trigger-behavior-and-must-be-tested-empirically]] — tilt switch orientation cannot be assumed from datasheet
- [[sw-520d-switching-angle-varies-15-45-degrees-per-unit-making-precise-tilt-threshold-design-impossible]] — SW-520D 3:1 unit variation; per-unit calibration required
- [[binary-tilt-detection-trades-precision-for-simplicity-and-zero-quiescent-power]] — tilt binary = zero current but no angle measurement
- [[ball-tilt-switches-need-20-50ms-debounce-because-the-mechanism-is-ball-oscillation-not-contact-bounce]] — ball tilt debounce is oscillation-driven, longer than contact bounce

### Light Sensors (Photoresistor / LDR)
- [[cds-photoresistors-are-rohs-restricted-because-cadmium-sulfide-is-a-regulated-hazardous-substance]] — cadmium sulfide cells are RoHS-restricted
- [[cds-photoresistors-have-logarithmic-response-making-them-qualitative-not-quantitative-light-sensors]] — CdS log-response; qualitative not quantitative
- [[photoresistor-response-time-of-20-30ms-makes-them-unsuitable-for-fast-optical-signals]] — 20-30ms response too slow for IR-remote-class signaling

### Temperature Sensors
- [[ds3231-built-in-temperature-sensor-is-free-but-only-accurate-to-3-degrees-making-it-unsuitable-for-precision-environmental-sensing]] — free +/-3C sensor on DS3231 misleads precision use cases

### Compass / IMU
- [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]] — clone detection, library selection, I2C address mismatch
- [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]] — I2C address conflict resolution for common sensor pairs

### RTC (Real-Time Clock)
- [[ds3231-tcxo-accuracy-is-orders-of-magnitude-better-than-ds1307-crystal-drift-making-ds1307-obsolete-for-most-projects]] — DS3231 TCXO holds +/-2 ppm vs DS1307 minutes-per-month drift
- [[zs042-charging-circuit-will-damage-non-rechargeable-cr2032-batteries-unless-resistor-r5-is-removed]] — ZS-042 trickle-charges CR2032 unless R5 is removed
- [[ds3231-alarm-and-square-wave-outputs-enable-hardware-triggered-mcu-wake-from-sleep-without-polling]] — SQW/INT pin enables deep-sleep wake patterns
- [[rtclib-lostpower-pattern-sets-the-clock-to-compile-time-on-first-boot-preventing-uninitialized-timestamp-output]] — canonical init pattern prevents 1/1/2000 timestamps

### RFID
- [[rfid-13mhz-reads-only-iso-14443a-tags-within-5cm-limiting-use-to-contact-range-applications]] — 13.56MHz RFID modules limited to 5cm contact range

### Sound & PDM Microphones
- [[i2s-hardware-peripheral-is-a-hard-requirement-for-pdm-microphones-partitioning-mcus-into-compatible-and-incompatible]] — I2S hardware is a MCU partition boundary for PDM mics
- [[two-pdm-mics-share-one-i2s-bus-for-stereo-via-sel-pin-time-multiplexing]] — PDM stereo via SEL-pin multiplexing on one I2S bus
- [[pdm-digital-audio-and-analog-envelope-detection-serve-fundamentally-different-use-cases-not-a-quality-spectrum]] — PDM vs analog-envelope mics solve different problems

## Open Questions
- How does the HMC5883L/QMC5883L distinction extend to other cloned sensor ICs — is there a meta-pattern for identifying silent-clone hazards?

---

Topics:
- [[eda-fundamentals]]
- [[index]]

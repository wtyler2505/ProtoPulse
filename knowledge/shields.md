---
description: "Stackable expansion boards and breakout modules, detailing SPI bus sharing, timer conflicts, and logic level shifting challenges in embedded designs."
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# shields

Shield comparison, pin conflict avoidance, level shifter selection, and expansion board stacking strategies for the inventory (see [[hardware-components]] for physical boards). Covers the Arduino shield form factor, motor shields (HW-130 AFMotor V1 clone, OSEPP Motor/Servo V1 combo, TB6612 MOSFET boards), bidirectional level shifters (BSS138 passive, TXS0108E + 74HCT245 active), sensor/proto/bluetooth shields, and Ethernet/SPI bus-sharing discipline.

## Knowledge Notes

### Form factor + host board selection
- [[uno-defines-the-standard-arduino-shield-header-layout]] — UNO pinout is the reference; everything else is measured against it
- [[mega-2560-pin-7-8-gap-for-shield-compatibility]] — Mega replicates UNO header spacing including the 7-8 gap to preserve shield compatibility
- [[tft-shield-form-factor-consumes-most-uno-pins-making-mega-the-practical-host-board-for-projects-needing-additional-io]] — TFT shield pin consumption drives Mega host selection

### Shield stacking + pin conflicts
- [[shield-pin-conflicts-are-invisible-until-stacking-fails]] — HW-130, Ethernet, and TFT shields share pins silently; stacking causes mysterious failures
- [[spi-bus-sharing-on-a-single-shield-requires-per-device-chip-select-discipline-where-unused-devices-must-be-explicitly-deselected]] — W5100 + SD card on Ethernet shield share SPI; CS discipline prevents bus contention
- [[bluetooth-shield-consumes-arduino-hardware-uart-rx-tx-pins-0-and-1-creating-a-conflict-with-usb-serial-upload-and-debug-print]] — pins 0/1 dual-use with USB creates silent upload failure mode
- [[logic-level-selector-switch-on-a-shield-lets-one-board-work-with-both-3v3-and-5v-arduinos-but-misconfigured-switch-produces-silent-data-corruption]] — selector switches shift the failure mode from incompatibility to silent corruption

### Motor shields
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] — four motor shields form a 600mA→16A ladder that maps to actuator voltage tiers
- [[hw-130-motor-shield-is-an-adafruit-motor-shield-v1-clone-that-uses-the-afmotor-library-unchanged]] — HW-130 inherits AFMotor V1 library support via pin-for-pin clone fidelity; Adafruit V2 library is NOT compatible
- [[74hc595-in-motor-shields-trades-gpio-savings-for-direction-change-latency-that-matters-at-high-switching-frequencies]] — shift-register direction control saves 5 pins on HW-130 but inserts microsecond-scale latency that matters for microstepping
- [[hw-130-shield-consumes-both-timer0-and-timer2-leaving-only-timer1-free-for-other-libraries]] — four-channel motor PWM on HW-130 eliminates tone() and IRremote compatibility, leaving only Servo (Timer1) usable
- [[counterfeit-l293d-chips-on-clone-motor-shields-deliver-lower-than-rated-current-with-no-external-indication]] — cheap HW-130 batches may have sub-600mA chips that mimic "motor too big" symptoms while actually being counterfeit drivers
- [[combo-motor-and-servo-shields-trade-per-function-efficiency-for-single-board-convenience]] — OSEPP Motor/Servo V1 pattern: integrating servo headers onto an L298N motor shield compromises both functions
- [[shield-servo-headers-share-arduino-5v-creating-hidden-brownout-path-that-only-trace-cutting-fixes]] — servo header VCC connects to Arduino on-board regulator; only SG90-class micro servos are safe; trace cut + external 5V is the correct fix
- [[tb6612-mosfet-h-bridge-drops-0-5v-versus-darlington-1-8-to-4-9v-because-rds-on-resistance-beats-saturation-voltage]] — MOSFET architecture explains why TB6612 shields run cool and efficient while L293D/L298N shields lose 15-40% of motor supply as heat
- [[tb6612-pwm-ceiling-of-100khz-is-4x-the-l298n-and-20x-the-l293d-because-mosfet-switching-has-no-storage-time]] — MOSFETs have no carrier storage time, enabling ultrasonic PWM that eliminates audible motor whine on shields like the OSEPP TB6612
- [[tb6612-motor-supply-ceiling-of-13-5v-is-a-hard-selection-boundary-against-l298n-for-24v-and-36v-motor-systems]] — the TB6612 shield is eliminated above 13.5V regardless of efficiency, forcing L298N for 24V and higher motor supplies
- [[tb6612-internal-flyback-diodes-eliminate-the-external-protection-burden-that-l298n-requires]] — TB6612 shields need no external flyback diodes because MOSFET body diodes clamp back-EMF internally

### Level shifters (passive + active)
- [[mixed-protocol-boards-require-one-level-shifter-per-signal-class-not-one-shifter-for-all-signals]] — a single BSS138 module cannot serve I2C + fast SPI + NeoPixel; partition by topology and speed
- [[signal-topology-not-voltage-alone-determines-level-shifter-selection]] — topology (open-drain vs push-pull) picks the shifter family before voltage considerations
- [[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]] — BSS138 achieves auto-direction via body diode at the cost of speed
- [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]] — RC-limited edge rate eliminates BSS138 from fast SPI and NeoPixel lines
- [[open-drain-protocols-require-pull-up-based-level-shifters-because-auto-direction-sensors-cannot-distinguish-driver-from-pull-up]] — I2C/1-Wire must use passive pull-up shifters; active direction-sense cannot disambiguate
- [[active-level-shifters-use-one-shot-edge-accelerators-to-drive-rising-edges-breaking-the-bss138-rc-ceiling]] — TXS0108E achieves 110Mbps push-pull by actively driving edges instead of waiting for RC charge
- [[txs0108e-vcca-must-be-the-lower-voltage-rail-because-the-chip-enforces-asymmetric-supply-roles]] — swapping VCCA and VCCB violates the chip spec even when both voltages are legal individually
- [[txs0108e-oe-pin-is-active-high-and-floating-by-default-silently-disabling-all-outputs]] — opposite OE polarity from 74HC595 creates a specific silent-failure class for level shifters
- [[active-level-shifters-draw-continuous-quiescent-current-unlike-passive-bss138-shifters-with-near-zero-idle-draw]] — TXS0108E's ~100uA idle draw destroys deep-sleep battery budgets unless the shifter rail is gated
- [[bldc-controller-hall-sensor-outputs-are-push-pull-digital-making-txs-class-shifters-the-correct-bridge-to-3v3-mcus]] — controllers regenerate raw Hall signals as push-pull, forcing active-shifter selection despite the raw sensor being open-collector

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]] — Core EDA domain hub -- MCU pin constraints, protocol fundamentals, simulation algorithms, PCB design rules, and standards; cross-links to all hardware topic maps
- [[index]] — Entry point to the ProtoPulse knowledge vault -- 528 atomic notes across 11 hardware topic maps covering microcontrollers, actuators, sensors, displays, power, communication, shields, passives, input devices, and system wiring

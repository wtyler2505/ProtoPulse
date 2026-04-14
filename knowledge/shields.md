---
description: "Shield and breakout knowledge -- motor shields, sensor shields, proto boards, level shifters, and stackable expansion board selection"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# shields

Shield comparison, pin conflict avoidance, level shifter selection, and expansion board stacking strategies for the inventory. Covers motor shields, sensor breakouts, proto shields, and bidirectional level shifters.

## Knowledge Notes
- [[shield-pin-conflicts-are-invisible-until-stacking-fails]] — HW-130, Ethernet, and TFT shields share pins silently; stacking causes mysterious failures
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] — four motor shields form a 600mA→16A ladder that maps to actuator voltage tiers
- [[spi-bus-sharing-on-a-single-shield-requires-per-device-chip-select-discipline-where-unused-devices-must-be-explicitly-deselected]] — W5100 + SD card on Ethernet shield share SPI; CS discipline prevents bus contention
- [[mixed-protocol-boards-require-one-level-shifter-per-signal-class-not-one-shifter-for-all-signals]] — a single BSS138 module cannot serve I2C + fast SPI + NeoPixel; partition by topology and speed
- [[active-level-shifters-use-one-shot-edge-accelerators-to-drive-rising-edges-breaking-the-bss138-rc-ceiling]] — TXS0108E achieves 110Mbps push-pull by actively driving edges instead of waiting for RC charge
- [[txs0108e-vcca-must-be-the-lower-voltage-rail-because-the-chip-enforces-asymmetric-supply-roles]] — swapping VCCA and VCCB violates the chip spec even when both voltages are legal individually
- [[txs0108e-oe-pin-is-active-high-and-floating-by-default-silently-disabling-all-outputs]] — opposite OE polarity from 74HC595 creates a specific silent-failure class for level shifters
- [[active-level-shifters-draw-continuous-quiescent-current-unlike-passive-bss138-shifters-with-near-zero-idle-draw]] — TXS0108E's ~100uA idle draw destroys deep-sleep battery budgets unless the shifter rail is gated
- [[bldc-controller-hall-sensor-outputs-are-push-pull-digital-making-txs-class-shifters-the-correct-bridge-to-3v3-mcus]] — controllers regenerate raw Hall signals as push-pull, forcing active-shifter selection despite the raw sensor being open-collector
- [[hw-130-motor-shield-is-an-adafruit-motor-shield-v1-clone-that-uses-the-afmotor-library-unchanged]] — HW-130 inherits AFMotor V1 library support via pin-for-pin clone fidelity; Adafruit V2 library is NOT compatible
- [[74hc595-in-motor-shields-trades-gpio-savings-for-direction-change-latency-that-matters-at-high-switching-frequencies]] — shift-register direction control saves 5 pins on HW-130 but inserts microsecond-scale latency that matters for microstepping
- [[hw-130-shield-consumes-both-timer0-and-timer2-leaving-only-timer1-free-for-other-libraries]] — four-channel motor PWM on HW-130 eliminates tone() and IRremote compatibility, leaving only Servo (Timer1) usable
- [[counterfeit-l293d-chips-on-clone-motor-shields-deliver-lower-than-rated-current-with-no-external-indication]] — cheap HW-130 batches may have sub-600mA chips that mimic "motor too big" symptoms while actually being counterfeit drivers
- [[combo-motor-and-servo-shields-trade-per-function-efficiency-for-single-board-convenience]] — OSEPP Motor/Servo V1 pattern: integrating servo headers onto an L298N motor shield compromises both functions; pick only when the coupling itself is the requirement
- [[shield-servo-headers-share-arduino-5v-creating-hidden-brownout-path-that-only-trace-cutting-fixes]] — servo header VCC connects to Arduino on-board regulator; only SG90-class micro servos are safe; trace cut + external 5V is the correct fix for anything larger

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]

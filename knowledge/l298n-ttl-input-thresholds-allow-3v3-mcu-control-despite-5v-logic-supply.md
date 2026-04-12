---
description: "L298N input pins have TTL thresholds (HIGH >= 2.3V, LOW <= 1.5V) even though VSS is 5V -- this means 3.3V MCUs like ESP32 can drive the inputs directly without level shifting, but the L298N outputs are not logic-safe"
type: claim
source: "docs/parts/l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[communication]]"
  - "[[eda-fundamentals]]"
---

# l298n ttl input thresholds allow 3v3 mcu control despite 5v logic supply

The L298N requires a 4.5-7V logic supply (VSS) but its input pins (IN1-IN4 and EN_A/EN_B) use TTL-level thresholds, not CMOS. The datasheet specifies:

- Logic HIGH: minimum 2.3V
- Logic LOW: maximum 1.5V

Since 3.3V exceeds the 2.3V HIGH threshold with 1V of margin, a 3.3V MCU (ESP32, Raspberry Pi Pico, STM32) can drive L298N inputs directly without a level shifter. This is a practical advantage because many modern MCUs operate at 3.3V, and level shifting adds complexity and cost.

However, this is a one-way compatibility. The L298N does not present any logic outputs back to the MCU (the SENSE pins are analog current monitoring, not digital). If it did, those outputs would be at 5V and would require level shifting to protect a 3.3V MCU. Since [[raspberry-pi-gpio-is-3v3-unprotected-with-no-clamping-diodes-and-5v-kills-the-soc-permanently]], this asymmetry matters -- inputs to the L298N are safe from a 3.3V MCU, but never connect a 5V output back to an unprotected 3.3V GPIO.

**The SENSE pin gotcha:** The current sense pins (SENSE_A, SENSE_B) produce a voltage proportional to motor current across an external resistor. With a 0.5 ohm sense resistor at 2A, this voltage reaches 1V -- safe for both 3.3V and 5V ADC inputs. But without the external resistor (pins jumpered to GND as most tutorials show), no current sensing is available. This is a missed learning opportunity for beginners.

**ProtoPulse implication:** When the AI bench coach sees an L298N paired with a 3.3V MCU, it should confirm compatibility (no level shifter needed for inputs) rather than incorrectly flagging a voltage mismatch. The DRC should only warn if a 5V signal is being routed back to a 3.3V-only GPIO.

---

Source: [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]

Relevant Notes:
- [[raspberry-pi-gpio-is-3v3-unprotected-with-no-clamping-diodes-and-5v-kills-the-soc-permanently]] -- 5V->3.3V direction is dangerous; 3.3V->5V direction (as with L298N inputs) is fine
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- the L298N's EN pins accept PWM for speed control, and the TTL threshold applies to this PWM signal too

Topics:
- [[actuators]]
- [[communication]]
- [[eda-fundamentals]]

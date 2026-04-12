---
description: "The MB V2's AMS1117 regulators cap total output at ~700mA across both rails combined -- below the stall current of even small hobby servos, guaranteeing brownouts if actuators share the breadboard supply"
type: claim
source: "docs/parts/elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "mb-v2-power-module"
  - "ams1117"
  - "sg90-micro-servo"
---

# Breadboard power module 700mA total budget excludes servos and motors requiring separate power

The MB V2 breadboard power module uses AMS1117 linear regulators with a combined output budget of approximately 700mA across both rails. This number is below the stall current of even the smallest hobby servos (SG90 draws 650mA stall, MG90S draws 1.2A), far below any DC motor's startup surge, and leaves almost nothing for an ESP32 running WiFi (240mA peaks).

The failure mode is insidious: beginners reach for this module assuming it powers everything on their breadboard, add a servo or two, and get intermittent brownouts that manifest as:
- Random MCU resets during servo movement
- WiFi disconnections that only happen when actuators move
- Corrupted sensor readings that correlate with motor activity
- The "it worked yesterday" syndrome (ambient temperature and USB cable quality affect thermal margin)

The root cause is never obvious because the module has no overcurrent indicator, no thermal warning LED, and the AMS1117's thermal shutdown is abrupt -- it cuts out entirely rather than degrading gracefully.

**The rule:** Breadboard power modules are for logic and low-power sensors only. Any actuator (servo, motor, solenoid, large LED strip) needs its own power supply feeding directly from the bench supply or battery, with only the ground shared to the breadboard.

**ProtoPulse implication:** The bench coach should flag any breadboard design where a servo or motor's power pin connects to the breadboard power rail, and suggest separate power with shared ground.

---

Relevant Notes:
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] -- same regulator family, same thermal ceiling, same WiFi-induced brownout pattern
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- actuators belong on separate power tiers, never on the logic supply
- [[relay-coil-draws-70ma-which-exceeds-gpio-limits-on-every-common-mcu]] -- even a relay coil (70mA) eats 10% of the breadboard module budget

Topics:
- [[power-systems]]
- [[eda-fundamentals]]

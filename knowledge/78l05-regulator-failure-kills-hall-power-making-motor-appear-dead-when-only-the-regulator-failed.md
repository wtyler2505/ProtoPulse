---
description: "The ZS-X11H's onboard 78L05 powers the Hall sensors -- if this regulator fails, the controller gets no position feedback and the motor won't run, but the power LED still lights because it's on the main supply rail"
type: claim
source: "docs/parts/riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md"
confidence: high
topics:
  - "[[actuators]]"
  - "[[breadboard-intelligence]]"
  - "[[eda-fundamentals]]"
---

# 78L05 regulator failure kills Hall power making motor appear dead when only the regulator failed

The ZS-X11H has an onboard 78L05 linear regulator that converts the motor supply voltage (6-60V) down to 5V specifically to power the Hall effect sensors in the motor. This regulator is a single point of failure with a non-obvious failure signature.

**The failure chain:**
1. 78L05 fails (overheating, overcurrent, or input voltage spike)
2. Hall sensors lose 5V power supply
3. Hall outputs go LOW or undefined (no power = no magnetic field detection)
4. Controller reads invalid Hall state (000 or random)
5. Controller cannot determine rotor position
6. Motor does not commutate -- it either doesn't move at all, or vibrates/buzzes weakly
7. Power LED still lights (it's on the main supply rail, not the 78L05 output)
8. Status LED may or may not indicate a fault depending on firmware version

**Why this is a diagnostic trap:** The symptoms -- motor doesn't spin, power LED is on, controller appears to receive power -- look like a dead motor, bad phase wiring, or wrong Hall sensor order. The actual failure is a $0.20 voltage regulator. Without a multimeter to check the 5V output on the Hall sensor power pin, this failure can take hours to diagnose.

**The 78L05 specifically:** This is a low-power variant of the 7805, rated at only 100mA. Three Hall sensors draw approximately 30mA total (10mA each), well within rating. But the regulator must survive the input voltage range (6-60V), and at 60V input with 5V output, the dropout dissipation is (60-5) * 0.03A = 1.65W in a TO-92 package with a thermal resistance of ~200C/W. That's 330C rise -- clearly beyond limits. The 78L05 is only viable when the input voltage is moderate (12-24V). At 36V or above, the regulator runs hot, and at 48-60V it is likely to fail.

**ProtoPulse implication:** The bench coach should surface this as a troubleshooting step when a user reports "motor doesn't work" with a ZS-X11H: "Check the 5V pin on the Hall sensor connector with a multimeter. If it reads 0V or below 4.5V, the onboard 78L05 regulator has failed."

---

Source: [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]

Relevant Notes:
- [[hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position]] -- the 78L05 provides the 5V for both the Hall sensor power and the pull-up resistors
- [[hall-sensor-wiring-order-matters-for-bldc]] -- bad Hall wiring and dead 78L05 produce overlapping symptoms (motor vibrates or doesn't spin)
- [[clone-arduino-voltage-regulators-can-overheat-silently-because-there-is-no-thermal-feedback]] -- same failure pattern: a linear regulator silently overheating with no thermal feedback
- [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] -- the lack of protection extends even to the ancillary regulator

Topics:
- [[actuators]]
- [[breadboard-intelligence]]
- [[eda-fundamentals]]

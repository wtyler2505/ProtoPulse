---
description: "The onboard AMS1117-3.3 drops 5V USB/Vin to 3.3V but caps usable current at ~800mA -- WiFi peaks at 240mA, leaving ~560mA for everything else"
type: claim
source: "docs/parts/nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# ESP32 AMS1117 regulator limits total board current to approximately 800mA

The NodeMCU ESP32 dev board uses an AMS1117-3.3 linear regulator to drop 5V USB or Vin input to the 3.3V that the ESP32 module requires. This regulator is rated for a maximum of 800mA continuous output. With WiFi transmission drawing up to 240mA in peaks, that leaves approximately 560mA for peripherals, sensors, and LEDs.

The practical constraint is that many USB power sources provide only 500mA (USB 2.0 spec). With the regulator's own dropout losses and the ESP32's WiFi peaks, a 500mA USB supply can brownout during transmission bursts. Symptoms include WiFi disconnections, random reboots, or corrupted serial output -- all intermittent and difficult to diagnose because they only occur during high-power radio activity.

The AMS1117 is a linear regulator, so heat dissipation follows the same formula as the Mega's regulator: (Vin - 3.3V) x Iload watts. At 5V input drawing 800mA, that's 1.36W -- manageable but warm. At higher Vin (some boards accept up to 12V through the Vin pin), the heat gets serious.

**Power budget rule:** ESP32 WiFi projects should use a USB supply rated for at least 1A. Projects with servos, LED strips, or motors attached should use the 3.3V rail only for the ESP32 and low-power sensors, with separate regulated supplies for high-current peripherals.

---

Relevant Notes:
- [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]] -- same class of linear regulator thermal problem, different voltage tier
- [[mega-3v3-output-limited-to-50ma-cannot-power-wifi-or-bluetooth-modules]] -- the Mega's 3.3V pin is even more limited; the ESP32's regulator at least handles WiFi on its own
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- ESP32 projects with motors need multi-rail power design

Topics:
- [[microcontrollers]]
- [[power-systems]]
- [[eda-fundamentals]]

---
description: "All ESP8266 GPIO pins share a single software PWM timer at approximately 1kHz with 10-bit duty cycle -- inadequate for servo timing (50Hz) and causes visible LED flicker at low brightness"
type: claim
source: "docs/parts/esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "esp8266-nodemcu-amica"
---

# ESP8266 PWM is software-implemented at approximately 1kHz which is unsuitable for servo control

Unlike the ESP32 which has dedicated hardware PWM (LEDC) peripherals with configurable frequency and resolution, the ESP8266 implements PWM entirely in software using timer interrupts. This software PWM runs at approximately 1kHz with a 10-bit (0-1023) duty cycle range across all enabled PWM pins simultaneously.

**Consequences of software PWM:**

1. **Servo control is unreliable.** Standard hobby servos expect a 50Hz signal with 1-2ms pulse width. The ESP8266 Servo library works around the 1kHz base by using timer interrupts to generate the correct pulse widths, but WiFi interrupt handling can jitter the timing enough to cause servo twitching. Libraries like `Servo.h` or `ServoESP8266` compensate, but results are less precise than hardware PWM.

2. **LED dimming flickers at low duty cycles.** At 1kHz, a 1% duty cycle produces a 10-microsecond pulse per cycle — fast enough to avoid flicker for most LEDs. But at very low brightness levels (0.1-1%) or with WS2812B-style protocols that need precise timing, the software PWM can produce visible artifacts. Human perception of flicker varies, but 1kHz is marginal.

3. **WiFi disrupts timing.** WiFi stack handling can temporarily block the CPU for up to several milliseconds, causing PWM glitches. This is more pronounced during active WiFi transmission (scan, connect, send). Applications requiring stable PWM output during WiFi activity will see intermittent artifacts.

4. **All PWM pins share one timer.** You cannot set different frequencies for different pins. All active PWM outputs run at the same base frequency.

**For precise PWM needs on ESP8266:** Use an external PWM driver like the PCA9685 (16-channel, 12-bit, I2C, hardware PWM at configurable frequency). This offloads timing from the CPU entirely and provides servo-grade precision.

---

Relevant Notes:
- [[esp8266-gpio16-is-architecturally-unique-and-cannot-do-pwm-or-i2c]] — GPIO16 is the one pin that cannot even do software PWM
- [[esp8266-has-only-5-truly-safe-gpio-out-of-11-total-pins]] — all 5 safe pins support software PWM, but with the limitations described here

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
